// The engine. Pure: curated dataset + baked manifest facts + one player's
// parsed profile in, one verdict out. No fetching, no DOM, no clock, which is
// why the tests can pin down every rule in it.
//
// The shape of the answer is the product: the best loadout you can build
// right now, what the rotation requires of you, and the single best thing to
// go unlock next. Everything it says carries the source it came from, and
// where the sourced data runs out it says so instead of improvising.

import { championNote, CHAMPIONS_SOURCE, type ChampionNote } from './data/champions';
import { CLASS_NOTES, SUPER_RECOMMENDATIONS, type SuperRecommendation } from './data/class-notes';
import { BAKED_ITEMS, slotLabel, type BakedItem } from './data/items';
import {
  BAIT_AND_SWITCH,
  ENVIOUS_LOOP,
  ROTATION_SOURCE,
  SWAP_EXOTICS,
  TWO_VS_THREE
} from './data/rotations';
import { CURATED, CURATED_BY_ID, DATA_STAMP, type CuratedItem } from './data/tiers';
import { catalystState, rollState } from './ownership';
import type {
  Activity,
  CatalystState,
  GuardianClass,
  Owned,
  PlayerData,
  RollState,
  WeaponSlot
} from './types';
import { CLASS_NAMES } from './types';

export { DATA_STAMP };

// ----------------------------------------------------------------- verdicts

export interface Pick {
  id: string;
  name: string;
  icon: string;
  tierLabel: string;
  /** The Aegis annotation when there is one, else the honest note. */
  reason: string;
  /** True when `reason` is a verbatim quote off the sheet. */
  reasonIsQuote: boolean;
  source: string;
  typeLabel: string;
  slotName: string;
  owned: Owned;
  buildableNow: boolean;
  ownershipLine: string;
  roll: RollState;
  rollLine: string | null;
  catalyst: CatalystState | null;
  catalystLine: string | null;
  champion: ChampionNote | null;
}

export interface SlotAnswer {
  slot: WeaponSlot;
  pick: Pick | null;
  /** Set when the sourced data simply has nothing for this slot and mode. */
  emptyReason: string | null;
  /** Set when a better pick exists that the player cannot build yet. */
  idealNote: string | null;
  /**
   * Set when the one-exotic rule moved this slot's answer: the slot's best
   * weapon is an exotic, the loadout's one exotic lives elsewhere, and the
   * card says so instead of silently showing the runner-up.
   */
  exclusivityNote: string | null;
}

export interface RotationPlan {
  title: string;
  steps: string[];
  caveats: string[];
  source: string;
}

export interface Warning {
  id: string;
  title: string;
  body: string;
  source: string;
}

export interface NextUnlock {
  id: string;
  name: string;
  tierLabel: string;
  reason: string;
  reasonIsQuote: boolean;
  source: string;
  acquisition: string;
  /** "You have N Exotic Ciphers..." when the Monument angle applies. */
  cipherLine: string | null;
}

export interface SuperAnswer extends SuperRecommendation {
  /** Set when the armor pick had to fall back from the headline exotic. */
  fallbackNote: string | null;
}

export interface Verdict {
  activity: Activity;
  classType: GuardianClass;
  headline: string;
  subline: string;
  buildable: boolean;
  slots: SlotAnswer[];
  armor: Pick | null;
  armorEmptyReason: string | null;
  armorIdealNote: string | null;
  superRec: SuperAnswer | null;
  fireteamNotes: Pick[];
  rotation: RotationPlan | null;
  nextUnlock: NextUnlock | null;
  cipherLine: string | null;
  warnings: Warning[];
  championSummary: string[] | null;
  classNotes: Array<{ note: string; source: string }>;
  /** Only for activity 'pvp': the honest refusal. */
  outOfScope: { title: string; body: string } | null;
}

// ------------------------------------------------------------------ helpers

const WEAPON_SLOTS: WeaponSlot[] = ['kinetic', 'energy', 'power'];

function tierRank(item: CuratedItem): number {
  // Untiered entries (dev-insight notes like Shards of Galanor) rank between
  // tiers 3 and 4: above the sheet's own tail, below everything it tiered
  // higher, which is as much as the source supports.
  return item.tier === null ? 3.5 : item.tier;
}

function orderCandidates(items: CuratedItem[]): CuratedItem[] {
  const indexOf = new Map(CURATED.map((item, index) => [item.id, index]));
  return [...items].sort((a, b) => {
    const byTier = tierRank(a) - tierRank(b);
    if (byTier !== 0) return byTier;
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  });
}

function ownedState(id: string, player: PlayerData): Owned {
  return player.owned[id]?.state ?? 'none';
}

/** Buildable right now: a real copy, or a Collections pull for an exotic. */
export function buildableNow(item: CuratedItem, player: PlayerData): boolean {
  const state = ownedState(item.id, player);
  if (state === 'instances') return true;
  if (state === 'collections') return item.exotic;
  return false;
}

export function ownershipLine(item: CuratedItem, state: Owned): string {
  if (state === 'instances') return 'In your inventory. Buildable right now.';
  if (state === 'collections') {
    return item.exotic
      ? 'Unlocked in Collections: pull it from the kiosk and it is buildable right now.'
      : 'Collections knows it, but random-roll legendaries cannot be pulled back out. This one needs a drop.';
  }
  return 'Not owned, in any sense this site can see.';
}

function rollLine(item: CuratedItem, state: RollState): string | null {
  if (!item.wantedRoll || state === 'not-checked') return null;
  if (state === 'has-roll') return 'Your copy has the wanted roll: ' + item.wantedRoll.note;
  if (state === 'missing-roll') {
    return 'None of your copies has the wanted roll (' + item.wantedRoll.note + '). It still works; the roll is what earns the tier.';
  }
  return 'Roll not readable from this profile, so it is reported as unknown rather than guessed.';
}

function catalystLine(item: CuratedItem, state: CatalystState | null): string | null {
  if (!item.catalystMatters || state === null) return null;
  if (state === 'slotted') return 'Catalyst is in this copy. If its objectives are done, it is live.';
  if (state === 'not-slotted') return 'No catalyst in your copy, and the catalyst is part of why this weapon is tiered.';
  return 'Catalyst state unknown: this profile did not expose sockets for a copy, so the honest answer is unknown.';
}

function toPick(item: CuratedItem, player: PlayerData, withChampion: boolean): Pick {
  const baked = BAKED_ITEMS[item.id] as BakedItem | undefined;
  const state = ownedState(item.id, player);
  const roll = rollState(item.id, player);
  const catalyst = item.catalystMatters ? catalystState(item.id, player) : null;
  return {
    id: item.id,
    name: item.name,
    icon: baked?.icon ?? '',
    tierLabel: item.tierLabel,
    reason: item.quote ?? item.note,
    reasonIsQuote: item.quote !== null,
    source: item.source,
    typeLabel: baked?.itemTypeDisplayName ?? (item.kind === 'armor' ? 'Exotic armor' : ''),
    slotName: baked ? slotLabel(baked.slot) : '',
    owned: state,
    buildableNow: buildableNow(item, player),
    ownershipLine: ownershipLine(item, state),
    roll,
    rollLine: rollLine(item, roll),
    catalyst,
    catalystLine: catalystLine(item, catalyst),
    champion: withChampion && item.kind === 'weapon' ? championNote(baked?.frame ?? null) : null
  };
}

// ------------------------------------------------------------------- pieces

export function weaponCandidates(activity: Activity, slot: WeaponSlot): CuratedItem[] {
  return orderCandidates(
    CURATED.filter(
      (item) =>
        item.kind === 'weapon' &&
        !item.supportOnly &&
        item.roles.includes(activity) &&
        BAKED_ITEMS[item.id]?.slot === slot
    )
  );
}

const EMPTY_SLOT_REASONS: Partial<Record<Activity, Partial<Record<WeaponSlot, string>>>> = {
  'add-clear': {
    energy:
      'The Aegis sheet ranks boss damage, and none of its tiered energy weapons is an add-clear pick. Inventing one would defeat the point of this site: run whichever energy primary you enjoy.'
  }
};

function emptySlotReason(activity: Activity, slot: WeaponSlot): string {
  const specific = EMPTY_SLOT_REASONS[activity]?.[slot];
  if (specific) return specific;
  return (
    'The sourced tier list has nothing for this slot in this mode, and this site does not fill gaps with guesses. Anything you like goes here.'
  );
}

// ------------------------------------------------------- the one-exotic rule
//
// Destiny allows at most ONE equipped exotic weapon across the three slots
// (and at most one exotic armor piece). Rarity is a manifest fact, read from
// the build-time bake (tierType 6 = exotic), never from anyone's memory.
// Slots are therefore not picked greedily: every legal way to spend the one
// exotic weapon slot is enumerated, scored by the functions below, and the
// best legal combination wins. The scoring is exported and unit-tested so
// the tie-break is inspectable, not folklore.

export function isExoticWeapon(item: CuratedItem): boolean {
  return item.kind === 'weapon' && BAKED_ITEMS[item.id]?.tierType === 6;
}

/**
 * Slot quality, lower is better. A buildable pick keeps its tier rank
 * (1..4, untiered 3.5); a pick the player cannot build yet carries the tier
 * rank plus UNBUILDABLE_PENALTY, so any buildable pick outranks any target
 * pick; an empty slot is EMPTY_SLOT_QUALITY, worse than the worst real pick.
 */
export const UNBUILDABLE_PENALTY = 4;
export const EMPTY_SLOT_QUALITY = 9;

export function slotQuality(item: CuratedItem | null, buildable: boolean): number {
  if (item === null) return EMPTY_SLOT_QUALITY;
  return tierRank(item) + (buildable ? 0 : UNBUILDABLE_PENALTY);
}

/** One slot of a candidate combination, before it becomes a card. */
export interface ComboSlot {
  slot: WeaponSlot;
  item: CuratedItem | null;
  buildable: boolean;
}

export interface LoadoutScore {
  /** Picks the player can build right now. More is better; compared first. */
  buildableCount: number;
  /** Summed slotQuality over the three slots. Lower is better; second. */
  totalQuality: number;
  /**
   * slotQuality of the centerpiece, the rotation's primary damage weapon:
   * buildRotation dumps the power pick in every plan except the
   * kinetic-anchored loops, so the centerpiece is the power pick when there
   * is one, else kinetic, else energy. Lower is better; compared last.
   */
  centerpieceQuality: number;
}

export function scoreLoadout(slots: ComboSlot[]): LoadoutScore {
  let buildableCount = 0;
  let totalQuality = 0;
  for (const entry of slots) {
    if (entry.item !== null && entry.buildable) buildableCount += 1;
    totalQuality += slotQuality(entry.item, entry.buildable);
  }
  const centerpiece =
    slots.find((entry) => entry.slot === 'power' && entry.item !== null) ??
    slots.find((entry) => entry.slot === 'kinetic' && entry.item !== null) ??
    slots.find((entry) => entry.slot === 'energy' && entry.item !== null) ??
    null;
  return {
    buildableCount,
    totalQuality,
    centerpieceQuality: centerpiece
      ? slotQuality(centerpiece.item, centerpiece.buildable)
      : EMPTY_SLOT_QUALITY
  };
}

/**
 * Positive when `a` is the better loadout, negative when `b` is, zero on a
 * dead tie. Maximising summed quality is what keeps the exotic in the slot
 * whose legendary fallback drops off worst; the centerpiece comparison then
 * prefers the combination whose primary damage weapon is strongest.
 */
export function compareLoadouts(a: LoadoutScore, b: LoadoutScore): number {
  if (a.buildableCount !== b.buildableCount) return a.buildableCount - b.buildableCount;
  if (a.totalQuality !== b.totalQuality) return b.totalQuality - a.totalQuality;
  return b.centerpieceQuality - a.centerpieceQuality;
}

/** The slot rule the whole site runs on: first buildable, else the target. */
function poolPick(pool: CuratedItem[], player: PlayerData): CuratedItem | null {
  return pool.find((item) => buildableNow(item, player)) ?? pool[0] ?? null;
}

function exclusionLine(
  displaced: CuratedItem,
  equipped: CuratedItem,
  fallback: CuratedItem | null,
  slot: WeaponSlot,
  player: PlayerData
): string {
  const claim = buildableNow(displaced, player)
    ? displaced.name + ' is the best ' + slot + ' pick you own'
    : displaced.name + ' is the sheet\'s ' + slot + ' pick';
  const rule =
    ', but you can only equip one exotic weapon and this loadout\'s exotic is ' +
    equipped.name +
    '; ';
  if (fallback === null) {
    return (
      claim + rule + 'the sheet tiers no legendary for this slot, so run whichever ' + slot + ' weapon you like.'
    );
  }
  const fallbackKind = isExoticWeapon(fallback) ? 'pick' : 'legendary';
  return claim + rule + 'the best ' + fallbackKind + ' here is ' + fallback.name + ' (' + fallback.tierLabel + ').';
}

/**
 * The legal-combination search. For each candidate way to spend the one
 * exotic weapon slot (each exotic candidate in any slot, plus "no exotic"),
 * fill every slot with the usual first-buildable-else-target rule over the
 * candidates that choice allows, score the combination, and keep the best.
 * Options are tried in sheet order with "no exotic" last, so a dead tie
 * resolves to the sheet's own ranking.
 */
export function chooseWeaponSlots(
  activity: Activity,
  player: PlayerData,
  withChampion: boolean
): SlotAnswer[] {
  const pools = WEAPON_SLOTS.map((slot) => ({ slot, pool: weaponCandidates(activity, slot) }));

  const exoticOptions: Array<CuratedItem | null> = orderCandidates(
    pools.flatMap(({ pool }) => pool.filter((item) => isExoticWeapon(item)))
  );
  exoticOptions.push(null);

  let best: { exotic: CuratedItem | null; combo: ComboSlot[]; score: LoadoutScore } | null = null;
  for (const exotic of exoticOptions) {
    const combo = pools.map(({ slot, pool }) => {
      const allowed = pool.filter((item) => !isExoticWeapon(item) || item.id === exotic?.id);
      const item = poolPick(allowed, player);
      return { slot, item, buildable: item !== null && buildableNow(item, player) };
    });
    const score = scoreLoadout(combo);
    if (best === null || compareLoadouts(score, best.score) > 0) best = { exotic, combo, score };
  }
  const winner = best!;

  // The exotic the winning combination actually equips. The allowed exotic
  // can go unused when a better non-exotic holds its slot, and a note must
  // never blame an exotic that is not on the loadout.
  const equipped =
    winner.combo.map((entry) => entry.item).find((item) => item !== null && isExoticWeapon(item)) ??
    null;

  return pools.map(({ slot, pool }, index) => {
    if (pool.length === 0) {
      return {
        slot,
        pick: null,
        emptyReason: emptySlotReason(activity, slot),
        idealNote: null,
        exclusivityNote: null
      };
    }
    const chosen = winner.combo[index].item;
    // What this slot would say if Destiny allowed a second exotic. When the
    // rule changed the answer, the item that lost the seat is that exotic,
    // and the card says so instead of quietly showing the runner-up.
    const unconstrained = poolPick(pool, player)!;
    const displaced = chosen?.id !== unconstrained.id && equipped !== null ? unconstrained : null;

    if (chosen === null) {
      return {
        slot,
        pick: null,
        emptyReason: null,
        idealNote: null,
        exclusivityNote: displaced ? exclusionLine(displaced, equipped!, null, slot, player) : null
      };
    }

    const allowed = pool.filter((item) => !isExoticWeapon(item) || item.id === winner.exotic?.id);
    const ideal = allowed[0];
    const idealNote =
      chosen.id === ideal.id
        ? null
        : 'The sheet\'s pick for this slot is ' +
          ideal.name +
          ' (' +
          ideal.tierLabel +
          '), which you cannot build yet. ' +
          ideal.acquisition;
    return {
      slot,
      pick: toPick(chosen, player, withChampion),
      emptyReason: null,
      idealNote,
      exclusivityNote: displaced ? exclusionLine(displaced, equipped!, chosen, slot, player) : null
    };
  });
}

/**
 * The rule, asserted at the door of every verdict: at most one exotic weapon
 * across the slots, at most one exotic armor piece. chooseWeaponSlots makes
 * a violation impossible by construction today; the throw is here so a
 * future change cannot quietly ship an illegal loadout.
 */
export function assertLegalExotics(weaponPicks: Pick[], armorPicks: Pick[]): void {
  const exoticWeapons = weaponPicks.filter((pick) => BAKED_ITEMS[pick.id]?.tierType === 6);
  if (exoticWeapons.length > 1) {
    throw new Error(
      'Illegal loadout: ' +
        exoticWeapons.map((pick) => pick.name).join(' + ') +
        ' are both exotic weapons, and Destiny equips at most one.'
    );
  }
  const exoticArmor = armorPicks.filter((pick) => BAKED_ITEMS[pick.id]?.tierType === 6);
  if (exoticArmor.length > 1) {
    throw new Error(
      'Illegal loadout: ' +
        exoticArmor.map((pick) => pick.name).join(' + ') +
        ' are both exotic armor, and Destiny equips at most one.'
    );
  }
}

export function armorCandidates(activity: Activity, classType: GuardianClass): CuratedItem[] {
  return orderCandidates(
    CURATED.filter(
      (item) =>
        item.kind === 'armor' &&
        !item.supportOnly &&
        item.roles.includes(activity) &&
        BAKED_ITEMS[item.id]?.classType === classType
    )
  );
}

export function pickArmor(
  activity: Activity,
  classType: GuardianClass,
  player: PlayerData
): { pick: Pick | null; emptyReason: string | null; idealNote: string | null } {
  const candidates = armorCandidates(activity, classType);
  if (candidates.length === 0) {
    return {
      pick: null,
      emptyReason:
        'The sheet tiers no ' + CLASS_NAMES[classType] + ' damage exotic for this mode, so no armor call is made here.',
      idealNote: null
    };
  }
  const ideal = candidates[0];
  const best = candidates.find((item) => buildableNow(item, player)) ?? ideal;
  const idealNote =
    best.id === ideal.id
      ? null
      : 'The sheet\'s pick is ' + ideal.name + ' (' + ideal.tierLabel + '), which you cannot build yet. ' + ideal.acquisition;
  return { pick: toPick(best, player, false), emptyReason: null, idealNote };
}

export function superForClass(classType: GuardianClass, armorPick: Pick | null): SuperAnswer {
  const base = SUPER_RECOMMENDATIONS.find((s) => s.classType === classType)!;
  // The one substitution the sources support: a Hunter whose armor pick fell
  // back to Shards of Galanor is being pointed at Blade Barrage, because the
  // dev insight puts the reworked Shards burst near Cuirass Thundercrash.
  if (classType === 1 && armorPick && armorPick.id === 'shards-of-galanor') {
    const shards = CURATED_BY_ID.get('shards-of-galanor')!;
    return {
      classType,
      superName: 'Blade Barrage',
      armorId: 'shards-of-galanor',
      why: shards.note,
      source: shards.source,
      confidence: 'dev-insight',
      fallbackNote:
        'Celestial Nighthawk is the sheet\'s Hunter pick; this is the dev-insight fallback because you cannot build Celestial yet.'
    };
  }
  const fallbackNote =
    armorPick && armorPick.id !== base.armorId
      ? 'The super call assumes ' +
        (CURATED_BY_ID.get(base.armorId)?.name ?? base.armorId) +
        '; your buildable armor pick is ' +
        armorPick.name +
        ', so treat the super as the target, not the guarantee.'
      : null;
  return { ...base, fallbackNote };
}

export function fireteamNotes(
  activity: Activity,
  player: PlayerData,
  withChampion: boolean,
  powerPickId: string | null = null
): Pick[] {
  const ranked = orderCandidates(
    CURATED.filter((item) => item.supportOnly && item.roles.includes(activity))
  );
  const chosen = ranked.slice(0, 3);
  // Divinity's own annotation names Thunderlord and Queenbreaker, so when one
  // of those is the power pick it earns a seat even past the cap.
  if (
    (powerPickId === 'the-queenbreaker' || powerPickId === 'thunderlord') &&
    !chosen.some((item) => item.id === 'divinity')
  ) {
    const divinity = ranked.find((item) => item.id === 'divinity');
    if (divinity) chosen.push(divinity);
  }
  return chosen.map((item) => toPick(item, player, withChampion));
}

// ----------------------------------------------------------------- warnings

export const WELL_GOLDEN_GUN_WARNING: Warning = {
  id: 'well-overrides-golden-gun',
  title: 'Stand OUTSIDE the Well for Golden Gun',
  body:
    'Verified oddity: Well of Radiance overrides Radiant for Golden Gun and the overridden result is weaker. Step out of the Well, take the shot, step back in. Kinetic surges no longer stack with Golden Gun either.',
  source: 'Aegis FAQ; framework long-stable'
};

export const DIVINITY_PANTHEON_WARNING: Warning = {
  id: 'divinity-pantheon',
  title: 'Divinity is disabled on Pantheon and Insurrection Prime',
  body:
    'Since hotfix 9.7.0.3, Divinity is disabled entirely on Pantheon and against Insurrection Prime. This is hard-coded here on purpose; do not bring it to those fights.',
  source: 'Bungie hotfix 9.7.0.3 notes',
};

export const TRACTOR_REFRESH_WARNING: Warning = {
  id: 'tractor-refresh',
  title: 'Keeping the 30 percent up',
  body:
    'Tractor\'s 30 percent weaken (verified) can be extended by timer-based weakens: Echo of Undermining or Snare Bomb refresh the clock. Tether does NOT extend it; Tether is its own debuff.',
  source: 'Aegis FAQ'
};

// ----------------------------------------------------------------- rotation

/**
 * The rotation is derived FROM the final slots, never the other way around:
 * recommend() chooses the legal loadout first (one-exotic rule applied),
 * then this function reads only those picks. A rotation can therefore never
 * describe a weapon the exclusivity rule just removed.
 */
export function buildRotation(
  slots: SlotAnswer[],
  classType: GuardianClass,
  player: PlayerData,
  activity: Activity
): RotationPlan | null {
  const bySlot = new Map(slots.map((s) => [s.slot, s.pick]));
  const power = bySlot.get('power') ?? null;
  const kinetic = bySlot.get('kinetic') ?? null;

  const wantsBaitAndSwitch =
    power !== null &&
    (CURATED_BY_ID.get(power.id)?.wantedRoll?.columns.some((column) =>
      column.includes('Bait and Switch')
    ) ??
      false);

  if (wantsBaitAndSwitch && power) {
    const steps = [...BAIT_AND_SWITCH.steps];
    const caveats = [...BAIT_AND_SWITCH.caveats];
    const gjallarhorn = CURATED_BY_ID.get('gjallarhorn')!;
    const ownsGjally = buildableNow(gjallarhorn, player);
    caveats.push(
      (ownsGjally
        ? 'You own Gjallarhorn: hand it to ONE teammate. '
        : 'You do not own Gjallarhorn yet; one teammate should bring it. ') +
        'Wolfpack Rounds add roughly 25 to 30 percent on base rocket damage (verified, Aegis FAQ), and one is enough for the whole fireteam.'
    );
    const swaps = SWAP_EXOTICS.filter((s) => s.className === CLASS_NAMES[classType]);
    if (swaps.length > 0) {
      caveats.push(
        'Swap-speed exotics for rocket reload-cancelling, fastest first: ' +
          SWAP_EXOTICS.map((s) => s.name + ' ' + s.seconds.toFixed(3) + 's (' + s.className + ')').join(' < ') +
          '. The ' +
          CLASS_NAMES[classType] +
          ' options: ' +
          swaps.map((s) => s.name).join(', ') +
          '. Wearing one trades away your damage armor exotic; that trade is yours to make.'
      );
    } else {
      caveats.push(
        'The measured swap-speed exotics (Rain of Fire 2.366s, Dragon\'s Shadow 2.383s, Radiant Dance Machines 2.732s; Aegis FAQ) are Warlock and Hunter armor. A ' +
          CLASS_NAMES[classType] +
          ' generally keeps its damage exotic on instead.'
      );
    }
    return {
      title: BAIT_AND_SWITCH.title + ' with ' + power.name,
      steps,
      caveats,
      source: BAIT_AND_SWITCH.source
    };
  }

  if (activity === 'add-clear') {
    return {
      title: 'Add clear is not a rotation',
      steps: [
        'Tag groups as they spawn; the tiered picks here are the ones that keep firing without reload downtime.',
        'Save your super for the moment the room tips, not for a damage phase.'
      ],
      caveats: [
        'The sourced sheet ranks boss damage. Its add-clear advice is thinner than its boss advice, and this page says so rather than dressing it up.'
      ],
      source: ROTATION_SOURCE
    };
  }

  if (kinetic?.id === 'izanagis-burden') {
    return {
      title: TWO_VS_THREE.title,
      steps: [...TWO_VS_THREE.steps],
      caveats: [...TWO_VS_THREE.caveats],
      source: TWO_VS_THREE.source
    };
  }

  if (kinetic?.id === 'witherhoard') {
    return {
      title: ENVIOUS_LOOP.title,
      steps: [...ENVIOUS_LOOP.steps],
      caveats: [...ENVIOUS_LOOP.caveats],
      source: ENVIOUS_LOOP.source
    };
  }

  if (activity === 'boss-sustained' && power) {
    return {
      title: 'Sustained pressure with ' + power.name,
      steps: [
        'Get the fireteam\'s debuff on the boss first: one debuff per enemy, highest wins, and it multiplies with everything you fire.',
        'Hold ' + power.name + ' on the crit spot for as long as the phase lasts.',
        (kinetic ? kinetic.name : 'Your kinetic') + ' covers the gaps while heavy ammo comes back.'
      ],
      caveats: [
        'No timing windows to memorise in this one; the discipline is staying on the crit spot.'
      ],
      source: ROTATION_SOURCE
    };
  }

  if (power) {
    return {
      title: 'Burst with ' + power.name,
      steps: [
        'Get the fireteam\'s debuff on first: one debuff per enemy, highest wins.',
        'Dump ' + power.name + ' into the crit spot while your damage buffs are up.',
        'Fire the special weapons between heavy bricks; primaries are for the walk back.'
      ],
      caveats: [],
      source: ROTATION_SOURCE
    };
  }

  return null;
}

// -------------------------------------------------------------- next unlock

export function nextUnlock(player: PlayerData, classType: GuardianClass): NextUnlock | null {
  const candidates = orderCandidates(
    CURATED.filter((item) => {
      if (item.kind === 'armor' && BAKED_ITEMS[item.id]?.classType !== classType) return false;
      return ownedState(item.id, player) === 'none';
    })
  );
  const best = candidates[0];
  if (!best) return null;
  return {
    id: best.id,
    name: best.name,
    tierLabel: best.tierLabel,
    reason: best.quote ?? best.note,
    reasonIsQuote: best.quote !== null,
    source: best.source,
    acquisition: best.acquisition,
    cipherLine: cipherLineFor(best, player)
  };
}

function cipherLineFor(item: CuratedItem, player: PlayerData): string | null {
  if (!item.monument || player.ciphers === null || player.ciphers < 1) return null;
  return cipherSentence(player.ciphers, item.name);
}

function cipherSentence(count: number, name: string): string {
  return (
    'You have ' +
    count +
    ' Exotic Cipher' +
    (count === 1 ? '' : 's') +
    ': the Monument to Lost Lights sells ' +
    name +
    ' for one, plus materials.'
  );
}

/**
 * The standing cipher pointer: the best tier 1 or 2 Monument exotic the
 * player lacks, independent of what the next unlock happens to be.
 */
export function cipherPointer(player: PlayerData): string | null {
  if (player.ciphers === null || player.ciphers < 1) return null;
  const missing = orderCandidates(
    CURATED.filter(
      (item) =>
        item.monument === true &&
        item.tier !== null &&
        item.tier <= 2 &&
        ownedState(item.id, player) === 'none'
    )
  );
  if (missing.length === 0) return null;
  return cipherSentence(player.ciphers, missing[0].name);
}

// ----------------------------------------------------------------- verdicts

const PVP_OUT_OF_SCOPE = {
  title: 'PvP is out of scope, on purpose',
  body:
    'The dataset behind this site is the Aegis boss damage sheet, and boss DPS reasoning does not transfer to the Crucible. Rather than half-doing PvP with numbers nobody verified, this version does not do it. The PvE answers are real; a PvP tab pretending to be one would not be.'
};

export function recommend(
  player: PlayerData,
  classType: GuardianClass,
  activity: Activity
): Verdict {
  const classNotes = CLASS_NOTES.filter(
    (n) => n.classType === null || n.classType === classType
  ).map((n) => ({ note: n.note, source: n.source }));

  if (activity === 'pvp') {
    return {
      activity,
      classType,
      headline: 'No PvP verdict, and that is the verdict',
      subline: PVP_OUT_OF_SCOPE.body,
      buildable: false,
      slots: [],
      armor: null,
      armorEmptyReason: null,
      armorIdealNote: null,
      superRec: null,
      fireteamNotes: [],
      rotation: null,
      nextUnlock: null,
      cipherLine: null,
      warnings: [],
      championSummary: null,
      classNotes,
      outOfScope: PVP_OUT_OF_SCOPE
    };
  }

  const withChampion = activity === 'master-champions';
  const slots = chooseWeaponSlots(activity, player, withChampion);
  const armorAnswer = pickArmor(activity, classType, player);
  const superRec = superForClass(classType, armorAnswer.pick);
  const powerPickId = slots.find((s) => s.slot === 'power')?.pick?.id ?? null;
  const notes = fireteamNotes(activity, player, withChampion, powerPickId);
  const rotation = buildRotation(slots, classType, player, activity);
  const unlock = nextUnlock(player, classType);
  const cipher = cipherPointer(player);

  const warnings: Warning[] = [];
  if (superRec.superName === 'Golden Gun') warnings.push(WELL_GOLDEN_GUN_WARNING);
  const mentionsDivinity =
    notes.some((n) => n.id === 'divinity') || slots.some((s) => s.pick?.id === 'divinity');
  if (mentionsDivinity) warnings.push(DIVINITY_PANTHEON_WARNING);
  if (notes.some((n) => n.id === 'tractor-cannon')) warnings.push(TRACTOR_REFRESH_WARNING);

  const picks = slots.map((s) => s.pick).filter((p): p is Pick => p !== null);
  assertLegalExotics(picks, armorAnswer.pick ? [armorAnswer.pick] : []);
  const buildable =
    picks.length > 0 && picks.every((p) => p.buildableNow) && (armorAnswer.pick?.buildableNow ?? true);
  const ownedCount = picks.filter((p) => p.buildableNow).length;

  let championSummary: string[] | null = null;
  if (withChampion) {
    championSummary = [
      'Anti-Champion 2.0: dedicated champion mods are gone. Every weapon stuns by its frame, no activation criteria (' +
        CHAMPIONS_SOURCE +
        ').'
    ];
    const covered = new Set<string>();
    for (const pick of picks) {
      if (pick.champion?.stuns) covered.add(pick.champion.stuns);
    }
    for (const type of ['Barrier', 'Unstoppable', 'Overload'] as const) {
      championSummary.push(
        covered.has(type)
          ? type + ': covered by this loadout.'
          : type + ': not covered by a mapped frame in this loadout. Check your other slots or lean on abilities.'
      );
    }
  }

  const headline = buildable
    ? 'The best ' + CLASS_NAMES[classType] + ' ' + activityPhrase(activity) + ' loadout you can build right now'
    : ownedCount > 0
      ? 'The best you can build right now, and what is missing'
      : 'You own none of this yet: here is the target build';

  const subline =
    (buildable
      ? 'Every pick below is in your inventory or one Collections pull away. '
      : ownedCount > 0
        ? 'Picks you can build are shown as yours; where the sheet\'s first choice is missing, the fallback is shown and the gap is named. '
        : 'Nothing curated is in this inventory yet, so every pick below is the target rather than the loadout. The next unlock is where to start. ') +
    DATA_STAMP;

  return {
    activity,
    classType,
    headline,
    subline,
    buildable,
    slots,
    armor: armorAnswer.pick,
    armorEmptyReason: armorAnswer.emptyReason,
    armorIdealNote: armorAnswer.idealNote,
    superRec,
    fireteamNotes: notes,
    rotation,
    nextUnlock: unlock,
    cipherLine: cipher,
    warnings,
    championSummary,
    classNotes,
    outOfScope: null
  };
}

function activityPhrase(activity: Activity): string {
  switch (activity) {
    case 'boss-burst':
      return 'boss burst';
    case 'boss-sustained':
      return 'sustained boss';
    case 'add-clear':
      return 'add clear';
    case 'master-champions':
      return 'master content';
    default:
      return '';
  }
}
