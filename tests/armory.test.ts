// The join that turns a GetProfile response into an armoury.
//
// The two things worth guarding here are the ones that are invisible when
// they break: a vaulted item has to report the slot it EQUIPS into rather
// than the vault it sits in, and equipped state is a separate list rather
// than a flag on the item.

import { describe, expect, it } from 'vitest';
import {
  ARMOR_BUCKETS,
  EQUIP_BUCKETS,
  VAULT_BUCKET,
  POSTMASTER_BUCKET,
  buildArmory,
  damageName,
  equippableBy,
  iconUrl,
  isExotic,
  itemName,
  sortItems,
  type ArmoryData,
  type ArmoryItem,
  type ProfileWithInventory
} from '../src/armory';

const KINETIC = 1498876634;
const HELMET = 3448274439;
const CLASS_ARMOR = 1585787867;

/** A tiny bake. Field order mirrors scripts/build-armory.mjs exactly. */
const data: ArmoryData = {
  manifestVersion: 'test',
  generated: '2026-08-08',
  meta: { iconPrefix: '/icons/', itemFields: [] },
  buckets: {
    [KINETIC]: ['Kinetic Weapons', 3, 20, 10],
    [HELMET]: ['Helmet', 3, 50, 10],
    [VAULT_BUCKET]: ['General', 1, 30, 1300]
  },
  damage: { '3373582085': ['Kinetic', 'kin.png', 1], '1847026933': ['Solar', 'sol.png', 3] },
  stats: { '2996146975': 'Weapons' },
  tiers: { '2759499571': 'Exotic' },
  items: {
    // name, icon, bucket, tier, type, sub, class, damage, typeName, ammo, slot
    '1001': ['Sunshot', 'sun.png', KINETIC, 6, 3, 9, 3, 3, 'Hand Cannon', 1, 0],
    '1002': ['Boring Auto', 'auto.png', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0],
    '2001': ['Hunter Hood', 'hood.png', HELMET, 5, 2, 26, 1, 0, 'Helmet', 0, 0],
    '3001': ['Titan Mark', 'mark.png', CLASS_ARMOR, 5, 2, 28, 0, 0, 'Mark', 0, 0]
  }
};

function profile(): ProfileWithInventory {
  return {
    characters: {
      data: {
        'char-titan': { characterId: 'char-titan', classType: 0, light: 2010, emblemBackgroundPath: '/e.jpg' },
        'char-hunter': { characterId: 'char-hunter', classType: 1, light: 2005, emblemBackgroundPath: '/h.jpg' }
      }
    },
    characterEquipment: {
      data: {
        'char-titan': {
          items: [{ itemHash: 1001, itemInstanceId: 'i-sunshot', bucketHash: KINETIC, state: 5 }]
        },
        'char-hunter': {
          items: [{ itemHash: 2001, itemInstanceId: 'i-hood', bucketHash: HELMET, state: 1 }]
        }
      }
    },
    characterInventories: {
      data: {
        'char-titan': {
          items: [
            { itemHash: 1002, itemInstanceId: 'i-auto', bucketHash: KINETIC, state: 0 },
            { itemHash: 1002, itemInstanceId: 'i-post', bucketHash: POSTMASTER_BUCKET, state: 0 }
          ]
        },
        'char-hunter': { items: [] }
      }
    },
    profileInventory: {
      data: {
        items: [
          { itemHash: 3001, itemInstanceId: 'i-mark', bucketHash: VAULT_BUCKET, state: 0 },
          // A consumable stack. It lives in General too and must not appear.
          { itemHash: 9999, bucketHash: VAULT_BUCKET, quantity: 40 }
        ]
      }
    },
    itemComponents: {
      instances: { data: { 'i-sunshot': { primaryStat: { value: 2010 } }, 'i-auto': { primaryStat: { value: 1990 } } } },
      sockets: { data: { 'i-sunshot': { sockets: [{ plugHash: 77 }, { plugHash: 0 }, { plugHash: 88 }] } } },
      stats: { data: { 'i-hood': { stats: { '2996146975': { value: 30 } } } } }
    }
  };
}

describe('buildArmory', () => {
  it('separates equipped from carried and keeps the postmaster apart', () => {
    const armory = buildArmory(profile(), data);
    const titan = armory.characters[0];
    expect(titan.className).toBe('Titan');
    expect(titan.equipped.get(KINETIC)?.instanceId).toBe('i-sunshot');
    expect(titan.carried.get(KINETIC)?.map((i) => i.instanceId)).toEqual(['i-auto']);
    expect(titan.postmaster.map((i) => i.instanceId)).toEqual(['i-post']);
  });

  it('orders characters Titan, Hunter, Warlock regardless of key order', () => {
    const armory = buildArmory(profile(), data);
    expect(armory.characters.map((c) => c.classType)).toEqual([0, 1]);
  });

  it('gives a vaulted item the slot it equips into, not the vault', () => {
    const armory = buildArmory(profile(), data);
    const mark = armory.byInstance.get('i-mark');
    expect(mark?.bucket).toBe(VAULT_BUCKET);
    expect(mark?.homeBucket).toBe(CLASS_ARMOR);
    expect(armory.vault.get(CLASS_ARMOR)?.map((i) => i.instanceId)).toEqual(['i-mark']);
  });

  it('keeps materials out of the vault view even though they live in General', () => {
    const armory = buildArmory(profile(), data);
    const everything = [...armory.vault.values()].flat();
    expect(everything.every((item) => item.def !== null)).toBe(true);
    expect(armory.unknownCount).toBe(1);
  });

  it('reads power, plugs and stats off the item components', () => {
    const armory = buildArmory(profile(), data);
    const sunshot = armory.byInstance.get('i-sunshot');
    expect(sunshot?.power).toBe(2010);
    // The empty socket is dropped rather than rendered as plug zero.
    expect(sunshot?.plugs).toEqual([77, 88]);
    expect(armory.byInstance.get('i-hood')?.stats[2996146975]).toBe(30);
  });

  it('decodes the state bit field without guessing at the other bits', () => {
    const armory = buildArmory(profile(), data);
    const sunshot = armory.byInstance.get('i-sunshot');
    // state 5 is locked plus masterworked, and nothing else.
    expect(sunshot?.locked).toBe(true);
    expect(sunshot?.masterworked).toBe(true);
    expect(sunshot?.crafted).toBe(false);
    expect(armory.byInstance.get('i-hood')?.masterworked).toBe(false);
  });

  it('survives a profile with nothing in it', () => {
    const armory = buildArmory({}, data);
    expect(armory.characters).toEqual([]);
    expect(armory.vault.size).toBe(0);
    expect(armory.unknownCount).toBe(0);
  });
});

describe('helpers', () => {
  it('sorts by power then name, stably', () => {
    const make = (id: string, power: number | null, name: string): ArmoryItem => ({
      instanceId: id,
      hash: 1,
      quantity: 1,
      bucket: KINETIC,
      homeBucket: KINETIC,
      owner: null,
      equipped: false,
      locked: false,
      masterworked: false,
      crafted: false,
      power,
      plugs: [],
      stats: {},
      def: [name, '', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0]
    });
    const sorted = sortItems([make('a', 10, 'Zulu'), make('b', null, 'Alpha'), make('c', 10, 'Alpha')]);
    expect(sorted.map((i) => i.instanceId)).toEqual(['c', 'a', 'b']);
  });

  it('refuses to offer a class locked item to the wrong class', () => {
    const armory = buildArmory(profile(), data);
    const mark = armory.byInstance.get('i-mark')!;
    expect(equippableBy(mark, armory.characters).map((c) => c.className)).toEqual(['Titan']);
    const sunshot = armory.byInstance.get('i-sunshot')!;
    expect(equippableBy(sunshot, armory.characters)).toHaveLength(2);
  });

  it('names things, including the ones the bake does not know', () => {
    const armory = buildArmory(profile(), data);
    expect(itemName(armory.byInstance.get('i-sunshot')!)).toBe('Sunshot');
    expect(isExotic(armory.byInstance.get('i-sunshot')!)).toBe(true);
    expect(isExotic(armory.byInstance.get('i-auto')!)).toBe(false);
    expect(damageName(data, armory.byInstance.get('i-sunshot')!)).toBe('Solar');
  });

  it('builds icon urls for both relative and absolute bakes', () => {
    expect(iconUrl(data, 'sun.png')).toBe('https://www.bungie.net/icons/sun.png');
    expect(iconUrl(data, '/full/path.png')).toBe('https://www.bungie.net/full/path.png');
    expect(iconUrl(data, '')).toBe('');
  });

  it('lists the equipment buckets weapons first', () => {
    expect(EQUIP_BUCKETS).toHaveLength(8);
    expect(EQUIP_BUCKETS.slice(3)).toEqual([...ARMOR_BUCKETS]);
  });
});
