// The full arsenal, lazily. arsenal.json is ~505 KB of manifest bake and the
// first paint never needs it, so this module is the only place allowed to
// import it, and only dynamically. A test enforces that; the budget is real.
//
// Everything else in here is pure functions over the loaded data plus the
// same ProfileResponse the rest of the site parses, so the table the page
// shows is testable without a browser or a network.

import type { Encounter } from './data/encounters';
import { CURATED_BY_ID } from './data/tiers';
import { ITEM_ID_BY_HASH } from './data/items';
import { isTrackingFrame } from './encounter';
import { eachItem, type ProfileResponse } from './ownership';
import type { Activity } from './types';

export interface ArsenalColumn {
  i: number;
  kind: 'trait' | 'origin';
  perks: number[];
}

export interface ArsenalWeapon {
  hash: number;
  name: string;
  icon: string;
  tierType: number;
  slot: 'kinetic' | 'energy' | 'power';
  damageType: number;
  ammoType: number;
  itemTypeDisplayName: string;
  archetype: string;
  frame: string | null;
  collectibleHash?: number;
  columns?: ArsenalColumn[];
}

export interface ArsenalData {
  manifestVersion: string;
  generated: string;
  note: string;
  meta: { iconPrefix: string } & Record<string, unknown>;
  damagePerks: Record<string, { hashes: number[]; note: string; source: string }>;
  perkNames: Record<string, string>;
  weapons: ArsenalWeapon[];
}

let cached: Promise<ArsenalData> | null = null;

/** The one lazy door to arsenal.json. Cached; repeat calls are free. */
export function loadArsenal(): Promise<ArsenalData> {
  if (!cached) {
    cached = import('./data/arsenal.json').then(
      (mod) => (mod as { default: unknown }).default as ArsenalData
    );
  }
  return cached;
}

// ------------------------------------------------------------------- rolls

/**
 * Which of the curated damage perks this exact socket set carries. Pure:
 * plug hashes in, perk names out, in the damage-perk table's own order.
 */
export function damageRollOf(
  plugs: number[],
  damagePerks: ArsenalData['damagePerks']
): string[] {
  const present = new Set(plugs);
  const out: string[] = [];
  for (const [name, perk] of Object.entries(damagePerks)) {
    if (perk.hashes.some((hash) => present.has(hash))) out.push(name);
  }
  return out;
}

/** Every curated damage perk this weapon CAN roll, per its baked pools. */
export function wishlistFor(
  weapon: ArsenalWeapon,
  damagePerks: ArsenalData['damagePerks']
): string[] {
  const poolable = new Set<number>();
  for (const column of weapon.columns ?? []) {
    for (const hash of column.perks) poolable.add(hash);
  }
  const out: string[] = [];
  for (const [name, perk] of Object.entries(damagePerks)) {
    if (perk.hashes.some((hash) => poolable.has(hash))) out.push(name);
  }
  return out;
}

// --------------------------------------------------------------- ownership

export interface OwnedArsenalRow {
  weapon: ArsenalWeapon;
  instanceCount: number;
  /**
   * The union of curated damage perks across all owned instances of this
   * weapon, or null when the profile exposed no sockets for any instance.
   */
  rollPerks: string[] | null;
  /** What it could roll, for the wishlist line when rollPerks is empty. */
  wishlist: string[];
  /** The curated tier label when the sheet tiers this weapon ("sheet says"). */
  tierLabel: string | null;
  curatedId: string | null;
}

/**
 * Every arsenal weapon the profile owns as real instances, with the sockets
 * of each instance read against the damage-perk table. Collections-only
 * unlocks are not "owned" here on purpose: a random-roll legendary in
 * Collections cannot come back with a roll, and this table is about rolls.
 */
export function ownedArsenal(data: ArsenalData, profile: ProfileResponse): OwnedArsenalRow[] {
  const byHash = new Map<number, ArsenalWeapon>();
  for (const weapon of data.weapons) byHash.set(weapon.hash, weapon);

  const socketsByInstance = profile.itemComponents?.sockets?.data ?? {};
  const found = new Map<number, { count: number; instanceIds: string[] }>();
  eachItem(profile, (item) => {
    const hash = item.itemHash ?? 0;
    if (!byHash.has(hash)) return;
    const entry = found.get(hash) ?? { count: 0, instanceIds: [] };
    entry.count += item.quantity ?? 1;
    if (item.itemInstanceId) entry.instanceIds.push(item.itemInstanceId);
    found.set(hash, entry);
  });

  const rows: OwnedArsenalRow[] = [];
  for (const [hash, entry] of found) {
    const weapon = byHash.get(hash)!;
    let sawSockets = false;
    const perks = new Set<string>();
    for (const instanceId of entry.instanceIds) {
      const sockets = socketsByInstance[instanceId]?.sockets;
      if (!sockets) continue;
      sawSockets = true;
      const plugs = sockets.map((s) => s.plugHash ?? 0).filter((h) => h !== 0);
      for (const name of damageRollOf(plugs, data.damagePerks)) perks.add(name);
    }
    const order = Object.keys(data.damagePerks);
    const curatedId = ITEM_ID_BY_HASH.get(hash) ?? null;
    const curated = curatedId ? CURATED_BY_ID.get(curatedId) : null;
    rows.push({
      weapon,
      instanceCount: entry.count,
      rollPerks: sawSockets
        ? [...perks].sort((a, b) => order.indexOf(a) - order.indexOf(b))
        : null,
      wishlist: wishlistFor(weapon, data.damagePerks),
      tierLabel: curated?.tierLabel ?? null,
      curatedId
    });
  }
  return rows;
}

// ----------------------------------------------------------------- ranking

export interface ArsenalFlag {
  ruleId: string;
  text: string;
}

export interface RankedArsenalRow extends OwnedArsenalRow {
  /** Encounter flags: demotions and cautions that apply to this weapon. */
  flags: ArsenalFlag[];
  /** True when the archetype's position in the order is sourced, not filler. */
  archetypeSourced: boolean;
}

export interface RankedArsenal {
  rows: RankedArsenalRow[];
  excluded: Array<{ row: OwnedArsenalRow; flag: ArsenalFlag }>;
  /** The sourced order note, so the ranking is auditable on the page. */
  orderNote: string;
}

/**
 * Archetype orders, each traceable: the burst order is the generic 2026 meta
 * order from the research brief (GameRant 2026-06-26: snipers, rockets,
 * LFRs, GLs); the sustained order is the brief's Desert Perpetual finding
 * (MGs, LFRs, heavy snipers). Archetypes past the sourced prefix are listed
 * after it and flagged as outside the sourced order, not silently ranked.
 */
export const BURST_ARCHETYPE_ORDER = ['sniper', 'rocket', 'linear-fusion', 'heavy-gl'];
export const SUSTAINED_ARCHETYPE_ORDER = ['machine-gun', 'linear-fusion', 'sniper'];
const ARCHETYPE_TAIL = [
  'fusion',
  'breech-gl',
  'trace',
  'rocket-sidearm',
  'sword',
  'glaive',
  'exotic-other'
];

export const BURST_ORDER_SOURCE =
  'Generic 2026 meta order (GameRant 2026-06-26, via the research brief): snipers, rockets, linear fusions, grenade launchers. Everything after those four is listed, not ranked; the sources do not order it.';
export const SUSTAINED_ORDER_SOURCE =
  'Sustained order from the research brief\'s Desert Perpetual finding (loadout-table verified): machine guns, linear fusions, heavy snipers. Everything after those three is listed, not ranked.';

function archetypeOrderFor(mode: Activity): { order: string[]; sourcedCount: number; note: string } {
  if (mode === 'boss-sustained') {
    const order = [
      ...SUSTAINED_ARCHETYPE_ORDER,
      ...['rocket', 'heavy-gl', ...ARCHETYPE_TAIL].filter(
        (a) => !SUSTAINED_ARCHETYPE_ORDER.includes(a)
      )
    ];
    return { order, sourcedCount: SUSTAINED_ARCHETYPE_ORDER.length, note: SUSTAINED_ORDER_SOURCE };
  }
  const order = [
    ...BURST_ARCHETYPE_ORDER,
    ...['machine-gun', ...ARCHETYPE_TAIL].filter((a) => !BURST_ARCHETYPE_ORDER.includes(a))
  ];
  return { order, sourcedCount: BURST_ARCHETYPE_ORDER.length, note: BURST_ORDER_SOURCE };
}

/**
 * Rank the owned arsenal for a mode or encounter. Exclusions and demotions
 * mirror the loadout engine exactly and carry the same rule ids: swords and
 * glaives out at far range or where the brief says point-blank fails,
 * intrinsic-tracking exotics out at setpieces, crit-dependent archetypes
 * demoted on proxy targets, snipers (and Sleeper by name) demoted under the
 * Morgeth/Riven resistances.
 */
export function rankArsenal(
  rows: OwnedArsenalRow[],
  mode: Activity,
  encounter: Encounter | null
): RankedArsenal {
  const { order, sourcedCount, note } = archetypeOrderFor(mode);

  const ruleOf = (id: string) => encounter?.specialRules.find((r) => r.id === id) ?? null;
  const swordRule = encounter
    ? (ruleOf('sword-unfriendly') ??
      (encounter.range === 'far'
        ? { id: 'far-range', text: 'Far-range damage check; point-blank weapons cannot reach it.' }
        : null))
    : null;
  const proxyRule = ruleOf('proxy');
  const setpieceRule = ruleOf('setpiece');
  const sniperDrRule = ruleOf('sniper-dr');
  const swordBonusRule = ruleOf('sword-bonus');

  const excluded: RankedArsenal['excluded'] = [];
  interface Weighted {
    row: RankedArsenalRow;
    demoted: boolean;
    promoted: boolean;
    archetypeIndex: number;
  }
  const entries: Weighted[] = [];

  for (const row of rows) {
    const kind = row.weapon.itemTypeDisplayName;
    if (swordRule && (kind === 'Sword' || kind === 'Glaive')) {
      excluded.push({ row, flag: { ruleId: swordRule.id, text: swordRule.text } });
      continue;
    }
    if (setpieceRule && isTrackingFrame(row.weapon.frame)) {
      excluded.push({ row, flag: { ruleId: setpieceRule.id, text: setpieceRule.text } });
      continue;
    }
    const flags: ArsenalFlag[] = [];
    let demoted = false;
    if (proxyRule && (kind === 'Sniper Rifle' || kind === 'Linear Fusion Rifle')) {
      flags.push({ ruleId: proxyRule.id, text: 'Crit-dependent: demoted on this proxy target.' });
      demoted = true;
    }
    if (sniperDrRule && kind === 'Sniper Rifle') {
      flags.push({ ruleId: sniperDrRule.id, text: 'Sniper: 45 percent resistance here; demoted.' });
      demoted = true;
    }
    if (sniperDrRule && row.weapon.name === 'Sleeper Simulant') {
      flags.push({
        ruleId: sniperDrRule.id,
        text: 'Sleeper Simulant is named: 40 percent resistance here; demoted.'
      });
      demoted = true;
    }
    let promoted = false;
    if (swordBonusRule && kind === 'Sword') {
      flags.push({ ruleId: swordBonusRule.id, text: 'Sword: +35 percent here; promoted.' });
      promoted = true;
    }
    const baseIndex = order.indexOf(row.weapon.archetype);
    const archetypeIndex = baseIndex === -1 ? order.length : baseIndex;
    entries.push({
      row: { ...row, flags, archetypeSourced: archetypeIndex < sourcedCount && !demoted },
      demoted,
      promoted,
      archetypeIndex
    });
  }

  entries.sort((a, b) => {
    // Promoted first, demoted last, then archetype order, then curated tier,
    // then a real damage roll before none, then name.
    if (a.promoted !== b.promoted) return a.promoted ? -1 : 1;
    if (a.demoted !== b.demoted) return a.demoted ? 1 : -1;
    if (a.archetypeIndex !== b.archetypeIndex) return a.archetypeIndex - b.archetypeIndex;
    const ta = a.row.tierLabel ? 0 : 1;
    const tb = b.row.tierLabel ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const ra = a.row.rollPerks && a.row.rollPerks.length > 0 ? 0 : 1;
    const rb = b.row.rollPerks && b.row.rollPerks.length > 0 ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.row.weapon.name < b.row.weapon.name
      ? -1
      : a.row.weapon.name > b.row.weapon.name
        ? 1
        : 0;
  });

  return { rows: entries.map((e) => e.row), excluded, orderNote: note };
}

// ----------------------------------------------------------------- filters

export interface ArsenalFilters {
  slot: 'all' | 'kinetic' | 'energy' | 'power';
  archetype: string; // 'all' or an archetype key
  damageRollOnly: boolean;
  /** The search-language query. Empty means no query, never "match nothing". */
  query: string;
}

export const DEFAULT_ARSENAL_FILTERS: ArsenalFilters = {
  slot: 'all',
  archetype: 'all',
  damageRollOnly: false,
  query: ''
};

export function applyFilters(rows: RankedArsenalRow[], filters: ArsenalFilters): RankedArsenalRow[] {
  return rows.filter((row) => {
    if (filters.slot !== 'all' && row.weapon.slot !== filters.slot) return false;
    if (filters.archetype !== 'all' && row.weapon.archetype !== filters.archetype) return false;
    if (filters.damageRollOnly && !(row.rollPerks && row.rollPerks.length > 0)) return false;
    return true;
  });
}
