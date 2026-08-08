// The encounter-aware engine, pinned to the research brief's rules. Every
// adjustment asserted here is traceable to a rule id in
// src/data/encounters.ts; if an assertion in this file cannot name its rule,
// it does not belong in the engine either.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '../fixtures/demo';
import { findEncounter } from '../src/data/encounters';
import { BAKED_ITEMS } from '../src/data/items';
import { CURATED_BY_ID } from '../src/data/tiers';
import {
  buildEncounterAdjust,
  encounterMode,
  encounterProfileLine,
  isTrackingFrame,
  recommendEncounter,
  TRACKING_FRAMES
} from '../src/encounter';
import { parseProfile } from '../src/ownership';
import { assertLegalExotics, type Pick } from '../src/recommend';
import type { Verdict } from '../src/recommend';
import { ownsEverything, player } from './helpers';

function at(activityId: string, encounterId: string) {
  const hit = findEncounter(activityId, encounterId);
  if (!hit) throw new Error('missing encounter ' + activityId + '/' + encounterId);
  return hit;
}

function run(activityId: string, encounterId: string, data = ownsEverything(), classType: 0 | 1 | 2 = 0) {
  const { activity, encounter } = at(activityId, encounterId);
  return recommendEncounter(data, classType, activity, encounter);
}

function picks(verdict: Verdict): Pick[] {
  return verdict.slots.map((s) => s.pick).filter((p): p is Pick => p !== null);
}

function slotPick(verdict: Verdict, slot: string): Pick | null {
  return verdict.slots.find((s) => s.slot === slot)?.pick ?? null;
}

describe('mode mapping: windows decide which sourced pools run', () => {
  it('sustained bosses run the sustained pools', () => {
    for (const [a, e] of [
      ['desert-perpetual', 'epoptes'],
      ['desert-perpetual', 'agraios'],
      ['desert-perpetual', 'koregos'],
      ['prophecy', 'kell-echo'],
      ['vespers-host', 'corrupted-puppeteer'],
      ['sundered-doctrine', 'zoetic-lockset']
    ] as const) {
      expect(encounterMode(at(a, e).encounter), a + '/' + e).toBe('boss-sustained');
    }
  });

  it('burst and mid-window bosses, and unknown Pantheon windows, run boss-burst', () => {
    for (const [a, e] of [
      ['deep-stone-crypt', 'atraks-1'],
      ['duality', 'nightmare-of-caiatl'],
      ['last-wish', 'shuro-chi'],
      ['vault-of-glass', 'templar'],
      ['pantheon-insurrection-prime', 'insurrection-prime']
    ] as const) {
      expect(encounterMode(at(a, e).encounter), a + '/' + e).toBe('boss-burst');
    }
  });
});

describe('Atraks-1: the proxy rule demotes crit weapons and the window picks burst', () => {
  it('maps to boss-burst (2.3s clone windows)', () => {
    expect(run('deep-stone-crypt', 'atraks-1').mode).toBe('boss-burst');
  });

  it('demotes every crit-dependent weapon through the adjust, rockets untouched', () => {
    const { encounter } = at('deep-stone-crypt', 'atraks-1');
    const adjust = buildEncounterAdjust(encounter)!;
    for (const id of ['praedyths-revenge', 'still-hunt', 'whisper-of-the-worm', 'the-queenbreaker']) {
      const item = CURATED_BY_ID.get(id)!;
      expect(adjust.rankDelta(item), id).toBeGreaterThan(0);
      expect(adjust.note(item)!.ruleId, id).toBe('proxy');
      expect(adjust.exclude(item), id).toBeNull(); // demoted, never banned
    }
    for (const id of ['hezen-vengeance', 'witherhoard', 'edge-transit', 'thunderlord']) {
      expect(adjust.rankDelta(CURATED_BY_ID.get(id)!), id).toBe(0);
    }
  });

  it('the 2.3s window keeps the rocket in the power seat, not a sniper', () => {
    // The one-exotic rule means the kinetic sniper cannot be swapped for
    // another buildable kinetic (every alternative kinetic is an exotic that
    // would forfeit the energy exotic), so the visible effects here are the
    // burst mapping, the rocket power pick, and the demotion note; the
    // seat-level flip is asserted end to end on Zoetic Lockset below.
    const atraks = run('deep-stone-crypt', 'atraks-1');
    expect(slotPick(atraks.verdict!, 'power')!.id).toBe('hezen-vengeance');
    const note = atraks.verdict!.slots.find((s) => s.slot === 'kinetic')!.encounterNote!;
    expect(note).toContain('demoted');
    expect(note).toContain('[rule: proxy]');
  });

  it('says on the card when a demoted sniper is still the best you can field', () => {
    const data = player(['praedyths-revenge']);
    const atraks = run('deep-stone-crypt', 'atraks-1', data);
    const note = atraks.verdict!.slots.find((s) => s.slot === 'kinetic')!.encounterNote!;
    expect(note).toContain('demoted here');
    expect(note).toContain('still the best legal option');
  });

  it('replaces the fireteam debuff section: debuffs do nothing here', () => {
    const ev = run('deep-stone-crypt', 'atraks-1');
    expect(ev.fireteamOverride).toContain('Debuffs do nothing here');
    expect(ev.verdict!.fireteamNotes).toEqual([]);
    expect(ev.verdict!.warnings.some((w) => w.id === 'tractor-refresh')).toBe(false);
    expect(ev.verdict!.rotation!.caveats.join(' ')).toContain('skip the debuff step');
  });

  it('shows the proxy warning card', () => {
    const ev = run('deep-stone-crypt', 'atraks-1');
    expect(ev.cards.some((c) => c.ruleId === 'proxy' && c.tone === 'warning')).toBe(true);
  });
});

describe('far range and sword-unfriendly encounters exclude point-blank weapons', () => {
  it('the Witness page never fields Ergo Sum or Winterbite, and says why', () => {
    const ev = run('salvations-edge', 'witness');
    const ids = picks(ev.verdict!).map((p) => p.id);
    expect(ids).not.toContain('ergo-sum');
    expect(ids).not.toContain('winterbite');
    const energyNote = ev.verdict!.slots.find((s) => s.slot === 'energy')!.encounterNote!;
    expect(energyNote).toContain('Ergo Sum is excluded here');
    // The Witness exclusion comes from the far-range fact, and the note
    // names that rule rather than a vaguer one.
    expect(energyNote).toContain('[rule: far-range]');
    expect(energyNote).toContain('Still Hunt');
  });

  it('Kell Echo bans swords by rule, visible in the adjust itself', () => {
    const { encounter } = at('prophecy', 'kell-echo');
    const adjust = buildEncounterAdjust(encounter)!;
    const ergo = CURATED_BY_ID.get('ergo-sum')!;
    const excluded = adjust.exclude(ergo)!;
    expect(excluded.ruleId).toBe('sword-unfriendly');
    const praedyth = CURATED_BY_ID.get('praedyths-revenge')!;
    expect(adjust.exclude(praedyth)).toBeNull();
  });

  it('close encounters leave swords eligible: Crota fields Ergo Sum', () => {
    const ev = run('crotas-end', 'crota');
    expect(slotPick(ev.verdict!, 'energy')!.id).toBe('ergo-sum');
  });
});

describe('Crota: the sword bonus promotes swords, visibly', () => {
  it('keeps the sword and explains the promotion on the card', () => {
    const ev = run('crotas-end', 'crota');
    const note = ev.verdict!.slots.find((s) => s.slot === 'energy')!.encounterNote!;
    expect(note).toContain('promoted');
    expect(note).toContain('35 percent');
    expect(note).toContain('[rule: sword-bonus]');
  });

  it('shows the bonus card and the channeled-super caution with its L hedge', () => {
    const ev = run('crotas-end', 'crota');
    expect(ev.cards.some((c) => c.ruleId === 'sword-bonus' && c.tone === 'bonus')).toBe(true);
    expect(ev.superCaution).toContain('Oversoul');
    expect(ev.superCaution).toContain('Community-reported');
  });
});

describe('Morgeth: the anti-sniper resistances demote snipers there specifically', () => {
  it('demotes snipers there specifically, through the adjust and onto the card', () => {
    const { encounter } = at('last-wish', 'morgeth');
    const adjust = buildEncounterAdjust(encounter)!;
    for (const id of ['praedyths-revenge', 'still-hunt', 'cloudstrike', 'whisper-of-the-worm']) {
      expect(adjust.rankDelta(CURATED_BY_ID.get(id)!), id).toBeGreaterThan(0);
      expect(adjust.note(CURATED_BY_ID.get(id)!)!.ruleId, id).toBe('sniper-dr');
    }
    // Not a proxy target: the linear fusion is NOT demoted at Morgeth.
    expect(adjust.rankDelta(CURATED_BY_ID.get('the-queenbreaker')!)).toBe(0);
    // Close range: swords stay eligible.
    expect(adjust.exclude(CURATED_BY_ID.get('ergo-sum')!)).toBeNull();
    const morgeth = run('last-wish', 'morgeth');
    const note = morgeth.verdict!.slots.find((s) => s.slot === 'kinetic')!.encounterNote!;
    expect(note).toContain('demoted');
    expect(note).toContain('[rule: sniper-dr]');
  });

  it('shows the DR warning card with the verified percentages', () => {
    const ev = run('last-wish', 'morgeth');
    const card = ev.cards.find((c) => c.ruleId === 'sniper-dr')!;
    expect(card.tone).toBe('warning');
    expect(card.body).toContain('45 percent');
    expect(card.body).toContain('55 percent');
  });

  it('does not demote snipers at the fight next door', () => {
    const data = player(['praedyths-revenge', 'witherhoard']);
    const kalli = run('last-wish', 'kalli', data);
    expect(slotPick(kalli.verdict!, 'kinetic')!.id).toBe('praedyths-revenge');
  });
});

describe('Oryx and the Witness: setpiece rules', () => {
  it('flags the conservative tracking heuristic in words', () => {
    const ev = run('kings-fall', 'oryx');
    expect(ev.trackingNote).toContain('Truth');
    expect(ev.trackingNote).toContain('Tracking Module');
    expect(ev.trackingNote).toContain('Deathbringer');
  });

  it('the tracking frame table is exactly the three intrinsic homers', () => {
    expect([...TRACKING_FRAMES.keys()].sort()).toEqual([
      'Eyes on All',
      'Prototype Trueseeker',
      'Twintails'
    ]);
    expect(isTrackingFrame('Prototype Trueseeker')).toBe(true);
    expect(isTrackingFrame('Wolfpack Rounds')).toBe(false);
    expect(isTrackingFrame(null)).toBe(false);
  });

  it('shows the setpiece warning card on both pages', () => {
    for (const [a, e] of [
      ['kings-fall', 'oryx'],
      ['salvations-edge', 'witness']
    ] as const) {
      const ev = run(a, e);
      expect(ev.cards.some((c) => c.ruleId === 'setpiece' && c.tone === 'warning'), e).toBe(true);
    }
  });
});

describe('sustained bosses pick sustained weapons over rockets', () => {
  it('Koregos and Epoptes take Thunderlord; a burst boss takes the rocket', () => {
    const data = player(['thunderlord', 'hezen-vengeance', 'apex-predator']);
    for (const [a, e] of [
      ['desert-perpetual', 'koregos'],
      ['desert-perpetual', 'epoptes']
    ] as const) {
      const ev = run(a, e, data);
      expect(slotPick(ev.verdict!, 'power')!.id, e).toBe('thunderlord');
    }
    const burst = run('last-wish', 'shuro-chi', data);
    expect(slotPick(burst.verdict!, 'power')!.id).toBe('hezen-vengeance');
  });

  it('Zoetic Lockset: proxy flips the sustained seat from Queenbreaker to Thunderlord', () => {
    // Same inventory, two sustained bosses: the proxy target demotes the
    // crit-dependent linear fusion, the teleporting one does not.
    const puppeteer = run('vespers-host', 'corrupted-puppeteer');
    expect(slotPick(puppeteer.verdict!, 'power')!.id).toBe('the-queenbreaker');
    const zoetic = run('sundered-doctrine', 'zoetic-lockset');
    expect(slotPick(zoetic.verdict!, 'power')!.id).toBe('thunderlord');
    expect(zoetic.fireteamOverride).toContain('Debuffs do nothing here');
  });
});

describe('DR and bonus overrides render as cards, sourced', () => {
  it('Iatros leads with the super-first warning and hedges the Epic gap', () => {
    const ev = run('desert-perpetual', 'iatros');
    const card = ev.cards.find((c) => c.ruleId === 'non-super-dr')!;
    expect(card.tone).toBe('warning');
    expect(card.body).toContain('35 percent');
    expect(card.body).toContain('Super rotations are the answer');
    const epic = ev.cards.find((c) => c.ruleId === 'epic-dr-unknown')!;
    expect(epic.body).toContain('Reported but unconfirmed');
  });

  it('Caiatl, Raneiks, Templar and Caretaker each show their override', () => {
    expect(
      run('duality', 'nightmare-of-caiatl').cards.find((c) => c.ruleId === 'caiatl-dr')!.body
    ).toContain('90 percent');
    expect(
      run('vespers-host', 'raneiks-unified').cards.find((c) => c.ruleId === 'global-dr')!.body
    ).toContain('65 percent');
    const templar = run('vault-of-glass', 'templar');
    expect(templar.cards.find((c) => c.ruleId === 'explosive-dr')!.tone).toBe('warning');
    expect(templar.cards.find((c) => c.ruleId === 'cluster-bombs')!.tone).toBe('bonus');
    expect(
      run('vow-of-the-disciple', 'caretaker').cards.find((c) => c.ruleId === 'plate-bonus')!.body
    ).toContain('2x');
  });

  it('the Atheon 5x claim renders as a rumour with a citation, not a fact', () => {
    const ev = run('vault-of-glass', 'atheon');
    const card = ev.cards.find((c) => c.ruleId === 'atheon-multiplier')!;
    expect(card.confidence).toBe('C');
    expect(card.body).toContain('Reported but unconfirmed');
  });
});

describe('channeled-super punishers render as cautions where sourced', () => {
  it('Nezarec and Rhulk carry verified cautions; Templar carries the L hedge', () => {
    expect(run('root-of-nightmares', 'nezarec').superCaution).toContain('suppressing melee');
    expect(run('vow-of-the-disciple', 'rhulk').superCaution).toContain('roams');
    const templar = run('vault-of-glass', 'templar').superCaution!;
    expect(templar).toContain('Detain');
    expect(templar).toContain('Community-reported');
  });

  it('does not invent a channeled-super classification of its own', () => {
    const ev = run('root-of-nightmares', 'nezarec');
    expect(ev.superCaution).toContain('does not maintain a channeled-super list');
  });

  it('bosses without the rule get no caution', () => {
    expect(run('last-wish', 'kalli').superCaution).toBeNull();
  });
});

describe('Insurrection Prime: the Divinity zero', () => {
  it('shows the zero-damage card and the unconfirmed teammate-cage card', () => {
    const ev = run('pantheon-insurrection-prime', 'insurrection-prime');
    expect(ev.cards.find((c) => c.ruleId === 'divinity-zero')!.body).toContain('ZERO damage');
    expect(ev.cards.find((c) => c.ruleId === 'divinity-cage-teammates')!.body).toContain(
      'Reported but unconfirmed'
    );
  });

  it('never seats Divinity in the fireteam notes there', () => {
    const data = player(['thunderlord', 'divinity', 'the-queenbreaker']);
    const ev = run('pantheon-insurrection-prime', 'insurrection-prime', data);
    expect(ev.verdict!.fireteamNotes.map((n) => n.id)).not.toContain('divinity');
  });
});

describe('no-DPS encounters route to the honest empty state', () => {
  it('Gorgons offers no loadout and says why', () => {
    const ev = run('vault-of-glass', 'gorgons');
    expect(ev.verdict).toBeNull();
    expect(ev.noDps!.title).toBe('No damage check here');
    expect(ev.noDps!.body).toContain('not be seen');
    expect(ev.alternatives).toEqual([]);
  });

  it('the unnamed dungeon openers admit the name gap', () => {
    const ev = run('vespers-host', 'first-encounter');
    expect(ev.noDps!.body).toContain('No official name is recorded');
  });
});

describe('gaps render as gaps', () => {
  it('encounters without sourced consensus carry the generic-DPS line', () => {
    expect(run('pit-of-heresy', 'zulmak').consensusLine).toContain('generic boss DPS');
    expect(run('vault-of-glass', 'templar').consensusLine).toContain('generic boss DPS');
  });

  it('encounters with sourced guidance do not', () => {
    expect(run('salvations-edge', 'witness').consensusLine).toBeNull();
    expect(run('desert-perpetual', 'koregos').consensusLine).toBeNull();
    expect(run('equilibrium', 'dredgen-sere').consensusLine).toBeNull();
  });

  it('the profile line says unknown instead of inventing seconds', () => {
    const { encounter } = at('pantheon-calus-resplendent', 'calus');
    const line = encounterProfileLine(encounter, 'boss-burst');
    expect(line).toContain('window seconds unpublished');
    expect(line).toContain('window style unknown');
    const crota = encounterProfileLine(at('crotas-end', 'crota').encounter, 'boss-burst');
    expect(crota).toContain('range unrecorded');
  });
});

describe('alternatives: options B and C are legal and meaningfully different', () => {
  it('the demo burst answer offers a different exotic seat, not a reshuffle', () => {
    const data = parseProfile(buildDemoProfile());
    const ev = run('last-wish', 'kalli', data);
    expect(ev.alternatives.length).toBeGreaterThanOrEqual(1);
    const winnerExotic = picks(ev.verdict!).find((p) => BAKED_ITEMS[p.id]?.tierType === 6)?.id ?? null;
    for (const alt of ev.alternatives) {
      expect(alt.equippedExoticId).not.toBe(winnerExotic);
      const altPicks = alt.slots
        .map((s) => s.item)
        .filter((i): i is NonNullable<typeof i> => i !== null);
      const exotics = altPicks.filter((i) => BAKED_ITEMS[i.id]?.tierType === 6);
      expect(exotics.length).toBeLessThanOrEqual(1);
    }
  });

  it('alternatives pass the same legality door as the main answer', () => {
    const data = ownsEverything();
    for (const [a, e] of [
      ['vault-of-glass', 'templar'],
      ['desert-perpetual', 'koregos'],
      ['salvations-edge', 'witness']
    ] as const) {
      const ev = run(a, e, data);
      for (const alt of ev.alternatives) {
        const fake = alt.slots
          .filter((s) => s.item !== null)
          .map((s) => ({
            id: s.item!.id,
            name: s.item!.name
          })) as unknown as Pick[];
        expect(() => assertLegalExotics(fake, []), a + '/' + e).not.toThrow();
      }
    }
  });
});

