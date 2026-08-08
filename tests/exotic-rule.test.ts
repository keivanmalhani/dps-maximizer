// The one-exotic rule, pinned. Destiny equips at most ONE exotic weapon
// across the three slots and at most one exotic armor piece; this file
// proves the engine can no longer say otherwise, whatever the inventory.
//
// Rarity in these assertions comes from items.json tierType (6 = exotic,
// 5 = legendary), the same manifest fact the engine reads, so nobody's
// memory of what is exotic can pass or fail a test.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '../fixtures/demo';
import { BAKED_ITEMS } from '../src/data/items';
import { ENVIOUS_LOOP, TWO_VS_THREE } from '../src/data/rotations';
import { CURATED, CURATED_BY_ID } from '../src/data/tiers';
import { parseProfile } from '../src/ownership';
import {
  EMPTY_SLOT_QUALITY,
  UNBUILDABLE_PENALTY,
  assertLegalExotics,
  compareLoadouts,
  recommend,
  scoreLoadout,
  slotQuality,
  type ComboSlot,
  type Pick,
  type Verdict
} from '../src/recommend';
import type { Activity, GuardianClass, Owned } from '../src/types';
import { ownsEverything, player } from './helpers';

const PVE: Activity[] = ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'];
const CLASSES: GuardianClass[] = [0, 1, 2];

function isExoticId(id: string): boolean {
  return BAKED_ITEMS[id]?.tierType === 6;
}

function weaponPicks(verdict: Verdict): Pick[] {
  return verdict.slots.map((s) => s.pick).filter((p): p is Pick => p !== null);
}

/** The legality every verdict must satisfy, checked from items.json facts. */
function expectLegal(verdict: Verdict, classType: GuardianClass, label: string): void {
  const picks = weaponPicks(verdict);
  const exoticWeapons = picks.filter((p) => isExoticId(p.id));
  expect(exoticWeapons.length, label + ': exotic weapons ' + exoticWeapons.map((p) => p.name).join(' + ')).toBeLessThanOrEqual(1);

  for (const slot of verdict.slots) {
    if (!slot.pick) continue;
    const baked = BAKED_ITEMS[slot.pick.id];
    expect(baked, label + ': ' + slot.pick.id + ' is baked').toBeDefined();
    expect(baked.kind, label + ': ' + slot.pick.id + ' kind').toBe('weapon');
    expect(baked.slot, label + ': ' + slot.pick.id + ' slot').toBe(slot.slot);
    expect(
      CURATED_BY_ID.get(slot.pick.id)!.supportOnly ?? false,
      label + ': ' + slot.pick.id + ' is a fireteam job, not a personal slot'
    ).toBe(false);
  }

  const armor = verdict.armor ? [verdict.armor] : [];
  const exoticArmor = armor.filter((p) => isExoticId(p.id));
  expect(exoticArmor.length, label + ': exotic armor').toBeLessThanOrEqual(1);
  for (const piece of armor) {
    const baked = BAKED_ITEMS[piece.id];
    expect(baked.kind, label + ': armor kind').toBe('armor');
    expect(baked.classType, label + ': armor class').toBe(classType);
  }

  // The rotation must be achievable by this exact legal loadout: the
  // kinetic-anchored plans only when their anchor made the cut, and any
  // weapon named in a rotation title present among the picks.
  const rotation = verdict.rotation;
  if (rotation) {
    const kinetic = verdict.slots.find((s) => s.slot === 'kinetic')?.pick?.id ?? null;
    if (rotation.title === TWO_VS_THREE.title) {
      expect(kinetic, label + ': Izanagi plan without Izanagi').toBe('izanagis-burden');
    }
    if (rotation.title === ENVIOUS_LOOP.title) {
      expect(kinetic, label + ': Envious loop without Witherhoard').toBe('witherhoard');
    }
    const pickNames = new Set(picks.map((p) => p.name));
    for (const item of CURATED) {
      if (item.kind === 'weapon' && rotation.title.includes(item.name)) {
        expect(pickNames.has(item.name), label + ': rotation titled around ' + item.name + ' which is not in the loadout').toBe(true);
      }
    }
  }
}

// --------------------------------------------------------- scoring, exposed

describe('slotQuality, the number the tie-break runs on', () => {
  const ergo = CURATED_BY_ID.get('ergo-sum')!; // tier 1
  const apex = CURATED_BY_ID.get('apex-predator')!; // tier 3
  const whisper = CURATED_BY_ID.get('whisper-of-the-worm')!; // tier 4

  it('a buildable pick scores its tier rank', () => {
    expect(slotQuality(ergo, true)).toBe(1);
    expect(slotQuality(apex, true)).toBe(3);
  });

  it('an unbuildable target carries the flat penalty', () => {
    expect(slotQuality(ergo, false)).toBe(1 + UNBUILDABLE_PENALTY);
  });

  it('any buildable pick beats any unbuildable target', () => {
    expect(slotQuality(whisper, true)).toBeLessThan(slotQuality(ergo, false));
  });

  it('an empty slot is worse than the worst real pick', () => {
    expect(slotQuality(null, false)).toBe(EMPTY_SLOT_QUALITY);
    expect(slotQuality(whisper, false)).toBeLessThan(EMPTY_SLOT_QUALITY);
  });
});

describe('scoreLoadout and compareLoadouts, the tie-break in the open', () => {
  const praedyth = CURATED_BY_ID.get('praedyths-revenge')!; // kinetic, tier 2
  const ergo = CURATED_BY_ID.get('ergo-sum')!; // energy, tier 1
  const hezen = CURATED_BY_ID.get('hezen-vengeance')!; // power, tier 1
  const gjally = CURATED_BY_ID.get('gjallarhorn')!; // power, tier 1
  const apex = CURATED_BY_ID.get('apex-predator')!; // power, tier 3

  const combo = (k: ComboSlot['item'], kb: boolean, e: ComboSlot['item'], eb: boolean, p: ComboSlot['item'], pb: boolean): ComboSlot[] => [
    { slot: 'kinetic', item: k, buildable: kb },
    { slot: 'energy', item: e, buildable: eb },
    { slot: 'power', item: p, buildable: pb }
  ];

  it('sums the slot qualities and counts what is buildable', () => {
    const score = scoreLoadout(combo(praedyth, true, ergo, true, apex, true));
    expect(score.buildableCount).toBe(3);
    expect(score.totalQuality).toBe(2 + 1 + 3);
  });

  it('the centerpiece is the power pick when there is one, else kinetic', () => {
    expect(scoreLoadout(combo(praedyth, true, ergo, true, apex, true)).centerpieceQuality).toBe(3);
    expect(scoreLoadout(combo(praedyth, true, ergo, true, null, false)).centerpieceQuality).toBe(2);
    expect(scoreLoadout(combo(null, false, ergo, true, null, false)).centerpieceQuality).toBe(1);
  });

  it('buildable count outranks summed quality: a loadout you can field wins', () => {
    // One owned Witherhoard and two empty slots against three tier 1 and 2
    // targets on paper: the paper loadout sums better, the fieldable one
    // still wins, because the product is what you can build right now.
    const witherhoard = CURATED_BY_ID.get('witherhoard')!; // kinetic, tier 3
    const canField = scoreLoadout(combo(witherhoard, true, null, false, null, false));
    const paperOnly = scoreLoadout(combo(praedyth, false, ergo, false, hezen, false));
    expect(paperOnly.totalQuality).toBeLessThan(canField.totalQuality);
    expect(compareLoadouts(canField, paperOnly)).toBeGreaterThan(0);
  });

  it('the demo trade, in numbers: exotic in energy beats exotic in power', () => {
    // Keep Ergo Sum: energy filled, power falls to Apex. Keep Gjallarhorn:
    // power tier 1, but energy has no legendary at all and goes empty.
    const keepErgo = scoreLoadout(combo(praedyth, true, ergo, true, apex, true));
    const keepGjally = scoreLoadout(combo(praedyth, true, null, false, gjally, true));
    expect(compareLoadouts(keepErgo, keepGjally)).toBeGreaterThan(0);
  });

  it('on equal counts and sums the stronger centerpiece wins', () => {
    // Same buildable count, same summed quality; one loadout holds its
    // strength in the power slot, where the rotation dumps damage.
    const witherhoard = CURATED_BY_ID.get('witherhoard')!; // kinetic, tier 3
    const edge = CURATED_BY_ID.get('edge-transit')!; // power, tier 2
    const strongPower = scoreLoadout(combo(witherhoard, true, null, false, hezen, true));
    const weakPower = scoreLoadout(combo(praedyth, true, null, false, edge, true));
    expect(strongPower.buildableCount).toBe(weakPower.buildableCount);
    expect(strongPower.totalQuality).toBe(weakPower.totalQuality);
    expect(compareLoadouts(strongPower, weakPower)).toBeGreaterThan(0);
    expect(compareLoadouts(weakPower, strongPower)).toBeLessThan(0);
  });
});

describe('assertLegalExotics, the door check', () => {
  it('throws on two exotic weapons and names them', () => {
    const verdictA = recommend(parseProfile(buildDemoProfile()), 0, 'boss-burst');
    const ergo = weaponPicks(verdictA).find((p) => p.id === 'ergo-sum')!;
    const fakeGjally = { ...ergo, id: 'gjallarhorn', name: 'Gjallarhorn' };
    expect(() => assertLegalExotics([ergo, fakeGjally], [])).toThrow(/Ergo Sum \+ Gjallarhorn/);
    expect(() => assertLegalExotics([ergo], [])).not.toThrow();
  });
});

// ------------------------------------------------- the regression pair

describe('the live-site regression: Ergo Sum plus Gjallarhorn', () => {
  const demo = parseProfile(buildDemoProfile());

  it('Hunter and Titan boss burst never show both exotics', () => {
    for (const classType of [1, 0] as GuardianClass[]) {
      const verdict = recommend(demo, classType, 'boss-burst');
      const ids = weaponPicks(verdict).map((p) => p.id);
      expect(ids.includes('ergo-sum') && ids.includes('gjallarhorn'), 'class ' + classType).toBe(false);
      expectLegal(verdict, classType, 'demo/' + classType + '/boss-burst');
    }
  });

  it('the displaced card explains the exclusivity, in words', () => {
    for (const classType of [1, 0] as GuardianClass[]) {
      const verdict = recommend(demo, classType, 'boss-burst');
      const power = verdict.slots.find((s) => s.slot === 'power')!;
      expect(power.pick!.id).toBe('apex-predator');
      expect(power.exclusivityNote).toContain('Gjallarhorn is the best power pick you own');
      expect(power.exclusivityNote).toContain('you can only equip one exotic weapon');
      expect(power.exclusivityNote).toContain('this loadout\'s exotic is Ergo Sum');
      expect(power.exclusivityNote).toContain('the best legendary here is Apex Predator (Tier 3)');
    }
  });

  it('boss sustained gives the seat to Thunderlord and empties energy honestly', () => {
    const verdict = recommend(demo, 0, 'boss-sustained');
    const bySlot = new Map(verdict.slots.map((s) => [s.slot, s]));
    expect(bySlot.get('power')!.pick!.id).toBe('thunderlord');
    const energy = bySlot.get('energy')!;
    expect(energy.pick).toBeNull();
    expect(energy.exclusivityNote).toContain('Cloudstrike is the best energy pick you own');
    expect(energy.exclusivityNote).toContain('run whichever energy weapon you like');
    expectLegal(verdict, 0, 'demo/0/boss-sustained');
  });
});

// -------------------------------------- the two ends of the ownership curve

describe('owns everything: the ceiling loadout is legal too', () => {
  it('is legal for every class and PvE activity', () => {
    for (const classType of CLASSES) {
      for (const activity of PVE) {
        expectLegal(recommend(ownsEverything(), classType, activity), classType, 'all/' + classType + '/' + activity);
      }
    }
  });

  it('boss burst keeps Ergo Sum as the one exotic beside two legendaries', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    const ids = verdict.slots.map((s) => s.pick?.id ?? null);
    expect(ids).toEqual(['praedyths-revenge', 'ergo-sum', 'hezen-vengeance']);
  });

  it('boss sustained spends the exotic on the power slot, sheet order intact', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-sustained');
    const bySlot = new Map(verdict.slots.map((s) => [s.slot, s]));
    expect(bySlot.get('power')!.pick!.id).toBe('the-queenbreaker');
    expect(bySlot.get('kinetic')!.pick!.id).toBe('praedyths-revenge');
    expect(bySlot.get('energy')!.pick).toBeNull();
    expect(bySlot.get('energy')!.exclusivityNote).toContain('Cloudstrike');
  });
});

describe('owns nothing: the target build shown to a new player is legal', () => {
  it('is legal for every class and PvE activity', () => {
    for (const classType of CLASSES) {
      for (const activity of PVE) {
        const verdict = recommend(player([]), classType, activity);
        expectLegal(verdict, classType, 'none/' + classType + '/' + activity);
      }
    }
  });

  it('the boss burst target is Praedyth, Ergo Sum, Hezen: one exotic', () => {
    const verdict = recommend(player([]), 0, 'boss-burst');
    expect(verdict.headline).toContain('You own none of this yet');
    expect(verdict.slots.map((s) => s.pick?.id ?? null)).toEqual([
      'praedyths-revenge',
      'ergo-sum',
      'hezen-vengeance'
    ]);
  });

  it('the sustained target explains the emptied slot in the sheet voice', () => {
    const verdict = recommend(player([]), 0, 'boss-sustained');
    const energy = verdict.slots.find((s) => s.slot === 'energy')!;
    expect(energy.pick).toBeNull();
    expect(energy.exclusivityNote).toContain('Cloudstrike is the sheet\'s energy pick');
    expect(energy.exclusivityNote).toContain('The Queenbreaker');
  });
});

// ----------------------------------------------- fireteam jobs stay jobs

describe('debuff exotics ride with a teammate, never displace your exotic', () => {
  it('owning Divinity and Tractor never puts them in your slots', () => {
    const data = player(['the-queenbreaker', 'divinity', 'tractor-cannon']);
    const verdict = recommend(data, 0, 'boss-sustained');
    const ids = weaponPicks(verdict).map((p) => p.id);
    expect(ids).not.toContain('divinity');
    expect(ids).not.toContain('tractor-cannon');
    // Your own damage exotic keeps its seat...
    expect(verdict.slots.find((s) => s.slot === 'power')!.pick!.id).toBe('the-queenbreaker');
    // ...and the debuffs appear in the fireteam section instead.
    const notes = verdict.fireteamNotes.map((n) => n.id);
    expect(notes).toContain('tractor-cannon');
    expect(notes).toContain('divinity');
  });
});

// ------------------------------------------------------- the property test

/** Deterministic PRNG so a failing subset reproduces from its seed. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('seeded random inventories never produce an illegal loadout', () => {
  const ids = Object.keys(BAKED_ITEMS);

  it('300 subsets x 3 classes x 4 activities stay legal', () => {
    const rand = mulberry32(0x1ceb00da);
    for (let round = 0; round < 300; round++) {
      const specs: Array<{ id: string; state: Owned }> = [];
      for (const id of ids) {
        const roll = rand();
        if (roll < 0.45) continue; // not owned
        specs.push({ id, state: roll < 0.65 ? 'collections' : 'instances' });
      }
      const data = player(specs);
      for (const classType of CLASSES) {
        for (const activity of PVE) {
          const label = 'seed 0x1ceb00da round ' + round + ' ' + classType + '/' + activity;
          expectLegal(recommend(data, classType, activity), classType, label);
        }
      }
    }
  });
});
