// The one-exotic rule, extended over the encounter-aware search. The v1
// property test proved random inventories never make recommend() illegal;
// this file proves the same for every damage encounter's adjusted pools AND
// for the alternative loadouts, over seeded random inventories that include
// the arsenal-demo instances (so the augmented profile shape rides along).

import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '../fixtures/demo';
import { ACTIVITIES, type Encounter, type EncounterActivity } from '../src/data/encounters';
import { BAKED_ITEMS } from '../src/data/items';
import { CURATED_BY_ID } from '../src/data/tiers';
import { recommendEncounter } from '../src/encounter';
import { parseProfile } from '../src/ownership';
import { alternativeLoadouts, type Pick } from '../src/recommend';
import type { GuardianClass, Owned } from '../src/types';
import { player } from './helpers';

const DAMAGE_ENCOUNTERS: Array<{ activity: EncounterActivity; encounter: Encounter }> = [];
for (const activity of ACTIVITIES) {
  for (const encounter of activity.encounters) {
    if (encounter.type !== 'none') DAMAGE_ENCOUNTERS.push({ activity, encounter });
  }
}

function isExoticId(id: string): boolean {
  return BAKED_ITEMS[id]?.tierType === 6;
}

/** Deterministic PRNG so a failing case reproduces from its seed. */
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

describe('seeded inventories stay legal on every encounter page', () => {
  const ids = Object.keys(BAKED_ITEMS);

  it('300 subsets x sampled encounters: verdict and alternatives obey the rule', () => {
    const rand = mulberry32(0xa7c0ffee);
    for (let round = 0; round < 300; round++) {
      const specs: Array<{ id: string; state: Owned }> = [];
      for (const id of ids) {
        const roll = rand();
        if (roll < 0.45) continue;
        specs.push({ id, state: roll < 0.65 ? 'collections' : 'instances' });
      }
      const data = player(specs);
      const classType = (round % 3) as GuardianClass;
      // Six encounters per round, deterministic, cycling the whole catalog.
      for (let k = 0; k < 6; k++) {
        const index = Math.floor(rand() * DAMAGE_ENCOUNTERS.length);
        const { activity, encounter } = DAMAGE_ENCOUNTERS[index];
        const label = 'seed 0xa7c0ffee round ' + round + ' ' + activity.id + '/' + encounter.id;
        const ev = recommendEncounter(data, classType, activity, encounter);
        const verdict = ev.verdict!;

        const picks = verdict.slots.map((s) => s.pick).filter((p): p is Pick => p !== null);
        const exotics = picks.filter((p) => isExoticId(p.id));
        expect(exotics.length, label + ' main').toBeLessThanOrEqual(1);
        for (const slot of verdict.slots) {
          if (!slot.pick) continue;
          expect(BAKED_ITEMS[slot.pick.id].slot, label + ' slot integrity').toBe(slot.slot);
          expect(
            CURATED_BY_ID.get(slot.pick.id)!.supportOnly ?? false,
            label + ' support stays out of slots'
          ).toBe(false);
        }

        for (const [altIndex, alt] of ev.alternatives.entries()) {
          const altExotics = alt.slots.filter(
            (s) => s.item !== null && isExoticId(s.item.id)
          );
          expect(altExotics.length, label + ' alt ' + altIndex).toBeLessThanOrEqual(1);
          for (const s of alt.slots) {
            if (s.item) expect(BAKED_ITEMS[s.item.id].slot, label + ' alt slot').toBe(s.slot);
          }
        }
      }
    }
  });

  it('alternatives are meaningfully different: never the winning exotic again', () => {
    const rand = mulberry32(0xdecafbad);
    for (let round = 0; round < 60; round++) {
      const specs: Array<{ id: string; state: Owned }> = [];
      for (const id of ids) {
        if (rand() < 0.5) specs.push({ id, state: 'instances' });
      }
      const data = player(specs);
      const { activity, encounter } =
        DAMAGE_ENCOUNTERS[Math.floor(rand() * DAMAGE_ENCOUNTERS.length)];
      const ev = recommendEncounter(data, 0, activity, encounter);
      const winnerExotic =
        ev
          .verdict!.slots.map((s) => s.pick)
          .filter((p): p is Pick => p !== null)
          .find((p) => isExoticId(p.id))?.id ?? null;
      const seen = new Set<string>([winnerExotic ?? 'none']);
      for (const alt of ev.alternatives) {
        const key = alt.equippedExoticId ?? 'none';
        expect(seen.has(key), activity.id + '/' + encounter.id + ' round ' + round).toBe(false);
        seen.add(key);
      }
    }
  });

  it('the demo profile, arsenal instances included, is legal on every encounter', () => {
    const data = parseProfile(buildDemoProfile());
    for (const { activity, encounter } of DAMAGE_ENCOUNTERS) {
      for (const classType of [0, 1, 2] as GuardianClass[]) {
        const ev = recommendEncounter(data, classType, activity, encounter);
        const picks = ev
          .verdict!.slots.map((s) => s.pick)
          .filter((p): p is Pick => p !== null);
        expect(
          picks.filter((p) => isExoticId(p.id)).length,
          activity.id + '/' + encounter.id + '/' + classType
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it('generic-mode alternatives obey the rule too', () => {
    const rand = mulberry32(0x5eed);
    for (let round = 0; round < 40; round++) {
      const specs: Array<{ id: string; state: Owned }> = [];
      for (const id of ids) {
        if (rand() < 0.55) specs.push({ id, state: 'instances' });
      }
      const data = player(specs);
      for (const mode of ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'] as const) {
        for (const alt of alternativeLoadouts(mode, data)) {
          const exotics = alt.slots.filter((s) => s.item !== null && isExoticId(s.item.id));
          expect(exotics.length, mode + ' round ' + round).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
