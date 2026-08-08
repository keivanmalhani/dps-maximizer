// The engine, pinned. Curated dataset + fake inventory in, verdict out;
// every rule the page relies on is asserted here, including the exact
// conditions for the Well/Golden Gun warning and the honest empty states.

import { describe, expect, it } from 'vitest';
import {
  DIVINITY_PANTHEON_WARNING,
  TRACTOR_REFRESH_WARNING,
  WELL_GOLDEN_GUN_WARNING,
  armorCandidates,
  buildableNow,
  cipherPointer,
  nextUnlock,
  ownershipLine,
  recommend,
  weaponCandidates
} from '../src/recommend';
import { CURATED_BY_ID } from '../src/data/tiers';
import { ownsEverything, player } from './helpers';

describe('weaponCandidates ordering', () => {
  it('power slot for boss burst leads with Hezen, then Gjallarhorn', () => {
    const ids = weaponCandidates('boss-burst', 'power').map((item) => item.id);
    expect(ids[0]).toBe('hezen-vengeance');
    expect(ids[1]).toBe('gjallarhorn');
    expect(ids[2]).toBe('edge-transit');
  });

  it('energy slot for boss burst leads with Ergo Sum over Still Hunt', () => {
    const ids = weaponCandidates('boss-burst', 'energy').map((item) => item.id);
    expect(ids[0]).toBe('ergo-sum');
    expect(ids[1]).toBe('still-hunt');
  });

  it('kinetic slot for sustained leads with Praedyth over Izanagi', () => {
    const ids = weaponCandidates('boss-sustained', 'kinetic').map((item) => item.id);
    expect(ids[0]).toBe('praedyths-revenge');
    expect(ids[1]).toBe('izanagis-burden');
  });

  it('power slot for sustained leads with The Queenbreaker', () => {
    const ids = weaponCandidates('boss-sustained', 'power').map((item) => item.id);
    expect(ids[0]).toBe('the-queenbreaker');
    expect(ids[1]).toBe('thunderlord');
  });

  it('support jobs never appear as personal weapon candidates', () => {
    for (const activity of ['boss-burst', 'boss-sustained', 'master-champions'] as const) {
      for (const slot of ['kinetic', 'energy', 'power'] as const) {
        const ids = weaponCandidates(activity, slot).map((item) => item.id);
        expect(ids, activity + '/' + slot).not.toContain('tractor-cannon');
        expect(ids, activity + '/' + slot).not.toContain('lumina');
        expect(ids, activity + '/' + slot).not.toContain('divinity');
        expect(ids, activity + '/' + slot).not.toContain('no-hesitation');
      }
    }
  });

  it('the add-clear energy slot is honestly empty', () => {
    expect(weaponCandidates('add-clear', 'energy')).toEqual([]);
  });
});

describe('buildableNow and ownership lines', () => {
  it('instances are buildable whatever the rarity', () => {
    const data = player([{ id: 'hezen-vengeance' }]);
    expect(buildableNow(CURATED_BY_ID.get('hezen-vengeance')!, data)).toBe(true);
  });

  it('a Collections exotic is buildable, one kiosk pull away', () => {
    const data = player([{ id: 'tractor-cannon', state: 'collections' }]);
    expect(buildableNow(CURATED_BY_ID.get('tractor-cannon')!, data)).toBe(true);
  });

  it('a Collections legendary is NOT buildable and the line says why', () => {
    const data = player([{ id: 'edge-transit', state: 'collections' }]);
    expect(buildableNow(CURATED_BY_ID.get('edge-transit')!, data)).toBe(false);
    expect(ownershipLine(CURATED_BY_ID.get('edge-transit')!, 'collections')).toContain(
      'cannot be pulled'
    );
  });

  it('the Collections exotic line offers the kiosk', () => {
    expect(ownershipLine(CURATED_BY_ID.get('tractor-cannon')!, 'collections')).toContain('kiosk');
  });

  it('unowned is stated flatly', () => {
    expect(ownershipLine(CURATED_BY_ID.get('hezen-vengeance')!, 'none')).toContain('Not owned');
  });
});

describe('slot picks and fallbacks', () => {
  it('picks the best owned weapon per slot', () => {
    const data = player(['apex-predator', 'praedyths-revenge', 'still-hunt']);
    const verdict = recommend(data, 0, 'boss-burst');
    const bySlot = new Map(verdict.slots.map((s) => [s.slot, s]));
    expect(bySlot.get('power')!.pick!.id).toBe('apex-predator');
    expect(bySlot.get('kinetic')!.pick!.id).toBe('praedyths-revenge');
    expect(bySlot.get('energy')!.pick!.id).toBe('still-hunt');
  });

  it('names the ideal it fell back from, with the acquisition path', () => {
    const data = player(['apex-predator']);
    const verdict = recommend(data, 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.idealNote).toContain('Hezen Vengeance');
    expect(power.idealNote).toContain('Tier 1');
    expect(power.idealNote).toContain('Vault of Glass');
  });

  it('does not apologise when the owned pick is the ideal', () => {
    const data = player(['hezen-vengeance']);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.slots.find((s) => s.slot === 'power')!.idealNote).toBeNull();
  });

  it('prefers a higher tier the player owns over a lower tier they also own', () => {
    const data = player(['one-thousand-voices', 'edge-transit']);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.slots.find((s) => s.slot === 'power')!.pick!.id).toBe('edge-transit');
  });

  it('Gjallarhorn owned but no Hezen makes Gjallarhorn the pick and Hezen the gap', () => {
    const data = player(['gjallarhorn']);
    const verdict = recommend(data, 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.id).toBe('gjallarhorn');
    expect(power.idealNote).toContain('Hezen Vengeance');
  });

  it('a Collections-only exotic counts as buildable for the pick', () => {
    const data = player([{ id: 'one-thousand-voices', state: 'collections' }]);
    const verdict = recommend(data, 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.id).toBe('one-thousand-voices');
    expect(power.pick!.buildableNow).toBe(true);
  });

  it('a Collections-only legendary does NOT count as buildable', () => {
    const data = player([
      { id: 'edge-transit', state: 'collections' },
      { id: 'one-thousand-voices', state: 'instances' }
    ]);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.slots.find((s) => s.slot === 'power')!.pick!.id).toBe('one-thousand-voices');
  });

  it('owning nothing recommends the target build and says so', () => {
    const data = player([]);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.headline).toContain('You own none of this yet');
    expect(verdict.buildable).toBe(false);
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.id).toBe('hezen-vengeance');
    expect(power.pick!.owned).toBe('none');
    expect(verdict.subline).toContain('next unlock');
  });

  it('owning everything makes the whole answer buildable', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    expect(verdict.buildable).toBe(true);
    expect(verdict.headline).toContain('you can build right now');
  });

  it('the add-clear energy slot ships an empty reason, not an invented pick', () => {
    const verdict = recommend(ownsEverything(), 0, 'add-clear');
    const energy = verdict.slots.find((s) => s.slot === 'energy')!;
    expect(energy.pick).toBeNull();
    expect(energy.emptyReason).toContain('boss damage');
    expect(energy.emptyReason).toContain('Inventing one would defeat the point');
  });
});

describe('armor and supers per class', () => {
  it('Titan gets Cuirass and Thundercrash', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    expect(verdict.armor!.id).toBe('cuirass-of-the-falling-star');
    expect(verdict.superRec!.superName).toBe('Thundercrash');
    expect(verdict.superRec!.confidence).toBe('tiered');
  });

  it('Hunter gets Celestial and Golden Gun', () => {
    const verdict = recommend(ownsEverything(), 1, 'boss-burst');
    expect(verdict.armor!.id).toBe('celestial-nighthawk');
    expect(verdict.superRec!.superName).toBe('Golden Gun');
  });

  it('Warlock gets Sanguine and the honest support-role paragraph', () => {
    const verdict = recommend(ownsEverything(), 2, 'boss-burst');
    expect(verdict.armor!.id).toBe('sanguine-alchemy');
    expect(verdict.superRec!.superName).toBe('Well of Radiance');
    expect(verdict.superRec!.confidence).toBe('support-role');
    expect(verdict.superRec!.why).toContain('will not invent one');
  });

  it('armor never crosses class', () => {
    for (const classType of [0, 1, 2] as const) {
      for (const item of armorCandidates('boss-burst', classType)) {
        expect(item.classType, item.id).toBe(classType);
      }
    }
  });

  it('Titan armor falls back to Synthoceps when Cuirass is missing', () => {
    const data = player(['synthoceps']);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.armor!.id).toBe('synthoceps');
    expect(verdict.armorIdealNote).toContain('Cuirass of the Falling Star');
    expect(verdict.superRec!.fallbackNote).toContain('Cuirass');
  });

  it('Warlock armor falls back to Lunafactions when Sanguine is missing', () => {
    const data = player(['lunafaction-boots']);
    const verdict = recommend(data, 2, 'boss-burst');
    expect(verdict.armor!.id).toBe('lunafaction-boots');
    expect(verdict.armorIdealNote).toContain('Sanguine Alchemy');
  });

  it('Hunter armor falls back to Shards before Star-Eater, per the dev insight', () => {
    const data = player(['shards-of-galanor', 'star-eater-scales']);
    const verdict = recommend(data, 1, 'boss-burst');
    expect(verdict.armor!.id).toBe('shards-of-galanor');
  });

  it('the Shards fallback switches the super call to Blade Barrage', () => {
    const data = player(['shards-of-galanor']);
    const verdict = recommend(data, 1, 'boss-burst');
    expect(verdict.superRec!.superName).toBe('Blade Barrage');
    expect(verdict.superRec!.confidence).toBe('dev-insight');
    expect(verdict.superRec!.fallbackNote).toContain('Celestial Nighthawk');
  });

  it('an unowned ideal still anchors the armor call when nothing else exists', () => {
    const data = player([]);
    const verdict = recommend(data, 1, 'boss-burst');
    expect(verdict.armor!.id).toBe('celestial-nighthawk');
    expect(verdict.armor!.owned).toBe('none');
  });
});

describe('the Well/Golden Gun warning fires exactly when Golden Gun is recommended', () => {
  const hasWarning = (verdict: ReturnType<typeof recommend>) =>
    verdict.warnings.some((w) => w.id === WELL_GOLDEN_GUN_WARNING.id);

  it('Hunter with Celestial: yes', () => {
    expect(hasWarning(recommend(player(['celestial-nighthawk']), 1, 'boss-burst'))).toBe(true);
  });

  it('Hunter owning nothing (Celestial is still the recommendation): yes', () => {
    expect(hasWarning(recommend(player([]), 1, 'boss-burst'))).toBe(true);
  });

  it('Hunter with Star-Eater only (Golden Gun still the class call): yes', () => {
    expect(hasWarning(recommend(player(['star-eater-scales']), 1, 'boss-burst'))).toBe(true);
  });

  it('Hunter on the Shards fallback (Blade Barrage, not Golden Gun): no', () => {
    expect(hasWarning(recommend(player(['shards-of-galanor']), 1, 'boss-burst'))).toBe(false);
  });

  it('Titan: never', () => {
    expect(hasWarning(recommend(ownsEverything(), 0, 'boss-burst'))).toBe(false);
  });

  it('Warlock: never', () => {
    expect(hasWarning(recommend(ownsEverything(), 2, 'boss-burst'))).toBe(false);
  });

  it('the warning tells the Hunter to step out of the Well for the shot', () => {
    const verdict = recommend(ownsEverything(), 1, 'boss-burst');
    const warning = verdict.warnings.find((w) => w.id === WELL_GOLDEN_GUN_WARNING.id)!;
    expect(warning.title).toContain('OUTSIDE');
    expect(warning.body).toContain('Step out of the Well');
    expect(warning.body).toContain('Kinetic surges no longer stack');
  });
});

describe('fireteam notes and their warnings', () => {
  it('caps at the top three support jobs by tier', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    expect(verdict.fireteamNotes.map((n) => n.id)).toEqual([
      'tractor-cannon',
      'lumina',
      'no-hesitation'
    ]);
  });

  it('adds Divinity when the power pick is the Queenbreaker', () => {
    const data = player(['the-queenbreaker', 'divinity']);
    const verdict = recommend(data, 0, 'boss-sustained');
    expect(verdict.fireteamNotes.map((n) => n.id)).toContain('divinity');
  });

  it('adds Divinity when the power pick is Thunderlord', () => {
    const data = player(['thunderlord']);
    const verdict = recommend(data, 0, 'boss-sustained');
    expect(verdict.fireteamNotes.map((n) => n.id)).toContain('divinity');
  });

  it('and with Divinity on the page, the Pantheon warning is hard-coded on', () => {
    const data = player(['thunderlord']);
    const verdict = recommend(data, 0, 'boss-sustained');
    const warning = verdict.warnings.find((w) => w.id === DIVINITY_PANTHEON_WARNING.id)!;
    expect(warning.body).toContain('Pantheon');
    expect(warning.body).toContain('Insurrection Prime');
    expect(warning.body).toContain('9.7.0.3');
  });

  it('no Divinity seat when the power pick is a rocket', () => {
    const data = player(['hezen-vengeance']);
    const verdict = recommend(data, 0, 'boss-burst');
    expect(verdict.fireteamNotes.map((n) => n.id)).not.toContain('divinity');
    expect(verdict.warnings.some((w) => w.id === DIVINITY_PANTHEON_WARNING.id)).toBe(false);
  });

  it('Tractor in the notes brings the refresh rules along', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    const warning = verdict.warnings.find((w) => w.id === TRACTOR_REFRESH_WARNING.id)!;
    expect(warning.body).toContain('Echo of Undermining');
    expect(warning.body).toContain('does NOT extend');
  });

  it('support notes carry ownership so a missing Tractor is visible', () => {
    const verdict = recommend(player([]), 0, 'boss-burst');
    const tractor = verdict.fireteamNotes.find((n) => n.id === 'tractor-cannon')!;
    expect(tractor.owned).toBe('none');
  });
});

describe('champions mode', () => {
  it('annotates every weapon pick in master mode', () => {
    const verdict = recommend(ownsEverything(), 0, 'master-champions');
    for (const slot of verdict.slots) {
      expect(slot.pick!.champion, slot.slot).not.toBeNull();
    }
  });

  it('does not annotate outside master mode', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    for (const slot of verdict.slots) {
      expect(slot.pick!.champion).toBeNull();
    }
  });

  it('derives the stun from the manifest frame', () => {
    const verdict = recommend(ownsEverything(), 0, 'master-champions');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.id).toBe('hezen-vengeance');
    expect(power.pick!.champion!.stuns).toBe('Unstoppable');
    expect(power.pick!.champion!.label).toContain('Aggressive Frame');
  });

  it('is honest about exotic intrinsics with no published mapping', () => {
    const data = player(['izanagis-burden']);
    const verdict = recommend(data, 0, 'master-champions');
    const kinetic = verdict.slots.find((s) => s.slot === 'kinetic')!;
    expect(kinetic.pick!.id).toBe('izanagis-burden');
    expect(kinetic.pick!.champion!.stuns).toBeNull();
    expect(kinetic.pick!.champion!.label).toContain('community testing pending');
  });

  it('summarises coverage per champion type', () => {
    const verdict = recommend(ownsEverything(), 0, 'master-champions');
    expect(verdict.championSummary).not.toBeNull();
    const summary = verdict.championSummary!.join(' ');
    expect(summary).toContain('no activation criteria');
    expect(summary).toContain('Barrier');
    expect(summary).toContain('Unstoppable');
    expect(summary).toContain('Overload');
  });

  it('says when a champion type is not covered instead of hand-waving', () => {
    // Praedyth (Rapid-Fire, Overload) + Hezen (Aggressive, Unstoppable) +
    // Ergo Sum (frame rolls, unknown): Barrier goes uncovered.
    const data = player(['praedyths-revenge', 'hezen-vengeance', 'ergo-sum']);
    const verdict = recommend(data, 0, 'master-champions');
    const barrier = verdict.championSummary!.find((line) => line.startsWith('Barrier'))!;
    expect(barrier).toContain('not covered');
  });

  it('no champion summary outside master mode', () => {
    expect(recommend(ownsEverything(), 0, 'boss-burst').championSummary).toBeNull();
  });
});

describe('next unlock', () => {
  it('owning nothing points at the top of tier 1', () => {
    const unlock = nextUnlock(player([]), 0);
    expect(unlock!.id).toBe('hezen-vengeance');
    expect(unlock!.acquisition).toContain('Vault of Glass');
  });

  it('never points at armor for another class', () => {
    const everythingButWarlockArmor = player(
      Object.keys(ownsEverything().owned).filter(
        (id) => !['sanguine-alchemy', 'lunafaction-boots', 'briarbinds'].includes(id)
      )
    );
    const titanUnlock = nextUnlock(everythingButWarlockArmor, 0);
    expect(titanUnlock).toBeNull();
    const warlockUnlock = nextUnlock(everythingButWarlockArmor, 2);
    expect(warlockUnlock!.id).toBe('sanguine-alchemy');
  });

  it('is one item, the best one, not a shopping list', () => {
    const data = player(['hezen-vengeance']);
    const unlock = nextUnlock(data, 0);
    expect(unlock!.id).toBe('cuirass-of-the-falling-star');
  });

  it('owning everything for your class returns null honestly', () => {
    expect(nextUnlock(ownsEverything(), 0)).toBeNull();
  });

  it('quotes the sheet on why the unlock is worth it', () => {
    const unlock = nextUnlock(player([]), 0)!;
    expect(unlock.reason).toBe('Best general burst damage.');
    expect(unlock.reasonIsQuote).toBe(true);
    expect(unlock.source).toContain('Aegis');
  });

  it('adds the cipher line when the unlock is a Monument purchase', () => {
    const everythingButQueenbreaker = player(
      Object.keys(ownsEverything().owned).filter((id) => id !== 'the-queenbreaker'),
      { ciphers: 2 }
    );
    const unlock = nextUnlock(everythingButQueenbreaker, 0)!;
    expect(unlock.id).toBe('the-queenbreaker');
    expect(unlock.cipherLine).toContain('You have 2 Exotic Ciphers');
    expect(unlock.cipherLine).toContain('Monument to Lost Lights');
  });

  it('no cipher line when the unlock is not sold there', () => {
    const unlock = nextUnlock(player([], { ciphers: 5 }), 0)!;
    expect(unlock.id).toBe('hezen-vengeance');
    expect(unlock.cipherLine).toBeNull();
  });
});

describe('the standing cipher pointer', () => {
  it('names the best missing tier 1 or 2 Monument exotic', () => {
    const pointer = cipherPointer(player([], { ciphers: 3 }));
    expect(pointer).toContain('You have 3 Exotic Ciphers');
    expect(pointer).toContain('The Queenbreaker');
  });

  it('moves down the list as the player acquires', () => {
    const pointer = cipherPointer(player(['the-queenbreaker'], { ciphers: 1 }));
    expect(pointer).toContain('1 Exotic Cipher:');
    expect(pointer).toContain('Thunderlord');
  });

  it('is silent with no ciphers', () => {
    expect(cipherPointer(player([], { ciphers: 0 }))).toBeNull();
  });

  it('is silent when the cipher count is unreadable, rather than guessing', () => {
    expect(cipherPointer(player([], { ciphers: null }))).toBeNull();
  });

  it('is silent when nothing tier 1 or 2 from the Monument is missing', () => {
    expect(cipherPointer(ownsEverything())).toBeNull();
  });

  it('singular and plural ciphers read correctly', () => {
    expect(cipherPointer(player([], { ciphers: 1 }))).toContain('1 Exotic Cipher:');
    expect(cipherPointer(player([], { ciphers: 2 }))).toContain('2 Exotic Ciphers');
  });
});

describe('rolls and catalysts surface on picks', () => {
  it('a Hezen with the roll gets the confirmation line', () => {
    const data = player([
      {
        id: 'hezen-vengeance',
        instanceIds: ['h1'],
        plugs: { h1: [] }
      }
    ]);
    // Overwrite with a real roll via the ownership fixtures in ownership.test;
    // here the socket row exists but is empty, so the roll is missing.
    const verdict = recommend(data, 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.roll).toBe('missing-roll');
    expect(power.pick!.rollLine).toContain('the roll is what earns the tier');
  });

  it('an unreadable catalyst is reported unknown in the pick', () => {
    const data = player([{ id: 'izanagis-burden', state: 'collections' }]);
    const verdict = recommend(data, 0, 'boss-burst');
    const kinetic = verdict.slots.find((s) => s.slot === 'kinetic')!;
    expect(kinetic.pick!.id).toBe('izanagis-burden');
    expect(kinetic.pick!.catalyst).toBe('unknown');
    expect(kinetic.pick!.catalystLine).toContain('unknown');
  });

  it('weapons without a wanted roll carry no roll chatter', () => {
    const verdict = recommend(player(['apex-predator']), 0, 'boss-burst');
    const power = verdict.slots.find((s) => s.slot === 'power')!;
    expect(power.pick!.rollLine).toBeNull();
  });
});

describe('pvp honesty', () => {
  it('returns the out-of-scope verdict instead of half an answer', () => {
    const verdict = recommend(ownsEverything(), 0, 'pvp');
    expect(verdict.outOfScope).not.toBeNull();
    expect(verdict.outOfScope!.body).toContain('does not transfer to the Crucible');
    expect(verdict.slots).toEqual([]);
    expect(verdict.nextUnlock).toBeNull();
    expect(verdict.rotation).toBeNull();
    expect(verdict.warnings).toEqual([]);
  });
});

describe('the stamp', () => {
  it('is in every verdict subline', () => {
    for (const activity of ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'] as const) {
      const verdict = recommend(ownsEverything(), 0, activity);
      expect(verdict.subline, activity).toContain('Update 9.7.0.4, 28 July 2026');
    }
  });

  it('class notes ride along with their sources', () => {
    const verdict = recommend(ownsEverything(), 2, 'boss-burst');
    const text = verdict.classNotes.map((n) => n.note).join(' ');
    expect(text).toContain('support and economy class');
    expect(text).toContain('Grapple melee');
    for (const note of verdict.classNotes) expect(note.source.length).toBeGreaterThan(4);
  });

  it('the grapple note explains additive versus multiplicative', () => {
    const verdict = recommend(ownsEverything(), 0, 'boss-burst');
    const grapple = verdict.classNotes.find((n) => n.note.includes('Grapple'))!;
    expect(grapple.note).toContain('additive');
    expect(grapple.source).toContain('2026-06-04');
  });
});
