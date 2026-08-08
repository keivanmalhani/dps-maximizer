// The encounter database, held to the research brief it transcribes
// (docs/encounter-research.md). These tests are the drift alarm between the
// brief and src/data/encounters.ts: the catalog must match, every rule must
// carry a source and a confidence code, and everything the brief marks
// contested must render hedged, never as fact.

import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  ACTIVITY_BY_ID,
  findEncounter,
  firstDamageEncounter,
  hasLoadoutConsensus,
  ruleLine,
  WINDOW_SOURCE,
  type Encounter,
  type EncounterActivity,
  type SpecialRule
} from '../src/data/encounters';

const allEncounters: Array<{ activity: EncounterActivity; encounter: Encounter }> = [];
for (const activity of ACTIVITIES) {
  for (const encounter of activity.encounters) allEncounters.push({ activity, encounter });
}
const bosses = allEncounters.filter(({ encounter }) => encounter.type !== 'none');
const allRules: Array<{ where: string; rule: SpecialRule }> = [];
for (const { activity, encounter } of allEncounters) {
  for (const rule of encounter.specialRules) {
    allRules.push({ where: activity.id + '/' + encounter.id, rule });
  }
}
for (const activity of ACTIVITIES) {
  for (const rule of activity.notes) allRules.push({ where: activity.id, rule });
}

describe('the playable catalog matches the research brief', () => {
  it('carries exactly the ten raids, by name', () => {
    const raids = ACTIVITIES.filter((a) => a.kind === 'raid').map((a) => a.name);
    expect(raids).toEqual([
      'Vault of Glass',
      "King's Fall",
      'Last Wish',
      'Garden of Salvation',
      'Deep Stone Crypt',
      'Vow of the Disciple',
      'Root of Nightmares',
      "Crota's End",
      "Salvation's Edge",
      'The Desert Perpetual'
    ]);
  });

  it('carries exactly the eleven dungeons, by name', () => {
    const dungeons = ACTIVITIES.filter((a) => a.kind === 'dungeon').map((a) => a.name);
    expect(dungeons).toEqual([
      'The Shattered Throne',
      'Pit of Heresy',
      'Prophecy',
      'Grasp of Avarice',
      'Duality',
      'Spire of the Watcher',
      "Ghosts of the Deep",
      "Warlord's Ruin",
      "Vesper's Host",
      'Sundered Doctrine',
      'Equilibrium'
    ]);
  });

  it('carries the three permanent Pantheon 2.0 gauntlets', () => {
    const pantheon = ACTIVITIES.filter((a) => a.kind === 'pantheon');
    expect(pantheon.map((a) => a.id)).toEqual([
      'pantheon-calus-resplendent',
      'pantheon-morgeth-surpassing',
      'pantheon-insurrection-prime'
    ]);
    // The Insurrection gauntlet is all six plus the boss, per the brief.
    expect(pantheon[2].encounters.length).toBe(7);
  });

  it('keeps every id a stable ASCII slug, unique where it must be', () => {
    const activityIds = new Set<string>();
    for (const activity of ACTIVITIES) {
      expect(activity.id).toMatch(/^[a-z0-9-]+$/);
      expect(activityIds.has(activity.id), activity.id).toBe(false);
      activityIds.add(activity.id);
      const encounterIds = new Set<string>();
      for (const encounter of activity.encounters) {
        expect(encounter.id, activity.id + '/' + encounter.id).toMatch(/^[a-z0-9-]+$/);
        expect(encounterIds.has(encounter.id), activity.id + '/' + encounter.id).toBe(false);
        encounterIds.add(encounter.id);
      }
    }
  });

  it('keeps the raids their real shape: the non-DPS encounters stay listed', () => {
    const vog = ACTIVITY_BY_ID.get('vault-of-glass')!;
    expect(vog.encounters.map((e) => e.id)).toEqual([
      'waking-ruins',
      'confluxes',
      'oracles',
      'templar',
      'gorgons',
      'gatekeepers',
      'atheon'
    ]);
    expect(vog.encounters.filter((e) => e.type === 'none').length).toBe(5);
  });
});

describe('every damage encounter has its profile', () => {
  it('every boss and objective carries a window object and a range field', () => {
    for (const { activity, encounter } of bosses) {
      const label = activity.id + '/' + encounter.id;
      expect(encounter.window, label).not.toBeNull();
      expect('range' in encounter, label).toBe(true);
    }
  });

  it('a null range exists only where the brief records none, pinned by name', () => {
    const nullRange = bosses
      .filter(({ encounter }) => encounter.range === null)
      .map(({ encounter }) => encounter.id)
      .sort();
    expect(nullRange).toEqual([
      'akelous',
      'crota',
      'hefnds-vengeance',
      'locus-of-wailing-grief',
      'nightmare-of-caiatl'
    ]);
  });

  it('window style derives mechanically from the seconds, never hand-waved', () => {
    for (const { activity, encounter } of bosses) {
      const window = encounter.window!;
      const label = activity.id + '/' + encounter.id;
      if (window.seconds === null) {
        expect(window.style, label).toBeNull();
      } else if (window.seconds < 15) {
        expect(window.style, label).toBe('burst');
      } else if (window.seconds > 60) {
        expect(window.style, label).toBe('sustained');
      } else {
        expect(window.style, label).toBe('multi-window');
      }
      expect(window.source, label).toBe(WINDOW_SOURCE);
    }
  });

  it('the sustained set is exactly the long-window bosses the brief names', () => {
    const sustained = bosses
      .filter(({ encounter }) => encounter.window!.style === 'sustained')
      .map(({ encounter }) => encounter.id)
      .sort();
    expect(sustained).toEqual([
      'agraios',
      'corrupted-puppeteer',
      'epoptes',
      'kell-echo',
      'koregos',
      'zoetic-lockset'
    ]);
  });

  it('the burst set includes the brief\'s named short checks with their seconds', () => {
    const seconds = new Map(
      bosses.map(({ encounter }) => [encounter.id, encounter.window!.seconds])
    );
    expect(seconds.get('atraks-1')).toBe(2.3);
    expect(seconds.get('nightmare-of-caiatl')).toBe(12);
    expect(seconds.get('shuro-chi')).toBe(12.9);
    for (const id of ['atraks-1', 'nightmare-of-caiatl', 'shuro-chi']) {
      const hit = bosses.find(({ encounter }) => encounter.id === id)!;
      expect(hit.encounter.window!.style, id).toBe('burst');
    }
  });

  it('Pantheon windows are unknown, not borrowed from the raid versions', () => {
    for (const activity of ACTIVITIES.filter((a) => a.kind === 'pantheon')) {
      for (const encounter of activity.encounters) {
        expect(encounter.window!.seconds, activity.id + '/' + encounter.id).toBeNull();
        expect(encounter.window!.style, activity.id + '/' + encounter.id).toBeNull();
      }
      expect(activity.notes.some((n) => n.id === 'pantheon-gap' && n.confidence === 'C')).toBe(true);
    }
  });

  it('every no-DPS encounter says why there is nothing to recommend', () => {
    for (const { activity, encounter } of allEncounters) {
      if (encounter.type !== 'none') continue;
      const label = activity.id + '/' + encounter.id;
      expect(encounter.window, label).toBeNull();
      expect(encounter.noDpsNote ?? '', label).not.toBe('');
    }
  });
});

describe('every special rule is sourced and confidence-coded', () => {
  it('no rule ships without a source and a V/L/C code', () => {
    expect(allRules.length).toBeGreaterThan(30);
    for (const { where, rule } of allRules) {
      expect(rule.source.length, where + '/' + rule.id).toBeGreaterThan(8);
      expect(['V', 'L', 'C'], where + '/' + rule.id).toContain(rule.confidence);
      expect(rule.text.length, where + '/' + rule.id).toBeGreaterThan(10);
    }
  });

  it('every C-confidence rule renders hedged, and the C set is pinned', () => {
    const contested = allRules.filter(({ rule }) => rule.confidence === 'C');
    expect(new Set(contested.map(({ rule }) => rule.id))).toEqual(
      new Set(['atheon-multiplier', 'epic-dr-unknown', 'divinity-cage-teammates', 'pantheon-gap'])
    );
    for (const { rule } of contested) {
      expect(ruleLine(rule)).toContain('Reported but unconfirmed');
    }
  });

  it('L-confidence rules disclose that they are community-reported', () => {
    const likely = allRules.filter(({ rule }) => rule.confidence === 'L');
    expect(likely.length).toBeGreaterThan(3);
    for (const { rule } of likely) {
      expect(ruleLine(rule)).toContain('Community-reported');
    }
  });

  it('V-confidence rules render verbatim, with no invented hedging', () => {
    const verified = allRules.find(({ rule }) => rule.id === 'sword-bonus')!;
    expect(ruleLine(verified.rule)).toBe(verified.rule.text);
  });
});

describe('the cross-cutting rules land on the encounters the brief names', () => {
  const idsWithRule = (ruleId: string) =>
    bosses
      .filter(({ encounter }) => encounter.specialRules.some((r) => r.id === ruleId))
      .map(({ activity, encounter }) => activity.id + '/' + encounter.id)
      .sort();

  it('PROXY: Crypt Security, Atraks-1, Zoetic Lockset', () => {
    expect(idsWithRule('proxy')).toEqual([
      'deep-stone-crypt/atraks-1',
      'deep-stone-crypt/crypt-security',
      'sundered-doctrine/zoetic-lockset'
    ]);
  });

  it('SETPIECE: Oryx and The Witness', () => {
    expect(idsWithRule('setpiece')).toEqual(['kings-fall/oryx', 'salvations-edge/witness']);
  });

  it('anti-sniper DR: Morgeth and Riven in Last Wish, NOT Pantheon Morgeth', () => {
    expect(idsWithRule('sniper-dr')).toEqual(['last-wish/morgeth', 'last-wish/riven']);
    // The brief's Pantheon profile does not restate the DR, so the honest
    // value there is silence; this pin keeps anyone from "helpfully" copying
    // the raid rule over.
    const pantheonMorgeth = findEncounter('pantheon-morgeth-surpassing', 'morgeth')!;
    expect(pantheonMorgeth.encounter.specialRules.some((r) => r.id === 'sniper-dr')).toBe(false);
  });

  it('sword bonus at Crota, plate bonus at Caretaker, essence at Gahlran', () => {
    expect(idsWithRule('sword-bonus')).toEqual(['crotas-end/crota']);
    expect(idsWithRule('plate-bonus')).toEqual(['vow-of-the-disciple/caretaker']);
    expect(idsWithRule('essence-bonus')).toEqual(['duality/nightmare-of-gahlran']);
  });

  it('DR overrides: Caiatl, Raneiks, Iatros, Templar explosive', () => {
    expect(idsWithRule('caiatl-dr')).toEqual(['duality/nightmare-of-caiatl']);
    expect(idsWithRule('global-dr')).toEqual(['vespers-host/raneiks-unified']);
    expect(idsWithRule('non-super-dr')).toEqual(['desert-perpetual/iatros']);
    expect(idsWithRule('explosive-dr')).toEqual(['vault-of-glass/templar']);
  });

  it('channeled-super punishers: Templar, Rhulk, Nezarec, Crota, with honest codes', () => {
    expect(idsWithRule('channeled-super-risk')).toEqual([
      'crotas-end/crota',
      'root-of-nightmares/nezarec',
      'vault-of-glass/templar',
      'vow-of-the-disciple/rhulk'
    ]);
    const confidence = (activityId: string, encounterId: string) =>
      findEncounter(activityId, encounterId)!.encounter.specialRules.find(
        (r) => r.id === 'channeled-super-risk'
      )!.confidence;
    expect(confidence('root-of-nightmares', 'nezarec')).toBe('V');
    expect(confidence('vow-of-the-disciple', 'rhulk')).toBe('V');
    expect(confidence('vault-of-glass', 'templar')).toBe('L');
    expect(confidence('crotas-end', 'crota')).toBe('L');
  });

  it('Divinity zero-damage scope is Insurrection Prime, one encounter', () => {
    expect(idsWithRule('divinity-zero')).toEqual([
      'pantheon-insurrection-prime/insurrection-prime'
    ]);
  });

  it('head-impact 2x: Kalli and Shuro Chi; the shield rule: Ecthar and Simmumah', () => {
    expect(idsWithRule('head-impact-2x')).toEqual(['last-wish/kalli', 'last-wish/shuro-chi']);
    expect(idsWithRule('shield-mechanic')).toEqual([
      'ghosts-of-the-deep/ecthar',
      'ghosts-of-the-deep/simmumah'
    ]);
  });

  it('sword-unfriendly covers the brief\'s list, by rule or by far range', () => {
    const unfriendly = bosses
      .filter(
        ({ encounter }) =>
          encounter.range === 'far' ||
          encounter.specialRules.some((r) => r.id === 'sword-unfriendly')
      )
      .map(({ encounter }) => encounter.id);
    for (const id of [
      'kell-echo',
      'simmumah',
      'witness',
      'oryx',
      'zoetic-lockset',
      'akelous',
      'consecrated-mind',
      'taniks',
      'sanctified-mind'
    ]) {
      expect(unfriendly, id).toContain(id);
    }
  });
});

describe('lookup helpers', () => {
  it('findEncounter resolves and rejects honestly', () => {
    expect(findEncounter('vault-of-glass', 'templar')!.encounter.name).toBe('Templar');
    expect(findEncounter('vault-of-glass', 'nope')).toBeNull();
    expect(findEncounter('nope', 'templar')).toBeNull();
  });

  it('firstDamageEncounter skips the intro filler', () => {
    expect(firstDamageEncounter(ACTIVITY_BY_ID.get('vault-of-glass')!).id).toBe('templar');
    expect(firstDamageEncounter(ACTIVITY_BY_ID.get('deep-stone-crypt')!).id).toBe('crypt-security');
  });

  it('consensus is claimed only where the brief has sourced guidance', () => {
    const witness = findEncounter('salvations-edge', 'witness')!;
    expect(hasLoadoutConsensus(witness.activity, witness.encounter)).toBe(true);
    const koregos = findEncounter('desert-perpetual', 'koregos')!;
    expect(hasLoadoutConsensus(koregos.activity, koregos.encounter)).toBe(true);
    const sere = findEncounter('equilibrium', 'dredgen-sere')!;
    expect(hasLoadoutConsensus(sere.activity, sere.encounter)).toBe(true);
    const templar = findEncounter('vault-of-glass', 'templar')!;
    expect(hasLoadoutConsensus(templar.activity, templar.encounter)).toBe(false);
    const zulmak = findEncounter('pit-of-heresy', 'zulmak')!;
    expect(hasLoadoutConsensus(zulmak.activity, zulmak.encounter)).toBe(false);
  });
});
