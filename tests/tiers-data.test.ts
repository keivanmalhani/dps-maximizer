// The curated dataset's own discipline, enforced. Every entry must carry a
// source, quotes must be real quotes, and the honesty rules are not allowed
// to erode one commit at a time.

import { describe, expect, it } from 'vitest';
import {
  CATALYST_IDS,
  CURATED,
  CURATED_BY_ID,
  DATA_STAMP,
  TIER_SOURCE,
  WANTED_PERK_NAMES
} from '../src/data/tiers';

const ids = CURATED.map((item) => item.id);

describe('the dataset as a whole', () => {
  it('has unique ids', () => {
    expect(new Set(ids).size).toBe(CURATED.length);
  });

  it('covers all four tiers', () => {
    for (const tier of [1, 2, 3, 4]) {
      expect(CURATED.some((item) => item.tier === tier), 'tier ' + tier).toBe(true);
    }
  });

  it('keeps the seven tier 1 entries the sheet names, in its order', () => {
    expect(CURATED.filter((item) => item.tier === 1).map((item) => item.id)).toEqual([
      'hezen-vengeance',
      'cuirass-of-the-falling-star',
      'celestial-nighthawk',
      'ergo-sum',
      'sanguine-alchemy',
      'tractor-cannon',
      'gjallarhorn'
    ]);
  });

  it('carries the frozen-game stamp with the exact dates', () => {
    expect(DATA_STAMP).toBe(
      'Data current as of Update 9.7.0.4, 28 July 2026. The game no longer receives balance patches, so this does not go stale.'
    );
  });

  it('names the tier source with its date', () => {
    expect(TIER_SOURCE).toBe('Aegis boss damage sheet, equipment tab, 2026-07');
  });

  it('never invents a decimal DPS number anywhere in the dataset', () => {
    // Percentages that survived verification are allowed; a made-up
    // "1234.5 DPS" style figure is not, and neither is the word DPS with a
    // number attached.
    for (const item of CURATED) {
      const text = (item.quote ?? '') + ' ' + item.note;
      expect(text).not.toMatch(/\d+(\.\d+)?\s*DPS/i);
    }
  });

  it('recommends nothing for PvP, which is out of scope', () => {
    for (const item of CURATED) {
      expect(item.roles, item.id).not.toContain('pvp');
    }
  });
});

describe.each(CURATED.map((item) => [item.id, item] as const))('%s', (_id, item) => {
  it('carries a source', () => {
    expect(item.source.length).toBeGreaterThan(4);
  });

  it('has an honest note in plain words', () => {
    expect(item.note.length).toBeGreaterThan(10);
  });

  it('has at least one role', () => {
    expect(item.roles.length).toBeGreaterThan(0);
  });

  it('has a concrete acquisition path', () => {
    expect(item.acquisition.length).toBeGreaterThan(10);
  });

  it('labels its tier the way it is ranked', () => {
    if (item.tier !== null) {
      expect(item.tierLabel).toBe('Tier ' + item.tier);
    } else {
      expect(item.tierLabel).not.toMatch(/^Tier \d$/);
    }
  });

  it('is ASCII only', () => {
    const text = JSON.stringify(item);
    expect(/^[\x20-\x7e]*$/.test(text)).toBe(true);
  });
});

describe('quotes', () => {
  const quoted = CURATED.filter((item) => item.quote !== null);

  it('exist for the entries the sheet annotated', () => {
    expect(quoted.length).toBeGreaterThanOrEqual(20);
  });

  it.each(quoted.map((item) => [item.id, item] as const))(
    '%s quote is short and does not editorialise',
    (_id, item) => {
      expect(item.quote!.length).toBeGreaterThan(5);
      // A quote is the sheet's sentence, not a paragraph of ours.
      expect(item.quote!.length).toBeLessThan(120);
    }
  );

  it('keeps the exact tier 1 annotations', () => {
    expect(CURATED_BY_ID.get('hezen-vengeance')!.quote).toBe('Best general burst damage.');
    expect(CURATED_BY_ID.get('cuirass-of-the-falling-star')!.quote).toBe(
      'Zero effort for best damage super in the game'
    );
    expect(CURATED_BY_ID.get('celestial-nighthawk')!.quote).toBe(
      'Solid damage super with great ranged burst'
    );
    expect(CURATED_BY_ID.get('ergo-sum')!.quote).toBe('Best sword damage when Transcendent');
    expect(CURATED_BY_ID.get('sanguine-alchemy')!.quote).toBe(
      'Best damage armor exotic, free 10% for doing nothing.'
    );
    expect(CURATED_BY_ID.get('tractor-cannon')!.quote).toBe('Easiest long-term 30% debuff source');
    expect(CURATED_BY_ID.get('gjallarhorn')!.quote).toBe('Exists to augment Hezen users.');
  });

  it('keeps the tier 2 annotations that carry verified numbers', () => {
    expect(CURATED_BY_ID.get('lumina')!.quote).toBe('35% damage buff');
    expect(CURATED_BY_ID.get('no-hesitation')!.quote).toBe('10% universally stackable buff');
    expect(CURATED_BY_ID.get('edge-transit')!.quote).toBe(
      'Highest legendary burst DPS in the game (with stickies)'
    );
    expect(CURATED_BY_ID.get('vs-chill-inhibitor')!.quote).toBe('Worse off thanks to HGL nerf');
  });

  it('marks unannotated entries as unannotated instead of inventing praise', () => {
    for (const item of CURATED.filter((i) => i.quote === null && i.tier !== null)) {
      expect(item.note, item.id).toContain('no annotation quoted');
    }
  });
});

describe('specific honesty commitments', () => {
  it('Hezen wants the exact roll columns the sheet gives', () => {
    const roll = CURATED_BY_ID.get('hezen-vengeance')!.wantedRoll!;
    expect(roll.columns).toEqual([
      ['Overflow', 'Envious Assassin'],
      ['Bait and Switch', 'Cluster Bomb', 'Elemental Honing']
    ]);
  });

  it('Ergo Sum wants The Perfect Fifth, as the manifest spells it', () => {
    expect(CURATED_BY_ID.get('ergo-sum')!.wantedRoll!.columns).toEqual([['The Perfect Fifth']]);
  });

  it('collects exactly the perk names the rolls reference', () => {
    expect([...WANTED_PERK_NAMES].sort()).toEqual(
      [
        'Overflow',
        'Envious Assassin',
        'Bait and Switch',
        'Cluster Bomb',
        'Elemental Honing',
        'The Perfect Fifth'
      ].sort()
    );
  });

  it('flags the support jobs as support, not personal damage slots', () => {
    for (const id of ['tractor-cannon', 'lumina', 'no-hesitation', 'divinity', 'briarbinds']) {
      expect(CURATED_BY_ID.get(id)!.supportOnly, id).toBe(true);
    }
  });

  it('never marks a damage pick as support', () => {
    for (const id of ['hezen-vengeance', 'edge-transit', 'the-queenbreaker', 'still-hunt']) {
      expect(CURATED_BY_ID.get(id)!.supportOnly ?? false, id).toBe(false);
    }
  });

  it('hard-codes the Divinity Pantheon warning into its note', () => {
    const divinity = CURATED_BY_ID.get('divinity')!;
    expect(divinity.note).toContain('disabled entirely on Pantheon');
    expect(divinity.note).toContain('Insurrection Prime');
    expect(divinity.note).toContain('9.7.0.3');
  });

  it('says which catalysts matter, and only reads those', () => {
    expect(CATALYST_IDS.sort()).toEqual(
      ['grand-overture', 'izanagis-burden', 'outbreak-perfected', 'whisper-of-the-worm'].sort()
    );
  });

  it('marks the Monument purchases and no others as cipher-buyable', () => {
    const monument = CURATED.filter((item) => item.monument).map((item) => item.id);
    expect(monument.sort()).toEqual(
      [
        'anarchy',
        'grand-overture',
        'izanagis-burden',
        'lumina',
        'one-thousand-voices',
        'the-queenbreaker',
        'thunderlord',
        'witherhoard'
      ].sort()
    );
  });

  it('tells legendaries apart from exotics for the Collections rule', () => {
    expect(CURATED_BY_ID.get('hezen-vengeance')!.exotic).toBe(false);
    expect(CURATED_BY_ID.get('edge-transit')!.exotic).toBe(false);
    expect(CURATED_BY_ID.get('praedyths-revenge')!.exotic).toBe(false);
    expect(CURATED_BY_ID.get('apex-predator')!.exotic).toBe(false);
    expect(CURATED_BY_ID.get('vs-chill-inhibitor')!.exotic).toBe(false);
    // The manifest says No Hesitation is a Legendary; the bake caught this
    // when a human assumption said otherwise.
    expect(CURATED_BY_ID.get('no-hesitation')!.exotic).toBe(false);
    expect(CURATED_BY_ID.get('gjallarhorn')!.exotic).toBe(true);
  });

  it('quotes the Gjallarhorn pairing with its verified range and source', () => {
    const pairing = CURATED_BY_ID.get('hezen-vengeance')!.pairing!;
    expect(pairing.withId).toBe('gjallarhorn');
    expect(pairing.note).toContain('25 to 30 percent');
    expect(pairing.source).toBe('Aegis FAQ');
  });

  it('keeps Shards of Galanor off the tier ladder and on the dev insight', () => {
    const shards = CURATED_BY_ID.get('shards-of-galanor')!;
    expect(shards.tier).toBeNull();
    expect(shards.tierLabel).toBe('Reworked in 9.7.0');
    expect(shards.source).toContain('2026-06-04');
  });
});
