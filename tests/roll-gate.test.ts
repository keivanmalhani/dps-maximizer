// The tier on several entries is explicitly the tier of a ROLL, not of the
// weapon: "the tier is for the Perfect Fifth roll specifically". The card
// said so from day one while the engine ranked on the bare tier anyway, so
// one exotic sword won almost every energy slot in the database regardless
// of what the player's copies actually rolled. These tests pin the fix.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '../fixtures/demo';
import { PERK_HASHES } from '../src/data/items';
import { CURATED_BY_ID } from '../src/data/tiers';
import { parseProfile, rollState } from '../src/ownership';
import {
  MISSING_ROLL_PENALTY,
  UNBUILDABLE_PENALTY,
  missingRollPenalty,
  recommend
} from '../src/recommend';
import type { PlayerData } from '../src/types';

const WITH_ROLL = parseProfile(buildDemoProfile());

/** The same vault with every Perfect Fifth plug filed off its sockets. */
function withoutPerfectFifth(): PlayerData {
  const strip = new Set(PERK_HASHES['The Perfect Fifth'] ?? []);
  expect(strip.size).toBeGreaterThan(0);
  return {
    ...WITH_ROLL,
    socketsByInstance: Object.fromEntries(
      Object.entries(WITH_ROLL.socketsByInstance).map(([id, plugs]) => [
        id,
        plugs.filter((hash) => !strip.has(hash))
      ])
    )
  };
}

describe('the penalty itself', () => {
  it('is worth about a tier and a half, and less than not owning the thing', () => {
    expect(MISSING_ROLL_PENALTY).toBeGreaterThan(1);
    expect(MISSING_ROLL_PENALTY).toBeLessThan(UNBUILDABLE_PENALTY);
  });

  it('drops a tier 1 below an intact tier 2 and keeps it above an intact tier 3', () => {
    expect(1 + MISSING_ROLL_PENALTY).toBeGreaterThan(2);
    expect(1 + MISSING_ROLL_PENALTY).toBeLessThan(3);
  });

  it('is zero for an item the sheet quotes no roll for', () => {
    const edgeTransit = CURATED_BY_ID.get('edge-transit')!;
    expect(edgeTransit.wantedRoll).toBeUndefined();
    expect(missingRollPenalty(edgeTransit, WITH_ROLL)).toBe(0);
  });

  it('is zero when the roll is present', () => {
    expect(rollState('ergo-sum', WITH_ROLL)).toBe('has-roll');
    expect(missingRollPenalty(CURATED_BY_ID.get('ergo-sum')!, WITH_ROLL)).toBe(0);
  });

  it('is zero for an UNKNOWN roll: an unreadable socket is not evidence', () => {
    const blind: PlayerData = { ...WITH_ROLL, socketsAvailable: false };
    expect(rollState('ergo-sum', blind)).toBe('unknown');
    expect(missingRollPenalty(CURATED_BY_ID.get('ergo-sum')!, blind)).toBe(0);
  });

  it('fires only for a roll the player is measurably missing', () => {
    const stripped = withoutPerfectFifth();
    expect(rollState('ergo-sum', stripped)).toBe('missing-roll');
    expect(missingRollPenalty(CURATED_BY_ID.get('ergo-sum')!, stripped)).toBe(MISSING_ROLL_PENALTY);
  });
});

describe('what the penalty does to the answer', () => {
  it('keeps the roll-tiered exotic when the player has the roll', () => {
    const energy = recommend(WITH_ROLL, 0, 'boss-burst').slots.find((s) => s.slot === 'energy')!;
    expect(energy.pick?.id).toBe('ergo-sum');
    expect(energy.rollNote).toBeNull();
  });

  it('hands the slot to the intact tier 2 when the roll is missing', () => {
    const energy = recommend(withoutPerfectFifth(), 0, 'boss-burst').slots.find(
      (s) => s.slot === 'energy'
    )!;
    expect(energy.pick?.id).toBe('still-hunt');
  });

  it('names the roll, the landing spot and the source, so the demotion is auditable', () => {
    const energy = recommend(withoutPerfectFifth(), 0, 'boss-burst').slots.find(
      (s) => s.slot === 'energy'
    )!;
    expect(energy.rollNote).toContain('Ergo Sum');
    expect(energy.rollNote).toContain('Perfect Fifth');
    expect(energy.rollNote).toContain('Still Hunt');
    expect(energy.rollNote).toContain(CURATED_BY_ID.get('ergo-sum')!.wantedRoll!.source);
  });

  it('never demotes below a weapon the player cannot build at all', () => {
    // Nothing owned: every pick is a target, and the roll gate must not
    // reshuffle targets, because a roll on a weapon you do not have is not
    // a measured fact.
    const empty: PlayerData = { ...WITH_ROLL, owned: {}, socketsByInstance: {} };
    const energy = recommend(empty, 0, 'boss-burst').slots.find((s) => s.slot === 'energy')!;
    expect(energy.pick?.id).toBe('ergo-sum');
    expect(energy.rollNote).toBeNull();
  });
});

describe('the pool-size note', () => {
  it('says so when the sourced pools leave a slot exactly one candidate', () => {
    const sustained = recommend(WITH_ROLL, 0, 'boss-sustained').slots;
    const noted = sustained.filter((s) => s.poolNote !== null);
    for (const slot of noted) {
      expect(slot.poolNote).toContain('exactly one');
      expect(slot.poolNote).toContain(slot.slot);
    }
  });

  it('stays quiet where the slot has a real choice', () => {
    const energy = recommend(WITH_ROLL, 0, 'boss-burst').slots.find((s) => s.slot === 'energy')!;
    // boss-burst energy has Ergo Sum and Still Hunt, so there is a choice.
    expect(energy.poolNote).toBeNull();
  });
});
