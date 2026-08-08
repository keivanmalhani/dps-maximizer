// The cheat sheet data: the four buckets, the verified numbers, the pending
// label where the numbers are not verified, and the myths.

import { describe, expect, it } from 'vitest';
import { BUCKETS, BUFFS_SOURCE, MYTHS, ODDITIES, PENDING_NOTE } from '../src/data/buffs';
import { championNote, CHAMPIONS_SOURCE, FRAME_STUNS } from '../src/data/champions';
import { ARMOR_STATS_SOURCE, POWERHOUSE_NOTE, STAT_EFFECTS } from '../src/data/armor-stats';

describe('the four buckets', () => {
  it('there are exactly four, in the canonical order', () => {
    expect(BUCKETS.map((b) => b.id)).toEqual(['empowering', 'surges', 'perks', 'debuffs']);
  });

  it('empowering buffs do not stack and the exception is named', () => {
    const bucket = BUCKETS[0];
    expect(bucket.rule).toContain('Do not stack');
    expect(bucket.detail).toContain('35 percent');
    expect(bucket.detail).toContain('No Hesitation');
    expect(bucket.detail).toContain('universally stackable');
  });

  it('surges do not stack within an element and their table is pending', () => {
    const bucket = BUCKETS[1];
    expect(bucket.rule).toContain('within an element');
    expect(bucket.detail).toContain('pending');
  });

  it('weapon perks multiply with everything', () => {
    expect(BUCKETS[2].rule).toContain('multiplicatively');
  });

  it('debuffs are one per enemy, highest wins, with the verified 30', () => {
    const bucket = BUCKETS[3];
    expect(bucket.rule).toContain('One per enemy');
    expect(bucket.detail).toContain('30 percent');
    expect(bucket.detail).toContain('verified');
  });

  it('every bucket ships worked examples', () => {
    for (const bucket of BUCKETS) expect(bucket.examples.length).toBeGreaterThan(0);
  });

  it('the pending note names what is pending and why numbers are absent', () => {
    expect(PENDING_NOTE).toContain('pending');
    expect(PENDING_NOTE).toContain('June-2026 transcription');
    expect(PENDING_NOTE).toContain('not zero');
  });

  it('the source is stated', () => {
    expect(BUFFS_SOURCE).toContain('Aegis');
  });
});

describe('oddities and myths', () => {
  it('the Well versus Golden Gun oddity is a card of its own', () => {
    const card = ODDITIES.find((c) => c.id === 'well-overrides-golden-gun')!;
    expect(card.body).toContain('LESS damage');
    expect(card.body).toContain('Stand outside the Well');
  });

  it('the debuff refresh card says what works and what does not', () => {
    const card = ODDITIES.find((c) => c.id === 'debuff-refresh')!;
    expect(card.body).toContain('Echo of Undermining');
    expect(card.body).toContain('Snare Bomb');
    expect(card.body).toContain('NOT work with Tether');
  });

  it('the frontload myth is debunked with the testing that did it', () => {
    const myth = MYTHS.find((m) => m.id === 'frontload')!;
    expect(myth.body).toContain('Verified false');
    expect(myth.body).toContain('every raid and dungeon boss');
  });

  it('the FPS myth is debunked flatly', () => {
    const myth = MYTHS.find((m) => m.id === 'fps')!;
    expect(myth.body).toContain('Verified false');
  });

  it('every card carries its source', () => {
    for (const card of [...ODDITIES, ...MYTHS]) expect(card.source.length).toBeGreaterThan(4);
  });
});

describe('the champion mapping', () => {
  it('is exactly the six frames the dev insight names', () => {
    expect([...FRAME_STUNS.keys()].sort()).toEqual(
      [
        'Adaptive Frame',
        'Aggressive Frame',
        'High-Impact Frame',
        'Lightweight Frame',
        'Precision Frame',
        'Rapid-Fire Frame'
      ].sort()
    );
  });

  it('maps to the stuns the insight gives', () => {
    expect(FRAME_STUNS.get('Aggressive Frame')).toBe('Unstoppable');
    expect(FRAME_STUNS.get('High-Impact Frame')).toBe('Unstoppable');
    expect(FRAME_STUNS.get('Precision Frame')).toBe('Barrier');
    expect(FRAME_STUNS.get('Adaptive Frame')).toBe('Barrier');
    expect(FRAME_STUNS.get('Lightweight Frame')).toBe('Overload');
    expect(FRAME_STUNS.get('Rapid-Fire Frame')).toBe('Overload');
  });

  it('a mapped frame produces a plain stun label', () => {
    const note = championNote('Rapid-Fire Frame');
    expect(note.stuns).toBe('Overload');
    expect(note.label).toBe('Stuns Overload (Rapid-Fire Frame)');
  });

  it('an unmapped exotic intrinsic is pending, not guessed', () => {
    const note = championNote('Wolfpack Rounds');
    expect(note.stuns).toBeNull();
    expect(note.label).toContain('community testing pending');
    expect(note.label).toContain('Wolfpack Rounds');
  });

  it('an unknown frame is unknown', () => {
    const note = championNote(null);
    expect(note.stuns).toBeNull();
    expect(note.label).toContain('unknown');
  });

  it('cites the dev insight', () => {
    expect(CHAMPIONS_SOURCE).toBe('Bungie dev insight 2026-05-29');
  });
});

describe('Armor 3.0 stat effects', () => {
  it('covers all six stats', () => {
    expect(STAT_EFFECTS.map((e) => e.stat).sort()).toEqual(
      ['Class', 'Grenade', 'Health', 'Melee', 'Super', 'Weapons'].sort()
    );
  });

  it('keeps the published ceilings and no invented curve points', () => {
    const weapons = STAT_EFFECTS.find((e) => e.stat === 'Weapons')!;
    expect(weapons.effect).toContain('15%');
    expect(STAT_EFFECTS.find((e) => e.stat === 'Grenade')!.effect).toContain('65%');
    expect(STAT_EFFECTS.find((e) => e.stat === 'Super')!.effect).toContain('45%');
    expect(STAT_EFFECTS.find((e) => e.stat === 'Melee')!.effect).toContain('30%');
  });

  it('marks which stats are damage stats', () => {
    const damage = STAT_EFFECTS.filter((e) => e.damageStat).map((e) => e.stat);
    expect(damage.sort()).toEqual(['Grenade', 'Melee', 'Super', 'Weapons'].sort());
  });

  it('recommends the Powerhouse archetype for damage builds', () => {
    expect(POWERHOUSE_NOTE).toContain('Powerhouse');
    expect(POWERHOUSE_NOTE).toContain('Weapons and Super');
  });

  it('cites the publication', () => {
    expect(ARMOR_STATS_SOURCE).toBe('Bungie/PC Gamer 2025-07-14');
  });
});
