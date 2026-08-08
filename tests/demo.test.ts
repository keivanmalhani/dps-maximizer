// The demo account has one job: make the page work signed out without lying
// about being real. These tests keep it flagged, plausible and exercising
// the real parser.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile, DEMO_CIPHERS, DEMO_FLAG_LINE, DEMO_PLAYER } from '../fixtures/demo';
import { formatBungieName } from '../src/bungie';
import { catalystState, parseProfile, rollState } from '../src/ownership';
import { recommend } from '../src/recommend';

const data = parseProfile(buildDemoProfile());

describe('the flag', () => {
  it('says the account is invented, in words', () => {
    expect(DEMO_FLAG_LINE).toContain('invented account');
    expect(DEMO_FLAG_LINE).toContain('No such player exists');
  });

  it('formats as a plausible Bungie name', () => {
    expect(formatBungieName(DEMO_PLAYER)).toBe('Meridian#0404');
  });
});

describe('the demo vault through the real parser', () => {
  it('has all three classes so the picker is complete', () => {
    expect(data.characters.map((c) => c.classType).sort()).toEqual([0, 1, 2]);
  });

  it('every character carries Armor 3.0 stats', () => {
    for (const character of data.characters) {
      expect(character.stats.Weapons).toBeGreaterThan(0);
      expect(character.stats.Super).toBeGreaterThan(0);
    }
  });

  it('counts the demo ciphers', () => {
    expect(data.ciphers).toBe(DEMO_CIPHERS);
  });

  it('owns solid tier 2 and 3 gear as instances', () => {
    for (const id of ['gjallarhorn', 'thunderlord', 'praedyths-revenge', 'witherhoard']) {
      expect(data.owned[id].state, id).toBe('instances');
    }
  });

  it('holds Cuirass and Tractor in Collections only, the pullable kind', () => {
    expect(data.owned['cuirass-of-the-falling-star'].state).toBe('collections');
    expect(data.owned['tractor-cannon'].state).toBe('collections');
  });

  it('holds Edge Transit in Collections, the kind that does not come back', () => {
    expect(data.owned['edge-transit'].state).toBe('collections');
  });

  it('is missing the tier 1 rocket on purpose', () => {
    expect(data.owned['hezen-vengeance'].state).toBe('none');
  });

  it('has the Perfect Fifth Ergo Sum', () => {
    expect(rollState('ergo-sum', data)).toBe('has-roll');
  });

  it('has the Izanagi catalyst slotted and the Whisper catalyst empty', () => {
    expect(catalystState('izanagis-burden', data)).toBe('slotted');
    expect(catalystState('whisper-of-the-worm', data)).toBe('not-slotted');
  });
});

describe('the demo verdicts', () => {
  it('Titan boss burst picks the owned rocket and names the Hezen gap', () => {
    const verdict = recommend(data, 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.id).toBe('gjallarhorn');
    expect(power.idealNote).toContain('Hezen Vengeance');
  });

  it('the demo next unlock is Hezen Vengeance, with its raid path', () => {
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.nextUnlock!.id).toBe('hezen-vengeance');
    expect(verdict.nextUnlock!.acquisition).toContain('Vault of Glass');
  });

  it('the demo cipher pointer names The Queenbreaker', () => {
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.cipherLine).toContain('3 Exotic Ciphers');
    expect(verdict.cipherLine).toContain('The Queenbreaker');
  });

  it('the demo Hunter gets Celestial, Golden Gun and the Well warning', () => {
    const verdict = recommend(data, 1, 'boss-burst');
    expect(verdict.armor!.id).toBe('celestial-nighthawk');
    expect(verdict.superRec!.superName).toBe('Golden Gun');
    expect(verdict.warnings.some((w) => w.id === 'well-overrides-golden-gun')).toBe(true);
  });

  it('the demo Warlock falls back to Lunafactions and says Sanguine is the ideal', () => {
    const verdict = recommend(data, 2, 'boss-burst');
    expect(verdict.armor!.id).toBe('lunafaction-boots');
    expect(verdict.armorIdealNote).toContain('Sanguine Alchemy');
  });

  it('the demo build is buildable AND shows the gap, which is the product story', () => {
    // Every pick is ownable right now (Cuirass is one Collections pull), so
    // the headline is "you can build right now" - and the ideal note still
    // names the tier 1 rocket the demo does not have. Both at once is the
    // honest state most real accounts are in.
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.buildable).toBe(true);
    expect(verdict.slots.find((s) => s.slot === 'power')!.idealNote).toContain('Hezen');
  });
});
