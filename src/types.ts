// The domain vocabulary, shared by the dataset, the engine and the page.
//
// Everything here is deliberately small and JSON-shaped, because the engine is
// a pure function from these types to a verdict and the tests feed it fixtures.

/** The three classes, by Bungie's classType number. */
export type GuardianClass = 0 | 1 | 2;

export const CLASS_NAMES: Record<GuardianClass, string> = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock'
};

/**
 * What the visitor is trying to do. PvP is deliberately absent as a mode with
 * recommendations: the sourced sheet ranks boss damage, and pretending it
 * covers the Crucible would be exactly the kind of lie this site exists to
 * avoid. The picker still offers it, and picking it gets an honest paragraph.
 */
export type Activity = 'boss-burst' | 'boss-sustained' | 'add-clear' | 'master-champions' | 'pvp';

export const ACTIVITY_LABELS: Record<Activity, string> = {
  'boss-burst': 'Raid boss burst',
  'boss-sustained': 'Sustained boss damage',
  'add-clear': 'Add clear',
  'master-champions': 'Master and champions',
  pvp: 'PvP'
};

/** Which of the four curated tiers an entry sits in. Lower is better. */
export type Tier = 1 | 2 | 3 | 4;

/** Weapon slots as the game names them. */
export type WeaponSlot = 'kinetic' | 'energy' | 'power';

/** Armor buckets, for exotic armor entries. */
export type ArmorSlot = 'helmet' | 'gauntlets' | 'chest' | 'legs' | 'classitem';

/**
 * How the visitor owns a curated item, in descending order of usefulness.
 *
 * - 'instances': at least one real copy in the vault, a character inventory or
 *   equipped. Buildable right now.
 * - 'collections': unlocked in Collections only. For exotics that means one
 *   click at the Collections kiosk; for legendaries it does not, because
 *   random-roll legendaries cannot be pulled back out, and the page says so
 *   instead of pretending otherwise.
 * - 'none': not owned in any sense this site can see.
 */
export type Owned = 'instances' | 'collections' | 'none';

/** What the sockets said about a wanted roll, when there was one to want. */
export type RollState = 'has-roll' | 'missing-roll' | 'unknown' | 'not-checked';

/** What the sockets said about an exotic catalyst that matters to its tier. */
export type CatalystState = 'slotted' | 'not-slotted' | 'unknown';

/**
 * One item's ownership, as read from the profile. quantity counts stacked
 * consumables; instanceIds index into the socket map for roll checks.
 */
export interface OwnershipEntry {
  state: Owned;
  instanceIds: string[];
  quantity: number;
  /** Highest Power seen across owned instances, null with nothing to read it from. */
  power: number | null;
}

/** One character, as much of it as the site needs. */
export interface CharacterInfo {
  characterId: string;
  classType: GuardianClass;
  light: number;
  /** Armor 3.0 stats by name, each 0..200. Missing stats read as 0. */
  stats: Partial<Record<StatName, number>>;
}

export type StatName = 'Weapons' | 'Health' | 'Class' | 'Grenade' | 'Super' | 'Melee';

/**
 * Everything the engine needs to know about one account, whichever way it
 * arrived: parsed from a live GetProfile response, or built by the demo
 * fixture. The engine cannot tell the difference, which is the point.
 */
export interface PlayerData {
  /** Keyed by curated item id, not by hash. */
  owned: Record<string, OwnershipEntry>;
  /** Plug hashes per instance id, for roll and catalyst checks. */
  socketsByInstance: Record<string, number[]>;
  /** True when the profile response actually included socket data. */
  socketsAvailable: boolean;
  characters: CharacterInfo[];
  /** Exotic Ciphers held, or null when the inventory could not be read. */
  ciphers: number | null;
}
