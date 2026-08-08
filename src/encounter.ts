// The encounter-aware layer over the engine. Pure, like recommend():
// encounter facts from src/data/encounters.ts plus one player's profile in,
// an encounter verdict out. Every adjustment it makes carries the id of the
// sourced rule that caused it; an adjustment with no rule id is a bug the
// tests are supposed to catch.

import {
  NO_CONSENSUS_LINE,
  hasLoadoutConsensus,
  ruleLine,
  type Encounter,
  type EncounterActivity,
  type SpecialRule
} from './data/encounters';
import { BAKED_ITEMS } from './data/items';
import type { CuratedItem } from './data/tiers';
import {
  alternativeLoadouts,
  recommend,
  DEMOTE_RANK_DELTA,
  PROMOTE_RANK_DELTA,
  type AdjustReason,
  type EncounterAdjust,
  type LoadoutAlternative,
  type Verdict
} from './recommend';
import type { Activity, GuardianClass, PlayerData } from './types';

// ------------------------------------------------------- tracking heuristic

/**
 * Which weapons count as "tracking" for the setpiece rule (Oryx, The
 * Witness: tracking and tether do not function). Deliberately conservative:
 * only exotics whose INTRINSIC projectiles home, read from the manifest
 * frame name, count. Legendary rockets track only via an optional Tracking
 * Module barrel, which is a per-roll choice this data cannot see, so they
 * are not excluded; the page says to leave that barrel off instead.
 * Deathbringer's guided seekers are a judgement call the sources do not
 * settle, so it is flagged in words rather than excluded.
 */
export const TRACKING_FRAMES: ReadonlyMap<string, string> = new Map([
  ['Prototype Trueseeker', 'Truth'],
  ['Eyes on All', 'Eyes of Tomorrow'],
  ['Twintails', 'Two-Tailed Fox']
]);

export const TRACKING_HEURISTIC_NOTE =
  'Tracking heuristic, stated so you can audit it: only exotics whose intrinsic projectiles home (Truth, Eyes of Tomorrow, Two-Tailed Fox) are excluded. Legendary rockets only track via an optional Tracking Module barrel, which rolls cannot be read for; leave that barrel off here. Deathbringer\'s guided seekers are not auto-excluded because the sources do not settle them; judge that one yourself.';

export function isTrackingFrame(frame: string | null): boolean {
  return frame !== null && TRACKING_FRAMES.has(frame);
}

// ----------------------------------------------------------- rule utilities

function findRule(encounter: Encounter, id: string): SpecialRule | null {
  return encounter.specialRules.find((r) => r.id === id) ?? null;
}

function hasRule(encounter: Encounter, id: string): boolean {
  return findRule(encounter, id) !== null;
}

/**
 * Range bands a point-blank weapon simply cannot reach. The brief records a
 * band on most encounters; reading it is not a new claim, it is using the
 * research that is already in the file instead of waiting for somebody to
 * hand-write a sword-unfriendly rule per fight.
 */
const OUT_OF_SWORD_RANGE: ReadonlySet<string> = new Set(['far', 'mid-far']);

/** Mid range: a sword reaches, badly. Demoted rather than excluded. */
const AWKWARD_SWORD_RANGE: ReadonlySet<string> = new Set(['mid']);

function isSwordUnfriendly(encounter: Encounter): boolean {
  return (
    (encounter.range !== null && OUT_OF_SWORD_RANGE.has(encounter.range)) ||
    hasRule(encounter, 'sword-unfriendly')
  );
}

function isSetpiece(encounter: Encounter): boolean {
  return hasRule(encounter, 'setpiece');
}

function typeNameOf(item: CuratedItem): string {
  return BAKED_ITEMS[item.id]?.itemTypeDisplayName ?? '';
}

function frameOf(item: CuratedItem): string | null {
  return BAKED_ITEMS[item.id]?.frame ?? null;
}

const CRIT_DEPENDENT_TYPES = new Set(['Sniper Rifle', 'Linear Fusion Rifle']);
const POINT_BLANK_TYPES = new Set(['Sword', 'Glaive']);

// --------------------------------------------------------------- the adjust

/**
 * The encounter's rules, compiled into the engine's adjustment hooks. Only
 * rules the research states produce hooks; an encounter with no keyed rules
 * returns undefined and the engine runs exactly as it does for the generic
 * modes.
 */
export function buildEncounterAdjust(encounter: Encounter): EncounterAdjust | undefined {
  const namedSwordRule = findRule(encounter, 'sword-unfriendly');
  const swordReason: AdjustReason | null = isSwordUnfriendly(encounter)
    ? namedSwordRule
      ? { ruleId: namedSwordRule.id, text: namedSwordRule.text }
      : {
          ruleId: 'far-range',
          text:
            'The brief records this damage check at ' +
            String(encounter.range) +
            ' range; point-blank weapons cannot reach it. (Range is community knowledge unless the brief marks it verified.)'
        }
    : null;
  const proxyRule = findRule(encounter, 'proxy');
  const setpieceRule = findRule(encounter, 'setpiece');
  const sniperDrRule = findRule(encounter, 'sniper-dr');
  const swordBonusRule = findRule(encounter, 'sword-bonus');
  // A mid-range band demotes point-blank weapons, unless the fight already
  // has a sword bonus stated (Crota), where the sourced rule wins outright.
  const awkwardRange =
    !swordReason &&
    !swordBonusRule &&
    encounter.range !== null &&
    AWKWARD_SWORD_RANGE.has(encounter.range);

  if (!swordReason && !proxyRule && !setpieceRule && !sniperDrRule && !swordBonusRule && !awkwardRange) {
    return undefined;
  }

  const exclude = (item: CuratedItem): AdjustReason | null => {
    if (swordReason && POINT_BLANK_TYPES.has(typeNameOf(item))) {
      return swordReason;
    }
    if (setpieceRule && isTrackingFrame(frameOf(item))) {
      return { ruleId: setpieceRule.id, text: setpieceRule.text };
    }
    return null;
  };

  const demoteReason = (item: CuratedItem): AdjustReason | null => {
    if (proxyRule && CRIT_DEPENDENT_TYPES.has(typeNameOf(item))) {
      return { ruleId: proxyRule.id, text: proxyRule.text };
    }
    if (sniperDrRule && typeNameOf(item) === 'Sniper Rifle') {
      return { ruleId: sniperDrRule.id, text: sniperDrRule.text };
    }
    if (awkwardRange && POINT_BLANK_TYPES.has(typeNameOf(item))) {
      return {
        ruleId: 'mid-range',
        text:
          'The brief records this damage check at mid range. Point-blank weapons still reach it, but not comfortably, so they are demoted here rather than excluded. (Range is community knowledge unless the brief marks it verified.)'
      };
    }
    return null;
  };

  const promoteReason = (item: CuratedItem): AdjustReason | null => {
    if (swordBonusRule && typeNameOf(item) === 'Sword') {
      return { ruleId: swordBonusRule.id, text: swordBonusRule.text };
    }
    return null;
  };

  return {
    exclude,
    rankDelta: (item) =>
      demoteReason(item) ? DEMOTE_RANK_DELTA : promoteReason(item) ? PROMOTE_RANK_DELTA : 0,
    note: (item) => demoteReason(item) ?? promoteReason(item)
  };
}

// -------------------------------------------------------------- mode choice

/**
 * Which of the engine's sourced modes an encounter's window maps to. Long
 * sustained windows (over 60 seconds on the Bosses tab) run the sustained
 * pools; everything else, including the unknown Pantheon windows, runs the
 * generic burst pools, which is exactly the "generic boss DPS applies"
 * fallback the research prescribes for gaps.
 */
export function encounterMode(encounter: Encounter): Activity {
  if (encounter.window?.style === 'sustained') return 'boss-sustained';
  return 'boss-burst';
}

// -------------------------------------------------------------------- cards

export interface EncounterCard {
  ruleId: string;
  tone: 'warning' | 'bonus' | 'info';
  title: string;
  body: string;
  source: string;
  confidence: SpecialRule['confidence'];
}

const CARD_META: Record<string, { tone: EncounterCard['tone']; title: string }> = {
  proxy: { tone: 'warning', title: 'Proxy target: crits and debuffs are dead here' },
  setpiece: { tone: 'warning', title: 'Setpiece boss: tracking and tether do not work' },
  'sniper-dr': { tone: 'warning', title: 'Anti-sniper damage resistance' },
  'global-dr': { tone: 'warning', title: 'Global damage resistance' },
  'caiatl-dr': { tone: 'warning', title: '90 percent resistance without Waking Resonance' },
  'non-super-dr': { tone: 'warning', title: 'Supers first: 35 percent resistance to everything else' },
  'explosive-dr': { tone: 'warning', title: 'Explosive damage reduced outside the raised window' },
  'divinity-zero': { tone: 'warning', title: 'Divinity does zero damage here' },
  'divinity-cage-teammates': { tone: 'warning', title: 'Divinity cage for teammates: unconfirmed' },
  'channeled-super-risk': { tone: 'warning', title: 'Channeled supers are risky here' },
  'shield-mechanic': { tone: 'warning', title: 'The shield only breaks by mechanic' },
  'phase-cap': { tone: 'warning', title: 'Hard phase cap' },
  'plate-zero': { tone: 'warning', title: 'Wrong plate, no damage' },
  'wipe-screen-2x': { tone: 'warning', title: 'The wipe screen lies' },
  'fake-boost': { tone: 'warning', title: 'The 25 percent banner is fake' },
  'add-pressure': { tone: 'warning', title: 'Adds flood the damage spot' },
  'no-crit': { tone: 'warning', title: 'No crit spot' },
  'sword-unfriendly': { tone: 'warning', title: 'Point-blank weapons do not work here' },
  'sword-bonus': { tone: 'bonus', title: 'Swords hit 35 percent harder here' },
  'plate-bonus': { tone: 'bonus', title: 'Double damage on the plate' },
  'head-impact-2x': { tone: 'bonus', title: 'Head takes double impact damage' },
  'essence-bonus': { tone: 'bonus', title: 'Unstable Essence: +50 percent' },
  'surrounded-hop': { tone: 'bonus', title: 'Surrounded perks work while riding' },
  'cluster-bombs': { tone: 'bonus', title: 'Cluster Bombs get full value here' },
  'elite-scaling': { tone: 'bonus', title: 'Elite scaling, not boss scaling' },
  'atheon-multiplier': { tone: 'bonus', title: 'Sheet claim: 5x damage' },
  'unstable-light': { tone: 'info', title: 'Unstable Light' },
  'platform-lethal': { tone: 'info', title: 'The platform is lethal' },
  'test-target': { tone: 'info', title: 'The canonical test target' },
  'cheese-standard': { tone: 'info', title: 'The cheese is still the standard' },
  'tether-gate': { tone: 'info', title: 'Tether gates the damage phase' },
  'div-bubble': { tone: 'info', title: 'Divinity bubble placement' },
  'split-body': { tone: 'info', title: 'Split bodies' },
  'splash-favoured': { tone: 'info', title: 'Splash damage favoured' },
  'drop-note': { tone: 'info', title: 'Drops here' },
  'long-range-fit': { tone: 'info', title: 'The sourced fit: manual-aim long range' },
  'community-loadout': { tone: 'info', title: 'Community loadout on record' },
  'epic-dr-unknown': { tone: 'warning', title: 'Epic version: unknown' },
  'choice-mechanic': { tone: 'info', title: 'Choice mechanic' }
};

function cardFor(rule: SpecialRule): EncounterCard {
  const meta = CARD_META[rule.id] ?? { tone: 'info' as const, title: rule.id };
  return {
    ruleId: rule.id,
    tone: meta.tone,
    title: meta.title,
    body: ruleLine(rule),
    source: rule.source,
    confidence: rule.confidence
  };
}

const TONE_ORDER: Record<EncounterCard['tone'], number> = { warning: 0, bonus: 1, info: 2 };

// ---------------------------------------------------------------- verdicts

export interface EncounterVerdict {
  activity: EncounterActivity;
  encounter: Encounter;
  /** The engine mode the encounter mapped to, for the honesty line. */
  mode: Activity;
  /** null when the encounter has no damage check. */
  verdict: Verdict | null;
  cards: EncounterCard[];
  /** Alternatives B and C: legal, meaningfully different, best first. */
  alternatives: LoadoutAlternative[];
  /** Replaces the fireteam section on proxy targets, where debuffs are dead. */
  fireteamOverride: string | null;
  /** The channeled-super caution, when the research names one here. */
  superCaution: string | null;
  /** The setpiece heuristic disclosure, when tracking exclusion applies. */
  trackingNote: string | null;
  /** The research GAPS fallback line, when no consensus exists. */
  consensusLine: string | null;
  noDps: { title: string; body: string } | null;
}

export function recommendEncounter(
  player: PlayerData,
  classType: GuardianClass,
  activity: EncounterActivity,
  encounter: Encounter
): EncounterVerdict {
  const cards = [...encounter.specialRules, ...activity.notes]
    .map(cardFor)
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  if (encounter.type === 'none') {
    return {
      activity,
      encounter,
      mode: 'boss-burst',
      verdict: null,
      cards,
      alternatives: [],
      fireteamOverride: null,
      superCaution: null,
      trackingNote: null,
      consensusLine: null,
      noDps: {
        title: 'No damage check here',
        body:
          (encounter.noDpsNote ?? 'The research records no DPS check for this encounter.') +
          ' No loadout is recommended for it, because there is nothing sourced to recommend one for. Pick a boss encounter for the damage answer.'
      }
    };
  }

  const mode = encounterMode(encounter);
  const adjust = buildEncounterAdjust(encounter);
  const verdict = recommend(player, classType, mode, adjust);
  const alternatives = alternativeLoadouts(mode, player, adjust);

  // Encounter-specific honesty around the generic verdict pieces.
  const proxy = findRule(encounter, 'proxy');
  let fireteamOverride: string | null = null;
  if (proxy) {
    fireteamOverride =
      'Debuffs do nothing here. ' +
      ruleLine(proxy) +
      ' The usual fireteam debuff jobs (Tractor Cannon, Divinity) add nothing to this damage check, so nobody needs to carry one.';
    verdict.fireteamNotes = [];
    verdict.warnings = verdict.warnings.filter(
      (w) => w.id !== 'tractor-refresh' && w.id !== 'divinity-pantheon'
    );
    verdict.rotation?.caveats.push(
      'Proxy target: skip the debuff step above. Surges and most debuffs and perks do nothing here (verified); flat damage is the whole plan.'
    );
  }

  if (hasRule(encounter, 'divinity-zero')) {
    verdict.fireteamNotes = verdict.fireteamNotes.filter((n) => n.id !== 'divinity');
  }

  const channeled = findRule(encounter, 'channeled-super-risk');
  const superCaution = channeled
    ? 'Super caution for this fight: ' +
      ruleLine(channeled) +
      ' This page does not maintain a channeled-super list of its own; the caution is the encounter fact, applied to whatever super you bring.'
    : null;

  const trackingNote = isSetpiece(encounter) ? TRACKING_HEURISTIC_NOTE : null;

  const consensusLine = hasLoadoutConsensus(activity, encounter) ? null : NO_CONSENSUS_LINE;

  // The headline becomes the encounter's, honestly derived.
  verdict.headline =
    'The best ' +
    className(classType) +
    ' loadout you can build for ' +
    encounter.name +
    ' (' +
    activity.name +
    ')';
  verdict.subline =
    encounterProfileLine(encounter, mode) + ' ' + verdict.subline;

  return {
    activity,
    encounter,
    mode,
    verdict,
    cards,
    alternatives,
    fireteamOverride,
    superCaution,
    trackingNote,
    consensusLine,
    noDps: null
  };
}

function className(classType: GuardianClass): string {
  return classType === 0 ? 'Titan' : classType === 1 ? 'Hunter' : 'Warlock';
}

/** The one-line damage profile, with unknowns said out loud. */
export function encounterProfileLine(encounter: Encounter, mode: Activity): string {
  const window = encounter.window;
  const seconds =
    window && window.seconds !== null
      ? window.seconds + 's windows'
      : 'window seconds unpublished';
  const style =
    window && window.style !== null
      ? window.style === 'sustained'
        ? 'sustained damage'
        : window.style === 'burst'
          ? 'short burst'
          : 'repeated mid-length windows'
      : 'window style unknown';
  const range = encounter.range !== null ? encounter.range + ' range' : 'range unrecorded';
  const modeLine =
    mode === 'boss-sustained'
      ? 'ranked with the sustained-damage pools'
      : 'ranked with the boss-burst pools';
  return (
    'Damage profile: ' + seconds + ', ' + style + ', ' + range + '; ' + modeLine + '.'
  );
}
