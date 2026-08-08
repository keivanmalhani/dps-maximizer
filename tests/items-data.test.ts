// items.json is generated from the live manifest by scripts/build-data.mjs
// and committed. These tests are the drift alarm: if the curated list in
// tiers.ts and the bake ever disagree, CI fails instead of the site quietly
// recommending something it cannot identify.

import { describe, expect, it } from 'vitest';
import {
  BAKED_ITEMS,
  CATALYST_HASHES,
  CIPHER_HASH,
  EMPTY_CATALYST_HASHES,
  ITEM_ID_BY_COLLECTIBLE,
  ITEM_ID_BY_HASH,
  MANIFEST_VERSION,
  PERK_HASHES,
  STAT_HASHES,
  iconUrl,
  slotLabel
} from '../src/data/items';
import { CATALYST_IDS, CURATED, WANTED_PERK_NAMES } from '../src/data/tiers';

describe('the bake as a whole', () => {
  it('records the manifest version it was generated from', () => {
    expect(MANIFEST_VERSION).toMatch(/bnet/);
  });

  it('bakes exactly the curated list, nothing more, nothing less', () => {
    expect(Object.keys(BAKED_ITEMS).sort()).toEqual(CURATED.map((item) => item.id).sort());
  });

  it('found the Exotic Cipher item', () => {
    expect(CIPHER_HASH).toBeGreaterThan(0);
  });

  it('found the Empty Catalyst Socket plug', () => {
    expect(EMPTY_CATALYST_HASHES.length).toBeGreaterThan(0);
  });

  it('resolved all six Armor 3.0 character stats', () => {
    expect(Object.keys(STAT_HASHES).sort()).toEqual(
      ['Class', 'Grenade', 'Health', 'Melee', 'Super', 'Weapons'].sort()
    );
    for (const hash of Object.values(STAT_HASHES)) expect(hash).toBeGreaterThan(0);
  });

  it('keeps the profile-keyed stat hashes, the ones character.stats uses', () => {
    expect(STAT_HASHES.Weapons).toBe(2996146975);
    expect(STAT_HASHES.Health).toBe(392767087);
    expect(STAT_HASHES.Class).toBe(1943323491);
    expect(STAT_HASHES.Grenade).toBe(1735777505);
    expect(STAT_HASHES.Super).toBe(144602215);
    expect(STAT_HASHES.Melee).toBe(4244567218);
  });
});

describe.each(CURATED.map((item) => [item.id, item] as const))('bake of %s', (id, curated) => {
  const baked = BAKED_ITEMS[id];

  it('exists', () => {
    expect(baked).toBeTruthy();
  });

  it('name matches the curated name exactly', () => {
    expect(baked.name).toBe(curated.name);
  });

  it('kind matches', () => {
    expect(baked.kind).toBe(curated.kind);
  });

  it('has at least one item hash and an icon', () => {
    expect(baked.hashes.length).toBeGreaterThan(0);
    expect(baked.primaryHash).toBeGreaterThan(0);
    expect(baked.icon).toMatch(/^\/common\/destiny2_content\/icons\//);
  });

  it('sits in a sensible slot for its kind', () => {
    if (curated.kind === 'weapon') {
      expect(['kinetic', 'energy', 'power']).toContain(baked.slot);
    } else {
      expect(['helmet', 'gauntlets', 'chest', 'legs', 'classitem']).toContain(baked.slot);
    }
  });

  it('exotic flag agrees with the manifest tier', () => {
    expect(baked.tierType === 6).toBe(curated.exotic);
  });

  it('class lock agrees with the curated class', () => {
    if (curated.kind === 'armor') {
      expect(baked.classType).toBe(curated.classType);
    } else {
      expect(baked.classType).toBe(3);
    }
  });

  it('is reachable through the hash and collectible indexes', () => {
    for (const hash of baked.hashes) expect(ITEM_ID_BY_HASH.get(hash)).toBe(id);
    for (const hash of baked.collectibleHashes) expect(ITEM_ID_BY_COLLECTIBLE.get(hash)).toBe(id);
  });
});

describe('slots the manifest corrected', () => {
  it('Ergo Sum is an energy weapon, whatever anyone remembers', () => {
    expect(BAKED_ITEMS['ergo-sum'].slot).toBe('energy');
  });

  it('the heavies are heavies', () => {
    for (const id of [
      'hezen-vengeance',
      'gjallarhorn',
      'edge-transit',
      'the-queenbreaker',
      'thunderlord',
      'anarchy',
      'apex-predator',
      'one-thousand-voices',
      'whisper-of-the-worm',
      'grand-overture',
      'winterbite',
      'vs-chill-inhibitor',
      'tractor-cannon',
      "finalitys-auger"
    ]) {
      expect(BAKED_ITEMS[id].slot, id).toBe('power');
    }
  });

  it('the kinetics are kinetics', () => {
    for (const id of ['praedyths-revenge', 'izanagis-burden', 'lumina', 'witherhoard', 'outbreak-perfected']) {
      expect(BAKED_ITEMS[id].slot, id).toBe('kinetic');
    }
  });

  it('the armor buckets are what the exotics wear', () => {
    expect(BAKED_ITEMS['celestial-nighthawk'].slot).toBe('helmet');
    expect(BAKED_ITEMS['cuirass-of-the-falling-star'].slot).toBe('chest');
    expect(BAKED_ITEMS['sanguine-alchemy'].slot).toBe('chest');
    expect(BAKED_ITEMS['synthoceps'].slot).toBe('gauntlets');
    expect(BAKED_ITEMS['briarbinds'].slot).toBe('gauntlets');
    expect(BAKED_ITEMS['shards-of-galanor'].slot).toBe('gauntlets');
    expect(BAKED_ITEMS['lunafaction-boots'].slot).toBe('legs');
    expect(BAKED_ITEMS['lucky-pants'].slot).toBe('legs');
    expect(BAKED_ITEMS['star-eater-scales'].slot).toBe('legs');
  });
});

describe('frames for the champion mapping', () => {
  it('legendary frames resolved from the manifest', () => {
    expect(BAKED_ITEMS['hezen-vengeance'].frame).toBe('Aggressive Frame');
    expect(BAKED_ITEMS['edge-transit'].frame).toBe('Adaptive Frame');
    expect(BAKED_ITEMS['apex-predator'].frame).toBe('Adaptive Frame');
    expect(BAKED_ITEMS['praedyths-revenge'].frame).toBe('Rapid-Fire Frame');
    expect(BAKED_ITEMS['vs-chill-inhibitor'].frame).toBe('Rapid-Fire Frame');
  });

  it('exotic intrinsics kept by name, for the honest pending note', () => {
    expect(BAKED_ITEMS['gjallarhorn'].frame).toBe('Wolfpack Rounds');
    expect(BAKED_ITEMS['izanagis-burden'].frame).toBe('Honed Edge');
    expect(BAKED_ITEMS['tractor-cannon'].frame).toBe('Repulsor Force');
  });

  it('Ergo Sum rolls its frame, so the bake refuses to name one', () => {
    expect(BAKED_ITEMS['ergo-sum'].frame).toBeNull();
  });

  it('armor has no frame', () => {
    expect(BAKED_ITEMS['celestial-nighthawk'].frame).toBeNull();
  });
});

describe('multiple manifest versions', () => {
  it('Edge Transit reissues all count as Edge Transit', () => {
    expect(BAKED_ITEMS['edge-transit'].hashes.length).toBeGreaterThan(1);
  });

  it('Timelost Hezen counts as Hezen', () => {
    expect(BAKED_ITEMS['hezen-vengeance'].aliases).toContain('Hezen Vengeance (Timelost)');
    expect(BAKED_ITEMS['hezen-vengeance'].hashes.length).toBeGreaterThan(1);
  });

  it("Timelost Praedyth's counts as Praedyth's", () => {
    expect(BAKED_ITEMS['praedyths-revenge'].aliases).toContain("Praedyth's Revenge (Timelost)");
  });
});

describe('perk and catalyst plugs', () => {
  it.each([...WANTED_PERK_NAMES].map((name) => [name]))('resolved plug hashes for %s', (name) => {
    expect(PERK_HASHES[name]).toBeTruthy();
    expect(PERK_HASHES[name].length).toBeGreaterThan(0);
  });

  it('kept base and enhanced for the trait perks', () => {
    expect(PERK_HASHES['Bait and Switch'].length).toBe(2);
    expect(PERK_HASHES['Overflow'].length).toBe(2);
    expect(PERK_HASHES['Envious Assassin'].length).toBe(2);
  });

  it.each(CATALYST_IDS.map((id) => [id]))('resolved the catalyst plug for %s', (id) => {
    expect(CATALYST_HASHES[id]).toBeTruthy();
    expect(CATALYST_HASHES[id].hashes.length).toBeGreaterThan(0);
    expect(CATALYST_HASHES[id].name).toContain('Catalyst');
  });
});

describe('helpers', () => {
  it('iconUrl prefixes bungie.net and passes full URLs through', () => {
    expect(iconUrl('/common/destiny2_content/icons/a.jpg')).toBe(
      'https://www.bungie.net/common/destiny2_content/icons/a.jpg'
    );
    expect(iconUrl('https://example.test/x.png')).toBe('https://example.test/x.png');
    expect(iconUrl('')).toBe('');
  });

  it('slotLabel names the slots for people', () => {
    expect(slotLabel('kinetic')).toBe('Kinetic');
    expect(slotLabel('power')).toBe('Power');
    expect(slotLabel('gauntlets')).toBe('Gauntlets');
    expect(slotLabel('classitem')).toBe('Class item');
  });
});
