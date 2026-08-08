// The encounter database: docs/encounter-research.md, transcribed into types.
//
// HONESTY RULES, inherited from that brief and enforced by tests:
//
// - The brief is the ONLY source of encounter facts in this file. Confidence
//   codes travel with every special rule: V = verified against the cited
//   source, L = likely, long-stable community knowledge, C = contested or
//   sources silent. Anything marked C renders hedged ("reported but
//   unconfirmed"), never as fact. Anything the brief lists under GAPS is
//   rendered as unknown or omitted, never filled in.
// - Window seconds come from the Aegis Bosses tab (V). Range and movement are
//   community knowledge (L) unless the brief flags them verified, and the
//   page says so instead of quietly upgrading them.
// - Encounters with no damage check stay in the list so the selector shows
//   an activity's real shape; they route to a "no damage check here" state
//   instead of a loadout nobody asked the sources about.

export type ActivityKind = 'raid' | 'dungeon' | 'pantheon';
export type Confidence = 'V' | 'L' | 'C';
export type WindowStyle = 'burst' | 'sustained' | 'multi-window';
export type RangeBand = 'close' | 'close-mid' | 'mid' | 'mid-far' | 'far' | 'varying';
export type EncounterType = 'boss' | 'objective' | 'none';

export const RESEARCH_SOURCE = 'Encounter research brief, 2026-08-08';
export const WINDOW_SOURCE = 'Aegis Bosses tab, via ' + RESEARCH_SOURCE;

/** Shown once per encounter page, so nobody mistakes L for V. */
export const PROFILE_CONFIDENCE_NOTE =
  'Window seconds are from the Aegis Bosses tab (verified). Range and movement are community knowledge unless marked verified, and this page says so rather than upgrading them.';

/**
 * The GAPS section's own words: where no per-encounter loadout consensus was
 * published post-Monument, the honest value is generic boss DPS.
 */
export const NO_CONSENSUS_LINE =
  'No encounter-specific loadout consensus is published for this fight; generic boss DPS reasoning applies here (research brief GAPS section).';

export interface SpecialRule {
  /** Stable machine key; the engine and the tests key on these. */
  id: string;
  text: string;
  source: string;
  confidence: Confidence;
  /**
   * True when this rule IS sourced loadout guidance for the encounter, which
   * suppresses the "no consensus" line.
   */
  consensus?: boolean;
}

export interface EncounterWindow {
  /** Seconds from the Aegis Bosses tab, or null where none is published. */
  seconds: number | null;
  /**
   * Derived mechanically from seconds: under 15 is burst, over 60 is
   * sustained, between is multi-window, null when seconds are unpublished.
   */
  style: WindowStyle | null;
  note: string | null;
  source: string;
}

export interface Encounter {
  id: string;
  name: string;
  type: EncounterType;
  /** Present on every boss/objective; seconds may still be null (gap). */
  window: EncounterWindow | null;
  /** null = the brief records no range for this fight; render "unrecorded". */
  range: RangeBand | null;
  movement: string | null;
  crit: string | null;
  specialRules: SpecialRule[];
  /** Why there is nothing to recommend, for type 'none'. */
  noDpsNote?: string;
}

export interface EncounterActivity {
  id: string;
  name: string;
  kind: ActivityKind;
  /** Activity-level rules (nonlinear structure, Epic gap, sustained meta). */
  notes: SpecialRule[];
  encounters: Encounter[];
}

// ------------------------------------------------------------------ helpers

function windowOf(seconds: number | null, note: string | null): EncounterWindow {
  let style: WindowStyle | null = null;
  if (seconds !== null) {
    style = seconds < 15 ? 'burst' : seconds > 60 ? 'sustained' : 'multi-window';
  }
  return { seconds, style, note, source: WINDOW_SOURCE };
}

function rule(
  id: string,
  text: string,
  confidence: Confidence = 'V',
  extra: { source?: string; consensus?: boolean } = {}
): SpecialRule {
  return {
    id,
    text,
    source: extra.source ?? RESEARCH_SOURCE,
    confidence,
    ...(extra.consensus ? { consensus: true } : {})
  };
}

function none(id: string, name: string, noDpsNote: string): Encounter {
  return {
    id,
    name,
    type: 'none',
    window: null,
    range: null,
    movement: null,
    crit: null,
    specialRules: [],
    noDpsNote
  };
}

/** Renders one rule line with its confidence made visible, never upgraded. */
export function ruleLine(r: SpecialRule): string {
  if (r.confidence === 'C') {
    return 'Reported but unconfirmed: ' + r.text + ' Single-source or contested; treat as a rumour with a citation.';
  }
  if (r.confidence === 'L') {
    return r.text + ' (Community-reported, long-stable; not re-verified this pass.)';
  }
  return r.text;
}

// Shared rule bodies, one definition so wording cannot drift between the
// encounters that share a mechanic.

const PROXY_RULE = (who: string) =>
  rule(
    'proxy',
    who +
      ' is a proxy target: base damage only, no crits, and surges and most debuffs and perks do nothing. Flat damage wins; crit-dependent weapons lose their edge here.'
  );

const SETPIECE_RULE = (who: string) =>
  rule(
    'setpiece',
    who +
      ' is a setpiece boss: projectile tracking and tethering do not work. Tracking heavies and tether are out; manual aim is the whole game.'
  );

const SNIPER_DR_RULE = rule(
  'sniper-dr',
  'Damage resistance overrides here: 40 percent vs Sleeper Simulant, 45 percent vs snipers, 55 percent vs shotguns. Snipers are demoted on this page for that reason.'
);

const SHIELD_RULE = (detail: string) =>
  rule('shield-mechanic', detail);

// --------------------------------------------------------------------- raids

const VAULT_OF_GLASS: EncounterActivity = {
  id: 'vault-of-glass',
  name: 'Vault of Glass',
  kind: 'raid',
  notes: [],
  encounters: [
    none('waking-ruins', 'Waking Ruins', 'No DPS check: open the vault.'),
    none('confluxes', 'Confluxes', 'No DPS check: defend the confluxes.'),
    none('oracles', 'Oracles', 'No DPS check: kill oracles in order.'),
    {
      id: 'templar',
      name: 'Templar',
      type: 'boss',
      window: windowOf(15, 'Raised windows, extendable by blocking the teleport.'),
      range: 'close-mid',
      movement: 'Light movement; detain bubbles must be shot out or they suppress you.',
      crit: null,
      specialRules: [
        rule(
          'explosive-dr',
          'The Templar takes reduced explosive damage OUTSIDE its raised state (Ritual of Negation). Non-explosive precision is the safe default between windows; explosives are fine inside the raised window.'
        ),
        rule(
          'cluster-bombs',
          'Cluster Bombs rockets: all 8 clusters can hit the Templar, roughly 22.15 percent over base rocket damage; the cluster portion is not multiplied by Pack Hunter.'
        ),
        rule(
          'channeled-super-risk',
          'Detain bubbles suppress. Getting detained cancels what you were doing, so channeled supers are a gamble here.',
          'L'
        )
      ]
    },
    none('gorgons', 'Gorgons', 'No DPS check: do not be seen.'),
    none(
      'gatekeepers',
      'Gatekeepers',
      'Sustained miniboss clear with no burst check; the brief records no boss damage profile here.'
    ),
    {
      id: 'atheon',
      name: 'Atheon',
      type: 'boss',
      window: windowOf(30, "Time's Vengeance."),
      range: 'close',
      movement: 'Light movement from the center pool; supplicants force hops.',
      crit: 'Head.',
      specialRules: [
        rule(
          'atheon-multiplier',
          'Sheet claim: Atheon currently takes 5x damage (and "normally 3x grenade damage"), which would one-phase him trivially.',
          'C'
        )
      ]
    }
  ]
};

const KINGS_FALL: EncounterActivity = {
  id: 'kings-fall',
  name: "King's Fall",
  kind: 'raid',
  notes: [],
  encounters: [
    none('portal', 'Portal', 'No DPS check: open the portal.'),
    none('totems', 'Totems', 'No DPS check: hold the totems.'),
    {
      id: 'warpriest',
      name: 'Warpriest',
      type: 'boss',
      window: windowOf(45, 'Brand window, extendable via Brand Claimer steals.'),
      range: 'close',
      movement: null,
      crit: 'Head.',
      specialRules: []
    },
    {
      id: 'golgoroth',
      name: 'Golgoroth',
      type: 'boss',
      window: windowOf(20, 'Per gaze bubble, chained up to six times.'),
      range: 'close-mid',
      movement: 'Damage from the pool while a gaze holder keeps his eyes.',
      crit: 'Stomach, and only while gazed.',
      specialRules: [
        rule('unstable-light', 'The Unstable Light bomb deals 13,501 damage to whoever carries it into the pool.')
      ]
    },
    {
      id: 'daughters',
      name: 'Daughters of Oryx',
      type: 'boss',
      window: windowOf(null, 'Two bosses, one per phase; no window seconds published on the Bosses tab.'),
      range: 'mid',
      movement: null,
      crit: null,
      specialRules: [rule('platform-lethal', 'The raised platform is lethal; falling into the mechanic mid-damage ends your phase.')]
    },
    {
      id: 'oryx',
      name: 'Oryx',
      type: 'boss',
      window: windowOf(24.8, 'Per stagger, plus a final stand.'),
      range: 'far',
      movement: null,
      crit: 'Chest.',
      specialRules: [SETPIECE_RULE('Oryx')]
    }
  ]
};

const LAST_WISH: EncounterActivity = {
  id: 'last-wish',
  name: 'Last Wish',
  kind: 'raid',
  notes: [],
  encounters: [
    {
      id: 'kalli',
      name: 'Kalli',
      type: 'boss',
      window: windowOf(30, 'Roughly 30 seconds.'),
      range: 'close',
      movement: null,
      crit: 'Head.',
      specialRules: [rule('head-impact-2x', 'The head hitbox takes 2x impact damage.')]
    },
    {
      id: 'shuro-chi',
      name: 'Shuro Chi',
      type: 'boss',
      window: windowOf(12.9, 'Per break, six times.'),
      range: 'close-mid',
      movement: null,
      crit: 'Head.',
      specialRules: [
        rule('head-impact-2x', 'The head hitbox takes 2x impact damage.'),
        rule(
          'test-target',
          'Shuro Chi is the canonical DPS-testing target, and her 2x head multiplier inflates naive damage comparisons made there.',
          'L'
        )
      ]
    },
    {
      id: 'morgeth',
      name: 'Morgeth',
      type: 'boss',
      window: windowOf(30, null),
      range: 'close',
      movement: null,
      crit: 'Awkward ogre crit.',
      specialRules: [SNIPER_DR_RULE]
    },
    none('the-vault', 'The Vault', 'No DPS check: the puzzle room.'),
    {
      id: 'riven',
      name: 'Riven',
      type: 'boss',
      window: windowOf(14.95, 'Legit-fight basis: bottom floor. The mouth volley is a stationary close burst.'),
      range: 'close',
      movement: null,
      crit: 'The face shows 2x visually.',
      specialRules: [
        SNIPER_DR_RULE,
        rule(
          'cheese-standard',
          'The cheese remains the standard approach in 2026: guides still teach it (verified), but no explicit post-9.7 retest of it is published, so whether it still functions is community word.',
          'L'
        )
      ]
    },
    none('queenswalk', 'Queenswalk', 'No DPS check: carry the heart.')
  ]
};

const GARDEN_OF_SALVATION: EncounterActivity = {
  id: 'garden-of-salvation',
  name: 'Garden of Salvation',
  kind: 'raid',
  notes: [],
  encounters: [
    none('evade', 'Evade', 'No DPS check: outrun the Consecrated Mind.'),
    none('summon', 'Summon', 'No DPS check: tether the gate open.'),
    {
      id: 'consecrated-mind',
      name: 'Consecrated Mind',
      type: 'boss',
      window: windowOf(20.7, null),
      range: 'close-mid',
      movement: 'Heavy: the boss retreats backwards with projectile-avoidance behaviour (verified).',
      crit: 'Twelve eyes, then the core.',
      specialRules: [
        rule('sword-unfriendly', 'Point-blank weapons do not keep up: the boss retreats backwards while you damage it.')
      ]
    },
    {
      id: 'sanctified-mind',
      name: 'Sanctified Mind',
      type: 'boss',
      window: windowOf(17.4, null),
      range: 'far',
      movement: 'Ground-vs-air hitbox differs.',
      crit: 'Shoot the bottom half of the crit for consistency.',
      specialRules: [
        rule('tether-gate', 'The tether chain gates when damage can happen at all.'),
        rule('div-bubble', 'The Divinity bubble forms under its feet, not on the crit.'),
        rule('sword-unfriendly', 'Swords are not viable: far range and a moving target.')
      ]
    }
  ]
};

const DEEP_STONE_CRYPT: EncounterActivity = {
  id: 'deep-stone-crypt',
  name: 'Deep Stone Crypt',
  kind: 'raid',
  notes: [],
  encounters: [
    {
      id: 'crypt-security',
      name: 'Crypt Security',
      type: 'objective',
      window: windowOf(null, 'Damage objective: six fuses, no published window seconds.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: [PROXY_RULE('Crypt Security')]
    },
    {
      id: 'atraks-1',
      name: 'Atraks-1',
      type: 'boss',
      window: windowOf(2.3, 'Per clone window: the purest short-burst check in the game.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: [PROXY_RULE('Atraks-1')]
    },
    none('rapture-descent', 'Rapture / Descent', 'No boss DPS check: the fall.'),
    {
      id: 'taniks',
      name: 'Taniks',
      type: 'boss',
      window: windowOf(14, 'Per boop window, about three per cycle.'),
      range: 'mid',
      movement: 'Moderate; the chassis drifts.',
      crit: null,
      specialRules: [
        rule('no-crit', 'Floating chassis with no crit spot.', 'L'),
        rule('sword-unfriendly', 'The chassis drifts; swords chase it badly.', 'L')
      ]
    }
  ]
};

const VOW_OF_THE_DISCIPLE: EncounterActivity = {
  id: 'vow-of-the-disciple',
  name: 'Vow of the Disciple',
  kind: 'raid',
  notes: [],
  encounters: [
    none('acquisition', 'Acquisition', 'No DPS check: deliver the symbols.'),
    {
      id: 'caretaker',
      name: 'The Caretaker',
      type: 'boss',
      window: windowOf(7.5, 'Effective seconds per plate stint, three floors; long total uptime.'),
      range: 'close',
      movement: 'Plate to plate as stuns rotate.',
      crit: null,
      specialRules: [
        rule('plate-bonus', 'The Caretaker takes 2x damage while you stand on the plate. Stand on the plate.'),
        rule('fake-boost', 'The past-threshold "25 percent boost" is display-only. It is fake; plan around the plate, not the banner.')
      ]
    },
    none('exhibition', 'Exhibition', 'No DPS check: carry the relics.'),
    {
      id: 'rhulk',
      name: 'Rhulk',
      type: 'boss',
      window: windowOf(36, null),
      range: 'mid',
      movement: 'The boss roams; beams force repositioning (verified).',
      crit: 'Four crit spots; the exploding crits are purely visual.',
      specialRules: [
        rule(
          'channeled-super-risk',
          'Rhulk roams and his beams force repositioning (verified), so stationary channeled supers are risky here.'
        )
      ]
    }
  ]
};

const ROOT_OF_NIGHTMARES: EncounterActivity = {
  id: 'root-of-nightmares',
  name: 'Root of Nightmares',
  kind: 'raid',
  notes: [],
  encounters: [
    none('cataclysm', 'Cataclysm', 'No boss DPS check: seed the light.'),
    none('scission', 'Scission', 'No boss DPS check: link the sides.'),
    {
      id: 'zoaurc',
      name: "Zo'aurc",
      type: 'boss',
      window: windowOf(10, 'Per plate, two alternating plates, post-threshold timer.'),
      range: 'close-mid',
      movement: 'Plate-to-plate movement mid-phase.',
      crit: null,
      specialRules: [
        rule('plate-zero', 'Damage from the wrong plate counts for nothing.', 'L')
      ]
    },
    {
      id: 'nezarec',
      name: 'Nezarec',
      type: 'boss',
      window: windowOf(30, null),
      range: 'close',
      movement: 'Teleports; node rotation continues through damage.',
      crit: null,
      specialRules: [
        rule(
          'channeled-super-risk',
          'Nezarec has a suppressing melee that cancels active supers and channels. Keep distance when he lunges; channeled supers can be wiped off mid-cast.'
        )
      ]
    }
  ]
};

const CROTAS_END: EncounterActivity = {
  id: 'crotas-end',
  name: "Crota's End",
  kind: 'raid',
  notes: [],
  encounters: [
    none('abyss', 'Abyss', 'No DPS check: cross the dark.'),
    none('bridge', 'Bridge', 'No boss DPS check: build the bridge.'),
    {
      id: 'ir-yut',
      name: 'Ir Yut',
      type: 'boss',
      window: windowOf(45, 'The liturgy window.'),
      range: 'close-mid',
      movement: null,
      crit: 'Wizard crit.',
      specialRules: []
    },
    {
      id: 'crota',
      name: 'Crota',
      type: 'boss',
      window: windowOf(30, 'Cycles: gun-stagger, then the sword relic finishes.'),
      range: null,
      movement: null,
      crit: null,
      specialRules: [
        rule('sword-bonus', 'Crota takes 35 percent MORE damage from swords. This is the sword encounter; bring one.'),
        rule('channeled-super-risk', 'Oversoul burst checks punish channeled supers mid-phase.', 'L')
      ]
    }
  ]
};

const SALVATIONS_EDGE: EncounterActivity = {
  id: 'salvations-edge',
  name: "Salvation's Edge",
  kind: 'raid',
  notes: [],
  encounters: [
    none('substratum', 'Substratum', 'No DPS check: the resonance plumbing.'),
    {
      id: 'herald-of-finality',
      name: 'Herald of Finality',
      type: 'boss',
      window: windowOf(30, null),
      range: 'close-mid',
      movement: null,
      crit: null,
      specialRules: [
        rule('add-pressure', 'Taken adds flood at close range during damage (verified); survivability is part of the DPS check.')
      ]
    },
    none('repository', 'Repository', 'No DPS check: move the resonance.'),
    none('verity', 'Verity', 'No boss DPS check: the dissection puzzle.'),
    {
      id: 'witness',
      name: 'The Witness',
      type: 'boss',
      window: windowOf(45, null),
      range: 'far',
      movement: 'Moderate movement, dynamic wave attacks (verified).',
      crit: null,
      specialRules: [
        SETPIECE_RULE('The Witness'),
        rule(
          'long-range-fit',
          'Manual-aim long-range weapons (snipers, linear fusions, Still Hunt with Nighthawk) are the fit the brief records for this fight.',
          'V',
          { consensus: true }
        )
      ]
    }
  ]
};

const DESERT_PERPETUAL: EncounterActivity = {
  id: 'desert-perpetual',
  name: 'The Desert Perpetual',
  kind: 'raid',
  notes: [
    rule(
      'nonlinear',
      'Nonlinear raid: three wings in any order, then Koregos. Exotic: Whirling Ovation rocket, from Koregos.'
    ),
    rule(
      'sustained-meta',
      'Longest damage windows in the game: sustained weapons (machine guns, linear fusions, heavy snipers with reserves) outperform one-shot burst across this raid. The loadout-table evidence is verified; the per-class breakdown is community-graded.',
      'V',
      { consensus: true }
    ),
    rule(
      'epic-gap',
      'The Desert Perpetual (Epic) is a distinct harder version with reworked mechanics and bigger health pools (Koregos 1,232,501 vs 840,649 base, verified). Its full mechanics are a research gap; this page describes the base raid only.'
    )
  ],
  encounters: [
    {
      id: 'iatros',
      name: 'Iatros',
      type: 'boss',
      window: windowOf(45.65, 'Base window, extendable via chronon hoops.'),
      range: 'close-mid',
      movement: null,
      crit:
        'The crit ROTATES position by ring colour: white Mid to Bottom to Top, blue Bottom to Top to Mid, red Top to Mid to Bottom (verified).',
      specialRules: [
        rule(
          'non-super-dr',
          'Iatros has 35 percent damage resistance against ALL non-super damage. Super rotations are the answer here; weapons are the filler.',
          'V',
          { consensus: true }
        ),
        rule(
          'epic-dr-unknown',
          'Whether the 35 percent non-super resistance persists in the Epic version: the Epic row omits the note, so it is unknown.',
          'C'
        )
      ]
    },
    {
      id: 'epoptes',
      name: 'Epoptes',
      type: 'boss',
      window: windowOf(90.9, 'Sustained, with eye-sequence extensions.'),
      range: 'close-mid',
      movement: 'Light-cone positioning.',
      crit: 'Shield eyes, then the body.',
      specialRules: []
    },
    {
      id: 'agraios',
      name: 'Agraios',
      type: 'boss',
      window: windowOf(91.5, 'Sustained, up to two extensions per phase.'),
      range: 'varying',
      movement: 'Heavy: teleports, accelerator rings, laser detain.',
      crit: null,
      specialRules: []
    },
    {
      id: 'koregos',
      name: 'Koregos',
      type: 'boss',
      window: windowOf(80, 'Sustained, with mandatory ring-dunk extensions.'),
      range: 'close',
      movement: 'You BOARD the boss. The final stand has vertically shifting crit spots and active repositioning (verified).',
      crit: 'Shifting crit spots in the final stand.',
      specialRules: [
        rule(
          'surrounded-hop',
          'Koregos is not a construct: Surrounded-style perks activate by jumping slightly while riding it.'
        )
      ]
    }
  ]
};

// ------------------------------------------------------------------ dungeons

const SHATTERED_THRONE: EncounterActivity = {
  id: 'shattered-throne',
  name: 'The Shattered Throne',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'vorgeth',
      name: 'Vorgeth',
      type: 'boss',
      window: windowOf(30, 'After the petitioner cleanse; a wipe timer runs.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: []
    },
    {
      id: 'dul-incaru',
      name: 'Dul Incaru',
      type: 'boss',
      window: windowOf(45, 'After the crystal knights.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: [
        rule('elite-scaling', 'Dul Incaru takes ELITE (not boss) damage scaling, so Wardcliff-class weapons overperform here.')
      ]
    }
  ]
};

const PIT_OF_HERESY: EncounterActivity = {
  id: 'pit-of-heresy',
  name: 'Pit of Heresy',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'zulmak',
      name: 'Zulmak',
      type: 'boss',
      window: windowOf(50, 'After dunk-empowered crystals.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: []
    }
  ]
};

const PROPHECY: EncounterActivity = {
  id: 'prophecy',
  name: 'Prophecy',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'phalanx-echo',
      name: 'Phalanx Echo',
      type: 'boss',
      window: windowOf(50, null),
      range: 'close',
      movement: 'Small arena with knockback.',
      crit: null,
      specialRules: []
    },
    {
      id: 'kell-echo',
      name: 'Kell Echo',
      type: 'boss',
      window: windowOf(105, 'Sustained; the safe corridor moves.'),
      range: 'far',
      movement: 'Moving safe corridor.',
      crit: null,
      specialRules: [
        rule('wipe-screen-2x', 'The wipe screen reports 2x the damage you actually dealt. Do not calibrate anything against it.'),
        rule('sword-unfriendly', 'Far range: no swords, no shotgun-range picks.')
      ]
    }
  ]
};

const GRASP_OF_AVARICE: EncounterActivity = {
  id: 'grasp-of-avarice',
  name: 'Grasp of Avarice',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'phryzhia',
      name: "Phry'zhia",
      type: 'boss',
      window: windowOf(30, null),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: []
    },
    {
      id: 'avarokk',
      name: 'Avarokk',
      type: 'boss',
      window: windowOf(28, 'After the engram deposits.'),
      range: 'mid',
      movement: null,
      crit: null,
      specialRules: []
    }
  ]
};

const DUALITY: EncounterActivity = {
  id: 'duality',
  name: 'Duality',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'nightmare-of-gahlran',
      name: 'Nightmare of Gahlran',
      type: 'boss',
      window: windowOf(60, null),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: [
        rule('essence-bonus', 'Unstable Essence is worth +50 percent damage here. Collect it before you fire.')
      ]
    },
    {
      id: 'nightmare-of-caiatl',
      name: 'Nightmare of Caiatl',
      type: 'boss',
      window: windowOf(12, 'Per bell, about three bells.'),
      range: null,
      movement: 'Heavy bell-to-bell movement.',
      crit: null,
      specialRules: [
        rule(
          'caiatl-dr',
          'Nightmare of Caiatl has 90 percent damage resistance unless Waking Resonance is active, and a 1.5x crit-multiplier modifier. Damage outside Waking Resonance is wasted.'
        )
      ]
    }
  ]
};

const SPIRE_OF_THE_WATCHER: EncounterActivity = {
  id: 'spire-of-the-watcher',
  name: 'Spire of the Watcher',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'akelous',
      name: 'Akelous',
      type: 'boss',
      window: windowOf(27.8, 'After the twelve eyes.'),
      range: null,
      movement: 'Retreats backwards, airborne.',
      crit: null,
      specialRules: [
        rule('sword-unfriendly', 'Airborne and retreating: swords do not reach it.')
      ]
    },
    {
      id: 'persys',
      name: 'Persys',
      type: 'boss',
      window: windowOf(23, null),
      range: 'close-mid',
      movement: null,
      crit: null,
      specialRules: []
    }
  ]
};

const GHOSTS_OF_THE_DEEP: EncounterActivity = {
  id: 'ghosts-of-the-deep',
  name: 'Ghosts of the Deep',
  kind: 'dungeon',
  notes: [],
  encounters: [
    none(
      'first-encounter',
      'First encounter',
      'No official name is recorded for this encounter (research gap), and dungeon non-boss encounters carry no DPS check.'
    ),
    {
      id: 'ecthar',
      name: 'Ecthar',
      type: 'boss',
      window: windowOf(40, null),
      range: 'close-mid',
      movement: null,
      crit: null,
      specialRules: [
        SHIELD_RULE(
          'Ecthar\'s shield (about 10,800 HP, separate from the 180,621 body) breaks only via the Piercing Light mechanic: abilities and finishers, not weapon damage.'
        )
      ]
    },
    {
      id: 'simmumah',
      name: 'Simmumah',
      type: 'boss',
      window: windowOf(45, null),
      range: 'far',
      movement: null,
      crit: null,
      specialRules: [
        SHIELD_RULE('Same shield rule as Ecthar: only the Piercing Light mechanic breaks it.'),
        rule('sword-unfriendly', 'Far range: point-blank weapons cannot reach the check.')
      ]
    }
  ]
};

const WARLORDS_RUIN: EncounterActivity = {
  id: 'warlords-ruin',
  name: "Warlord's Ruin",
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'rathil',
      name: 'Rathil',
      type: 'boss',
      window: windowOf(20, null),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: []
    },
    {
      id: 'locus-of-wailing-grief',
      name: 'Locus of Wailing Grief',
      type: 'boss',
      window: windowOf(15, 'Per flame, four times.'),
      range: null,
      movement: null,
      crit: null,
      specialRules: []
    },
    {
      id: 'hefnds-vengeance',
      name: "Hefnd's Vengeance",
      type: 'boss',
      window: windowOf(20, 'Windows across three floors.'),
      range: null,
      movement: null,
      crit: null,
      specialRules: []
    }
  ]
};

const VESPERS_HOST: EncounterActivity = {
  id: 'vespers-host',
  name: "Vesper's Host",
  kind: 'dungeon',
  notes: [],
  encounters: [
    none(
      'first-encounter',
      'First encounter',
      'No official name is recorded for this encounter (research gap), and dungeon non-boss encounters carry no DPS check.'
    ),
    {
      id: 'raneiks-unified',
      name: 'Raneiks Unified',
      type: 'boss',
      window: windowOf(15, null),
      range: 'close',
      movement: null,
      crit: 'Splits into multiple servitors; crits still work on the split bodies.',
      specialRules: [
        rule('global-dr', 'Raneiks Unified sits behind roughly 65 percent global damage resistance.'),
        rule('split-body', 'It splits into multiple servitors; crits and debuffs still work on the split bodies.'),
        rule('splash-favoured', 'Splash and AoE damage is favoured into the servitor cluster.', 'L', { consensus: true }),
        rule('drop-note', 'Ice Breaker drops here.')
      ]
    },
    {
      id: 'corrupted-puppeteer',
      name: 'Corrupted Puppeteer',
      type: 'boss',
      window: windowOf(95, 'Sustained; a 45s Sector Purge room-ignition cadence runs underneath.'),
      range: 'mid-far',
      movement: 'Teleports (verified).',
      crit: null,
      specialRules: []
    }
  ]
};

const SUNDERED_DOCTRINE: EncounterActivity = {
  id: 'sundered-doctrine',
  name: 'Sundered Doctrine',
  kind: 'dungeon',
  notes: [],
  encounters: [
    {
      id: 'zoetic-lockset',
      name: 'Zoetic Lockset',
      type: 'boss',
      window: windowOf(81.6, 'Sustained.'),
      range: 'far',
      movement: null,
      crit: 'Randomly opening split body.',
      specialRules: [
        PROXY_RULE('Zoetic Lockset'),
        rule('split-body', 'A randomly opening split body: flat sustained damage into whatever is open.'),
        rule('sword-unfriendly', 'Far range: point-blank weapons cannot reach the check.')
      ]
    },
    {
      id: 'kerrev',
      name: 'Kerrev, the Erased',
      type: 'boss',
      window: windowOf(45.2, null),
      range: 'close-mid',
      movement: 'Drowning dark zones shape the arena.',
      crit: null,
      specialRules: [rule('drop-note', "Finality's Auger drops here.")]
    }
  ]
};

const EQUILIBRIUM: EncounterActivity = {
  id: 'equilibrium',
  name: 'Equilibrium',
  kind: 'dungeon',
  notes: [rule('fireteam-size', 'Equilibrium is a 3-player activity (Renegades).')],
  encounters: [
    none('harvester', 'Harvester', 'Opening encounter: no boss DPS check.'),
    {
      id: 'harrow',
      name: 'Harrow',
      type: 'boss',
      window: windowOf(33.2, 'Close windows; hard cap of three full phases (fuse depletion) plus a weakened wall-cut final window.'),
      range: 'close',
      movement: null,
      crit: null,
      specialRules: [
        rule('phase-cap', 'Hard cap of three full damage phases (fuse depletion), plus a weakened wall-cut final window. Bring enough damage per phase or the math fails.')
      ]
    },
    {
      id: 'dredgen-sere',
      name: 'Dredgen Sere',
      type: 'boss',
      window: windowOf(37.45, null),
      range: 'close-mid',
      movement: 'Arc-inversion arena attack mid-fight.',
      crit: null,
      specialRules: [
        rule('choice-mechanic', 'Compel-vs-kill choice mechanic shapes the fight.'),
        rule(
          'community-loadout',
          'Community loadout on record (Shacknews, verified): Well of Radiance, Parasite, burst rockets. The dungeon exotic is the Heirloom bow.',
          'V',
          { source: 'Shacknews, via ' + RESEARCH_SOURCE, consensus: true }
        )
      ]
    }
  ]
};

// ------------------------------------------------------------------ pantheon

const PANTHEON_GAP_RULE = rule(
  'pantheon-gap',
  'Pantheon 2.0 phase durations are unpublished and no numeric scoring system was found, so no damage-window seconds are shown for these bosses.',
  'C'
);

function pantheonBoss(
  id: string,
  name: string,
  range: RangeBand,
  movement: string | null,
  extraRules: SpecialRule[] = []
): Encounter {
  return {
    id,
    name,
    type: 'boss',
    window: windowOf(null, 'Phase lengths unpublished for Pantheon 2.0; the window is unknown, not assumed.'),
    range,
    movement,
    crit: null,
    specialRules: extraRules
  };
}

const P_ARGOS = pantheonBoss('argos', 'Argos', 'mid', 'Detain diamond; few adds.');
const P_GAHLRAN = pantheonBoss(
  'gahlran',
  'Gahlran',
  'mid',
  'Stun arms; close adds. This loop differs from the 2019 Crown of Sorrow fight, so old guides do not transfer.'
);
const P_CALUS = pantheonBoss('calus', 'Calus', 'mid', 'Four plates, Force of Will, close adds.');
const P_WARPRIEST = pantheonBoss('warpriest', 'Warpriest', 'mid', 'Short setup, many adds.');
const P_CONSECRATED = pantheonBoss('consecrated-mind', 'Consecrated Mind', 'mid-far', 'Backwards-moving.');
const P_MORGETH = pantheonBoss(
  'morgeth',
  'Morgeth',
  'close-mid',
  'Long setup, many close adds. The Last Wish sniper resistance is NOT restated for the Pantheon version in the brief, so it is not claimed here.'
);
const P_INSURRECTION = pantheonBoss('insurrection-prime', 'Insurrection Prime', 'mid-far', 'Brig, phase synergy, few adds.', [
  rule(
    'divinity-zero',
    'Divinity deals ZERO damage to Insurrection Prime and its cage does not damage it (hotfix 9.7.0.3; Fallen Tech specifically blocks the weapon). The scope is this one encounter; Divinity works everywhere else.'
  ),
  rule(
    'divinity-cage-teammates',
    'Whether the zero-damage Divinity cage still forms for teammates on Insurrection Prime is unspecified.',
    'C'
  )
]);

const PANTHEON_CALUS: EncounterActivity = {
  id: 'pantheon-calus-resplendent',
  name: 'Pantheon: Calus Resplendent',
  kind: 'pantheon',
  notes: [PANTHEON_GAP_RULE],
  encounters: [P_ARGOS, P_GAHLRAN, P_CALUS]
};

const PANTHEON_MORGETH: EncounterActivity = {
  id: 'pantheon-morgeth-surpassing',
  name: 'Pantheon: Morgeth Surpassing',
  kind: 'pantheon',
  notes: [PANTHEON_GAP_RULE],
  encounters: [P_WARPRIEST, P_CONSECRATED, P_MORGETH]
};

const PANTHEON_INSURRECTION: EncounterActivity = {
  id: 'pantheon-insurrection-prime',
  name: 'Pantheon: Insurrection Prime Revolutionary',
  kind: 'pantheon',
  notes: [PANTHEON_GAP_RULE],
  encounters: [P_ARGOS, P_GAHLRAN, P_CALUS, P_WARPRIEST, P_CONSECRATED, P_MORGETH, P_INSURRECTION]
};

// ------------------------------------------------------------------- exports

export const ACTIVITIES: EncounterActivity[] = [
  VAULT_OF_GLASS,
  KINGS_FALL,
  LAST_WISH,
  GARDEN_OF_SALVATION,
  DEEP_STONE_CRYPT,
  VOW_OF_THE_DISCIPLE,
  ROOT_OF_NIGHTMARES,
  CROTAS_END,
  SALVATIONS_EDGE,
  DESERT_PERPETUAL,
  SHATTERED_THRONE,
  PIT_OF_HERESY,
  PROPHECY,
  GRASP_OF_AVARICE,
  DUALITY,
  SPIRE_OF_THE_WATCHER,
  GHOSTS_OF_THE_DEEP,
  WARLORDS_RUIN,
  VESPERS_HOST,
  SUNDERED_DOCTRINE,
  EQUILIBRIUM,
  PANTHEON_CALUS,
  PANTHEON_MORGETH,
  PANTHEON_INSURRECTION
];

export const ACTIVITY_BY_ID: ReadonlyMap<string, EncounterActivity> = new Map(
  ACTIVITIES.map((activity) => [activity.id, activity])
);

export function findEncounter(
  activityId: string,
  encounterId: string
): { activity: EncounterActivity; encounter: Encounter } | null {
  const activity = ACTIVITY_BY_ID.get(activityId);
  if (!activity) return null;
  const encounter = activity.encounters.find((e) => e.id === encounterId);
  if (!encounter) return null;
  return { activity, encounter };
}

/** The first encounter with a damage check, for defaulting a fresh pick. */
export function firstDamageEncounter(activity: EncounterActivity): Encounter {
  return activity.encounters.find((e) => e.type !== 'none') ?? activity.encounters[0];
}

/** True when some rule on the encounter or activity is sourced loadout consensus. */
export function hasLoadoutConsensus(activity: EncounterActivity, encounter: Encounter): boolean {
  return (
    encounter.specialRules.some((r) => r.consensus === true) ||
    activity.notes.some((r) => r.consensus === true)
  );
}
