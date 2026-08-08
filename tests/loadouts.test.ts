// Applying a loadout is a plan, and the plan is where all the Destiny
// specific cruelty lives: no character to character move, no moving what is
// equipped, and a slot that can fill up mid run.

import { describe, expect, it } from 'vitest';
import {
  buildArmory,
  type ArmoryData,
  type ProfileWithInventory
} from '../src/armory';
import {
  equipIds,
  exportJson,
  importJson,
  loadSaved,
  planApply,
  replacementFor,
  saveAll,
  snapshot,
  STORAGE_KEY,
  type Loadout
} from '../src/loadouts';

const KINETIC = 1498876634;
const HELMET = 3448274439;
const VAULT = 138197802;

const data: ArmoryData = {
  manifestVersion: 'test',
  generated: '2026-08-08',
  meta: { iconPrefix: '/icons/', itemFields: [] },
  buckets: {},
  damage: {},
  stats: {},
  tiers: {},
  items: {
    '1001': ['Sunshot', '', KINETIC, 6, 3, 9, 3, 3, 'Hand Cannon', 1, 0],
    '1002': ['Backup Auto', '', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0],
    '1003': ['Vault Gun', '', KINETIC, 5, 3, 6, 3, 1, 'Auto Rifle', 1, 0],
    '2001': ['Hunter Hood', '', HELMET, 5, 2, 26, 1, 0, 'Helmet', 0, 0]
  }
};

function armoryFixture(): ReturnType<typeof buildArmory> {
  const profile: ProfileWithInventory = {
    characters: {
      data: {
        'char-titan': { characterId: 'char-titan', classType: 0, light: 2010 },
        'char-hunter': { characterId: 'char-hunter', classType: 1, light: 2000 }
      }
    },
    characterEquipment: {
      data: {
        'char-titan': { items: [{ itemHash: 1002, itemInstanceId: 'i-auto', bucketHash: KINETIC }] },
        'char-hunter': { items: [{ itemHash: 1001, itemInstanceId: 'i-sunshot', bucketHash: KINETIC }] }
      }
    },
    characterInventories: {
      data: {
        'char-titan': { items: [] },
        'char-hunter': {
          items: [
            { itemHash: 1003, itemInstanceId: 'i-spare', bucketHash: KINETIC },
            { itemHash: 2001, itemInstanceId: 'i-hood', bucketHash: HELMET }
          ]
        }
      }
    },
    profileInventory: {
      data: { items: [{ itemHash: 1003, itemInstanceId: 'i-vaulted', bucketHash: VAULT }] }
    },
    itemComponents: { instances: { data: { 'i-spare': { primaryStat: { value: 1990 } } } } }
  };
  return buildArmory(profile, data);
}

function loadout(items: Array<[string, number, number, string]>): Loadout {
  return {
    id: 'l-1',
    name: 'Boss DPS',
    classType: 0,
    saved: '2026-08-08',
    items: items.map(([instanceId, hash, bucket, name]) => ({ instanceId, hash, bucket, name }))
  };
}

describe('planApply', () => {
  it('does nothing for an item already equipped on the target', () => {
    const plan = planApply(loadout([['i-auto', 1002, KINETIC, 'Backup Auto']]), armoryFixture(), 'char-titan');
    expect(plan.steps).toEqual([]);
    expect(plan.alreadyOn).toEqual(['Backup Auto']);
    expect(plan.summary).toMatch(/already wearing/);
  });

  it('pulls a vaulted item out and equips it, in that order', () => {
    const plan = planApply(loadout([['i-vaulted', 1003, KINETIC, 'Vault Gun']]), armoryFixture(), 'char-titan');
    expect(plan.steps.map((step) => step.kind)).toEqual(['to-character', 'equip']);
    expect(plan.blockers).toEqual([]);
    expect(equipIds(plan)).toEqual(['i-vaulted']);
  });

  it('routes a cross character move through the vault, two hops', () => {
    const plan = planApply(loadout([['i-spare', 1003, KINETIC, 'Vault Gun']]), armoryFixture(), 'char-titan');
    expect(plan.steps.map((step) => step.kind)).toEqual(['to-vault', 'to-character', 'equip']);
    expect(plan.steps[0].characterId).toBe('char-hunter');
    expect(plan.steps[1].characterId).toBe('char-titan');
  });

  it('blocks on an item equipped elsewhere and names the swap that unblocks it', () => {
    const plan = planApply(loadout([['i-sunshot', 1001, KINETIC, 'Sunshot']]), armoryFixture(), 'char-titan');
    expect(plan.steps).toEqual([]);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0].reason).toMatch(/equipped on your Hunter/);
    expect(plan.blockers[0].fix).toMatch(/Equip Vault Gun on that character first/);
  });

  it('blocks class locked armour rather than letting Bungie refuse it', () => {
    // i-hood really is in the fixture, carried by the Hunter and not equipped,
    // so the only thing that can stop it is the class check. Without the item
    // present this test would pass for the wrong reason, on the missing-copy
    // branch, and would never have exercised the class rule at all.
    const armory = armoryFixture();
    expect(armory.byInstance.has('i-hood')).toBe(true);
    const plan = planApply(loadout([['i-hood', 2001, HELMET, 'Hunter Hood']]), armory, 'char-titan');
    expect(plan.steps).toEqual([]);
    expect(plan.blockers[0].reason).toMatch(/class locked and this character is a different class/);
    expect(plan.blockers[0].fix).toMatch(/character it was saved from/);
  });

  it('says so when the exact copy is gone', () => {
    const plan = planApply(loadout([['i-ghost', 1003, KINETIC, 'Deleted Gun']]), armoryFixture(), 'char-titan');
    expect(plan.blockers[0].itemName).toBe('Deleted Gun');
    expect(plan.blockers[0].fix).toMatch(/save the loadout again/);
  });

  it('moves everything out before it moves anything in', () => {
    const plan = planApply(
      loadout([
        ['i-spare', 1003, KINETIC, 'Vault Gun'],
        ['i-vaulted', 1003, KINETIC, 'Vault Gun 2']
      ]),
      armoryFixture(),
      'char-titan'
    );
    const kinds = plan.steps.map((step) => step.kind);
    const lastOut = kinds.lastIndexOf('to-vault');
    const firstIn = kinds.indexOf('to-character');
    expect(lastOut).toBeLessThan(firstIn);
    expect(kinds.filter((k) => k === 'equip')).toHaveLength(2);
  });

  it('refuses a character that is not on the account', () => {
    const plan = planApply(loadout([]), armoryFixture(), 'char-nobody');
    expect(plan.steps).toEqual([]);
    expect(plan.blockers[0].reason).toMatch(/not on this account/);
  });

  it('writes a summary a person can agree to', () => {
    const plan = planApply(
      loadout([
        ['i-vaulted', 1003, KINETIC, 'Vault Gun'],
        ['i-ghost', 1003, KINETIC, 'Deleted Gun']
      ]),
      armoryFixture(),
      'char-titan'
    );
    expect(plan.summary).toBe(
      'Apply Boss DPS to your Titan: 1 item move and 1 item equipped. 1 item is blocked and will be skipped.'
    );
  });
});

describe('replacementFor', () => {
  it('picks the highest power thing in the slot that is not the one leaving', () => {
    const armory = armoryFixture();
    const hunter = armory.characters.find((c) => c.classType === 1)!;
    expect(replacementFor(hunter, KINETIC, 'i-sunshot')?.instanceId).toBe('i-spare');
    expect(replacementFor(hunter, KINETIC, 'i-spare')).toBeNull();
  });
});

describe('snapshot', () => {
  it('captures what a character is wearing, slot by slot', () => {
    const armory = armoryFixture();
    const titan = armory.characters[0];
    const saved = snapshot(titan, 'Titan now', 'l-9', '2026-08-08');
    expect(saved.classType).toBe(0);
    expect(saved.items).toEqual([
      { instanceId: 'i-auto', hash: 1002, bucket: KINETIC, name: 'Backup Auto' }
    ]);
  });
});

describe('storage', () => {
  function memoryStore(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0
    } as unknown as Storage;
  }

  it('round trips', () => {
    const store = memoryStore();
    const one = loadout([['i-1', 1001, KINETIC, 'Sunshot']]);
    expect(saveAll(store, [one])).toBe(true);
    expect(loadSaved(store)).toEqual([one]);
  });

  it('returns nothing rather than throwing on junk', () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEY, 'not json at all');
    expect(loadSaved(store)).toEqual([]);
    store.setItem(STORAGE_KEY, JSON.stringify({ format: 1, loadouts: [{ nope: true }] }));
    expect(loadSaved(store)).toEqual([]);
    expect(loadSaved(null)).toEqual([]);
  });

  it('survives a storage that refuses to write', () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      }
    } as unknown as Storage;
    expect(saveAll(broken, [])).toBe(false);
  });

  it('exports and imports the same loadouts', () => {
    const one = loadout([['i-1', 1001, KINETIC, 'Sunshot']]);
    const round = importJson(exportJson([one]));
    expect(round.error).toBeNull();
    expect(round.loadouts).toEqual([one]);
  });

  it('says what is wrong with a bad import instead of failing silently', () => {
    expect(importJson('{').error).toMatch(/valid JSON/);
    expect(importJson('{"format":1}').error).toMatch(/no loadouts array/);
    expect(importJson('{"format":1,"loadouts":[1,2]}').error).toMatch(/look like a loadout/);
  });
});
