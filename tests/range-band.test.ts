// The research brief records a range band on nearly every damage check. The
// engine used to read only `range: 'far'` plus hand-written sword-unfriendly
// rules, so a point-blank exotic sword stayed in the answer at mid-far and
// mid fights nobody had got round to annotating. These tests pin the bands.

import { describe, expect, it } from 'vitest';
import { ACTIVITIES, type Encounter } from '../src/data/encounters';
import { buildEncounterAdjust } from '../src/encounter';
import { CURATED_BY_ID } from '../src/data/tiers';
import { DEMOTE_RANK_DELTA } from '../src/recommend';

const ERGO = CURATED_BY_ID.get('ergo-sum')!;

function allEncounters(): Encounter[] {
  return ACTIVITIES.flatMap((a) => a.encounters);
}

function byBand(band: string): Encounter[] {
  return allEncounters().filter((e) => e.range === band && e.specialRules.every((r) => r.id !== 'sword-unfriendly'));
}

describe('bands that put a sword out of reach', () => {
  it('excludes point-blank weapons at far range', () => {
    const far = byBand('far');
    expect(far.length).toBeGreaterThan(0);
    for (const encounter of far) {
      const reason = buildEncounterAdjust(encounter)!.exclude(ERGO);
      expect(reason, encounter.id).not.toBeNull();
      expect(reason!.ruleId).toBe('far-range');
    }
  });

  it('excludes point-blank weapons at mid-far range too', () => {
    const midFar = byBand('mid-far');
    expect(midFar.length).toBeGreaterThan(0);
    for (const encounter of midFar) {
      const reason = buildEncounterAdjust(encounter)!.exclude(ERGO);
      expect(reason, encounter.id).not.toBeNull();
      expect(reason!.text).toContain('mid-far');
    }
  });

  it('hedges the band the way the brief hedges it, never as verified fact', () => {
    const encounter = byBand('far')[0];
    const reason = buildEncounterAdjust(encounter)!.exclude(ERGO)!;
    expect(reason.text).toContain('community knowledge');
  });
});

describe('the band that only makes a sword awkward', () => {
  it('demotes point-blank weapons at mid range instead of excluding them', () => {
    const mid = byBand('mid');
    expect(mid.length).toBeGreaterThan(0);
    for (const encounter of mid) {
      const adjust = buildEncounterAdjust(encounter)!;
      expect(adjust.exclude(ERGO), encounter.id).toBeNull();
      expect(adjust.rankDelta(ERGO), encounter.id).toBe(DEMOTE_RANK_DELTA);
      expect(adjust.note(ERGO)!.ruleId).toBe('mid-range');
    }
  });

  it('leaves close and close-mid fights alone: a sword belongs there', () => {
    const close = allEncounters().filter(
      (e) => (e.range === 'close' || e.range === 'close-mid') && e.specialRules.every((r) => r.id !== 'sword-unfriendly')
    );
    expect(close.length).toBeGreaterThan(0);
    for (const encounter of close) {
      const adjust = buildEncounterAdjust(encounter);
      if (!adjust) continue;
      expect(adjust.exclude(ERGO), encounter.id).toBeNull();
      expect(adjust.rankDelta(ERGO), encounter.id).toBeLessThanOrEqual(0);
    }
  });

  it('never lets a mid-range demotion override a sourced sword bonus', () => {
    const crota = allEncounters().find((e) => e.id === 'crota')!;
    const adjust = buildEncounterAdjust(crota)!;
    expect(adjust.rankDelta(ERGO)).toBeLessThan(0);
    expect(adjust.note(ERGO)!.ruleId).toBe('sword-bonus');
  });
});
