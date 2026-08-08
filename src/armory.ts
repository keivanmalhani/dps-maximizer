// The armory: every item this account holds, arranged the way a player
// thinks about it.
//
// This is the half of the site that is not an opinion. The recommendation
// engine says what you SHOULD wear; the armory says what you HAVE, where it
// is, and what is on it. They read the same GetProfile response, which is
// why signing in once powers both.
//
// THE MODEL, IN ONE PARAGRAPH
//
// Destiny hands you a flat list of item instances and a bucket hash on each
// one. A bucket is a slot: Kinetic Weapons, Helmet, and one special bucket
// called General which is the vault. An item is somewhere exactly once, and
// "equipped" is a separate list rather than a flag, so equipped state is
// joined in here rather than read off the item. Everything below is that
// join, done once, so the view layer never has to think about it.
//
// NOTHING HERE FETCHES AND NOTHING HERE WRITES. The armory is a pure
// function of the profile response and the baked table, which is what makes
// it testable without a network and what keeps writes confined to write.ts.

import type { ProfileResponse } from './ownership';

// ------------------------------------------------------------- baked table

/** One row of src/data/armory.json, in the order scripts/build-armory.mjs
 *  documents. tests/armory-data.test.ts asserts these indexes against the
 *  file's own meta.itemFields, so a bake that reorders is caught at test
 *  time rather than as a grid full of wrong icons. */
export const ITEM_FIELD_ORDER = [
  'name',
  'icon',
  'bucket',
  'tier',
  'type',
  'sub',
  'klass',
  'damage',
  'typeName',
  'ammo',
  'slot'
] as const;

export type BakedItemRow = [
  string, // name
  string, // icon
  number, // bucket
  number, // tier
  number, // itemType
  number, // itemSubType
  number, // classType
  number, // damage
  string, // typeName
  number, // ammo
  number  // equipment slot
];

export type BakedPlugRow = [string, string, string, string];

export interface ArmoryData {
  manifestVersion: string;
  generated: string;
  meta: { iconPrefix: string; itemFields: string[] };
  buckets: Record<string, [string, number, number, number]>;
  damage: Record<string, [string, string, number]>;
  stats: Record<string, string>;
  tiers: Record<string, string>;
  items: Record<string, BakedItemRow>;
}

export interface PlugData {
  manifestVersion: string;
  plugs: Record<string, BakedPlugRow>;
}

// ------------------------------------------------------------------ slots

/**
 * The equipment buckets, in the order a player reads their character sheet.
 * Hardcoded on purpose: the manifest's own bucketOrder interleaves ghosts,
 * sparrows and emblems into the middle of the armour, which is correct for
 * the game's own inventory screen and wrong for a damage tool. Every hash is
 * checked against the bake by tests/armory-data.test.ts, so a typo here is a
 * failing test and not a missing column.
 */
export const WEAPON_BUCKETS = [1498876634, 2465295065, 953998645] as const;
export const ARMOR_BUCKETS = [3448274439, 3551918588, 14239492, 20886954, 1585787867] as const;
export const EQUIP_BUCKETS = [...WEAPON_BUCKETS, ...ARMOR_BUCKETS] as const;

/** The vault. Destiny calls it General, which nobody says out loud. */
export const VAULT_BUCKET = 138197802;
/** The postmaster. Items here are why a transfer can fail, so it is shown. */
export const POSTMASTER_BUCKET = 215593132;

export const BUCKET_LABELS: Record<number, string> = {
  1498876634: 'Kinetic',
  2465295065: 'Energy',
  953998645: 'Power',
  3448274439: 'Helmet',
  3551918588: 'Gauntlets',
  14239492: 'Chest',
  20886954: 'Legs',
  1585787867: 'Class',
  138197802: 'Vault',
  215593132: 'Postmaster'
};

export const CLASS_NAMES: Record<number, string> = {
  0: 'Titan',
  1: 'Hunter',
  2: 'Warlock',
  3: 'Any'
};

/** tierType, not the tier definition hash. 6 is exotic, 5 legendary. */
export const TIER_EXOTIC = 6;
export const TIER_LEGENDARY = 5;

/**
 * Instance state is a bit field. Only two bits change what the grid draws,
 * and guessing at the rest is how a lock icon ends up on a masterwork.
 * Source: DestinyItemState.
 */
export const STATE_LOCKED = 1;
export const STATE_MASTERWORK = 4;
export const STATE_CRAFTED = 8;

// --------------------------------------------------------------- live item

export interface ArmoryItem {
  /** Null for stackable things like materials, which cannot be equipped. */
  instanceId: string | null;
  hash: number;
  quantity: number;
  /** The bucket it is in RIGHT NOW, which for a vaulted item is the vault. */
  bucket: number;
  /** The bucket it belongs to when equipped. Kinetic stays Kinetic in vault. */
  homeBucket: number;
  /** characterId that holds it, or null when it is in the vault. */
  owner: string | null;
  equipped: boolean;
  locked: boolean;
  masterworked: boolean;
  crafted: boolean;
  power: number | null;
  /** Plug hashes on the item, socket order preserved. Empty when unknown. */
  plugs: number[];
  /** Instance stats by stat hash, when the profile carried them. */
  stats: Record<number, number>;
  /** The baked definition, or null when the bake does not know this hash. */
  def: BakedItemRow | null;
}

export interface ArmoryCharacter {
  characterId: string;
  classType: number;
  className: string;
  light: number;
  emblemPath: string;
  /** Equipped item per equipment bucket. */
  equipped: Map<number, ArmoryItem>;
  /** Carried but not equipped, per equipment bucket. */
  carried: Map<number, ArmoryItem[]>;
  postmaster: ArmoryItem[];
}

export interface Armory {
  characters: ArmoryCharacter[];
  /** Vaulted items grouped by the bucket they would equip into. */
  vault: Map<number, ArmoryItem[]>;
  /** Every item, keyed by instance id, for lookups from the view layer. */
  byInstance: Map<string, ArmoryItem>;
  /** Instances the bake does not recognise, counted rather than dropped. */
  unknownCount: number;
}

// ------------------------------------------------------------------ loader

let armoryPromise: Promise<ArmoryData> | null = null;
let plugPromise: Promise<PlugData> | null = null;

/**
 * The item table, fetched once. Vite turns this import into its own chunk,
 * so the recommendation card is not paying for the grid's data.
 */
export function loadArmory(): Promise<ArmoryData> {
  if (!armoryPromise) {
    armoryPromise = import('./data/armory.json').then(
      (module) => (module.default ?? module) as unknown as ArmoryData
    );
  }
  return armoryPromise;
}

/**
 * The plug table is five hundred kilobytes of perk descriptions and the grid
 * never needs it. It loads the first time a detail panel opens, which is the
 * first moment a perk name is actually going to be read by a human.
 */
export function loadPlugs(): Promise<PlugData> {
  if (!plugPromise) {
    plugPromise = import('./data/armory-plugs.json').then(
      (module) => (module.default ?? module) as unknown as PlugData
    );
  }
  return plugPromise;
}

/** Test seam. Lets a test install a table without touching the network. */
export function __setArmoryForTests(data: ArmoryData | null, plugs: PlugData | null): void {
  armoryPromise = data ? Promise.resolve(data) : null;
  plugPromise = plugs ? Promise.resolve(plugs) : null;
}

// ------------------------------------------------------------------- build

/**
 * The shape of one item as GetProfile sends it. Everything is optional
 * because it is somebody else's JSON: a missing field is a fact to render,
 * not a crash.
 */
export interface RawItem {
  itemHash?: number;
  itemInstanceId?: string;
  quantity?: number;
  bucketHash?: number;
  location?: number;
  transferStatus?: number;
  lockable?: boolean;
  state?: number;
}

export interface ProfileWithInventory extends ProfileResponse {
  profileInventory?: { data?: { items?: RawItem[] } };
  characterInventories?: { data?: Record<string, { items?: RawItem[] }> };
  characterEquipment?: { data?: Record<string, { items?: RawItem[] }> };
  characters?: {
    data?: Record<
      string,
      { characterId?: string; classType?: number; light?: number; emblemBackgroundPath?: string }
    >;
  };
  itemComponents?: {
    sockets?: { data?: Record<string, { sockets?: Array<{ plugHash?: number; isEnabled?: boolean }> }> };
    instances?: { data?: Record<string, { primaryStat?: { value?: number } }> };
    stats?: { data?: Record<string, { stats?: Record<string, { value?: number }> }> };
  };
}

function toItem(
  raw: RawItem,
  owner: string | null,
  equipped: boolean,
  data: ArmoryData,
  profile: ProfileWithInventory
): ArmoryItem {
  const hash = raw.itemHash ?? 0;
  const def = data.items[String(hash)] ?? null;
  const instanceId = raw.itemInstanceId ?? null;
  const state = raw.state ?? 0;

  const components = profile.itemComponents ?? {};
  const plugs = instanceId
    ? (components.sockets?.data?.[instanceId]?.sockets ?? [])
        .map((socket) => socket.plugHash ?? 0)
        .filter((plugHash) => plugHash !== 0)
    : [];

  const stats: Record<number, number> = {};
  if (instanceId) {
    const raws = components.stats?.data?.[instanceId]?.stats ?? {};
    for (const [statHash, value] of Object.entries(raws)) {
      if (typeof value?.value === 'number') stats[Number(statHash)] = value.value;
    }
  }

  return {
    instanceId,
    hash,
    quantity: raw.quantity ?? 1,
    // Falling back to the definition's own bucket is not defensive padding.
    // The demo account is built without bucket hashes on purpose, because a
    // fixture that hardcodes which slot a rocket goes in is a fixture that
    // agrees with whoever wrote it rather than with the manifest, which is
    // exactly the failure mistakes rule 56 is about.
    bucket: raw.bucketHash ?? (def ? def[2] : 0),
    // An item in the vault reports the vault as its bucket, so its real slot
    // has to come from the definition. This is the single join that makes a
    // vault column sortable by slot at all.
    homeBucket: def ? def[2] : (raw.bucketHash ?? 0),
    owner,
    equipped,
    locked: (state & STATE_LOCKED) !== 0,
    masterworked: (state & STATE_MASTERWORK) !== 0,
    crafted: (state & STATE_CRAFTED) !== 0,
    power: instanceId
      ? (components.instances?.data?.[instanceId]?.primaryStat?.value ?? null)
      : null,
    plugs,
    stats,
    def
  };
}

function push(map: Map<number, ArmoryItem[]>, bucket: number, item: ArmoryItem): void {
  const list = map.get(bucket);
  if (list) list.push(item);
  else map.set(bucket, [item]);
}

/**
 * Power descending, then name, so the grid is stable across reloads and the
 * thing you most likely want is first. A stable sort matters more than a
 * clever one here: an inventory that reshuffles between renders is one a
 * player cannot build muscle memory against.
 */
export function sortItems(items: ArmoryItem[]): ArmoryItem[] {
  return items.slice().sort((a, b) => {
    if ((b.power ?? 0) !== (a.power ?? 0)) return (b.power ?? 0) - (a.power ?? 0);
    const an = a.def ? a.def[0] : '';
    const bn = b.def ? b.def[0] : '';
    return an.localeCompare(bn);
  });
}

/** The whole join, done once. Pure: same inputs, same armory, no fetching. */
export function buildArmory(profile: ProfileWithInventory, data: ArmoryData): Armory {
  const byInstance = new Map<string, ArmoryItem>();
  const vault = new Map<number, ArmoryItem[]>();
  let unknownCount = 0;

  const record = (item: ArmoryItem): void => {
    if (!item.def) unknownCount++;
    if (item.instanceId) byInstance.set(item.instanceId, item);
  };

  const characters: ArmoryCharacter[] = [];
  const rawCharacters = profile.characters?.data ?? {};
  for (const [characterId, raw] of Object.entries(rawCharacters)) {
    const classType = raw.classType ?? 0;
    const character: ArmoryCharacter = {
      characterId,
      classType,
      className: CLASS_NAMES[classType] ?? 'Guardian',
      light: raw.light ?? 0,
      emblemPath: raw.emblemBackgroundPath ?? '',
      equipped: new Map(),
      carried: new Map(),
      postmaster: []
    };

    for (const raw2 of profile.characterEquipment?.data?.[characterId]?.items ?? []) {
      const item = toItem(raw2, characterId, true, data, profile);
      record(item);
      character.equipped.set(item.bucket, item);
    }
    for (const raw2 of profile.characterInventories?.data?.[characterId]?.items ?? []) {
      const item = toItem(raw2, characterId, false, data, profile);
      record(item);
      if (item.bucket === POSTMASTER_BUCKET) character.postmaster.push(item);
      else push(character.carried, item.bucket, item);
    }
    for (const [bucket, list] of character.carried) character.carried.set(bucket, sortItems(list));
    characters.push(character);
  }

  // Characters come back keyed by id in no guaranteed order. Titan, Hunter,
  // Warlock is the order the game itself uses on the character select.
  characters.sort((a, b) => a.classType - b.classType);

  for (const raw of profile.profileInventory?.data?.items ?? []) {
    const item = toItem(raw, null, false, data, profile);
    record(item);
    // Only equippable gear is worth a column. Materials and consumables also
    // live in General and would otherwise flood the vault view.
    if (EQUIP_BUCKETS.includes(item.homeBucket as (typeof EQUIP_BUCKETS)[number])) {
      push(vault, item.homeBucket, item);
    }
  }
  for (const [bucket, list] of vault) vault.set(bucket, sortItems(list));

  return { characters, vault, byInstance, unknownCount };
}

// ----------------------------------------------------------------- helpers

export function iconUrl(data: ArmoryData, icon: string): string {
  if (!icon) return '';
  if (icon.startsWith('/')) return 'https://www.bungie.net' + icon;
  return 'https://www.bungie.net' + data.meta.iconPrefix + icon;
}

export function itemName(item: ArmoryItem): string {
  return item.def ? item.def[0] : 'Unknown item ' + item.hash;
}

export function isExotic(item: ArmoryItem): boolean {
  return !!item.def && item.def[3] === TIER_EXOTIC;
}

export function damageName(data: ArmoryData, item: ArmoryItem): string {
  if (!item.def) return '';
  for (const row of Object.values(data.damage)) {
    if (row[2] === item.def[7]) return row[0];
  }
  return '';
}

/**
 * Which characters could equip this item. Class armour is class locked and
 * weapons are not, and a grid that offers to equip a Hunter cloak on a Titan
 * is a grid that produces a Bungie error the player has to interpret.
 */
export function equippableBy(item: ArmoryItem, characters: ArmoryCharacter[]): ArmoryCharacter[] {
  if (!item.def) return [];
  const klass = item.def[6];
  if (klass === 3) return characters;
  return characters.filter((character) => character.classType === klass);
}

// ------------------------------------------------------------------ search

/**
 * A small filter over the grid. Deliberately smaller than src/query.ts.
 *
 * query.ts is a real parser with and, or, not and comparisons, and it runs
 * over the curated arsenal rows, where the interesting questions are about
 * tiers and damage rolls. The grid's question is almost always "where is my
 * Sunshot", so this is free text plus a handful of is: flags. Two search
 * languages is a smell, and the honest reason there are two is that they
 * filter different things: this one has to answer for armour and vault
 * location, neither of which the arsenal rows model at all.
 */
export const ARMORY_FLAGS = [
  'exotic',
  'legendary',
  'masterwork',
  'crafted',
  'locked',
  'equipped',
  'vault',
  'weapon',
  'armor'
] as const;

export type ArmoryFlag = (typeof ARMORY_FLAGS)[number];

export interface ArmoryQuery {
  text: string[];
  flags: ArmoryFlag[];
  /** Flags after is: that this filter does not know. Shown, not ignored. */
  unknown: string[];
}

export function parseArmoryQuery(raw: string): ArmoryQuery {
  const text: string[] = [];
  const flags: ArmoryFlag[] = [];
  const unknown: string[] = [];
  for (const token of raw.toLowerCase().split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith('is:')) {
      const flag = token.slice(3);
      if ((ARMORY_FLAGS as readonly string[]).includes(flag)) {
        if (!flags.includes(flag as ArmoryFlag)) flags.push(flag as ArmoryFlag);
      } else if (flag && !unknown.includes(flag)) {
        unknown.push(flag);
      }
      continue;
    }
    text.push(token);
  }
  return { text, flags, unknown };
}

export function matchesArmoryQuery(item: ArmoryItem, query: ArmoryQuery): boolean {
  if (query.text.length === 0 && query.flags.length === 0) return true;
  const name = (item.def ? item.def[0] : '').toLowerCase();
  const typeName = (item.def ? item.def[8] : '').toLowerCase();
  for (const word of query.text) {
    if (!name.includes(word) && !typeName.includes(word)) return false;
  }
  for (const flag of query.flags) {
    switch (flag) {
      case 'exotic':
        if (!item.def || item.def[3] !== TIER_EXOTIC) return false;
        break;
      case 'legendary':
        if (!item.def || item.def[3] !== TIER_LEGENDARY) return false;
        break;
      case 'masterwork':
        if (!item.masterworked) return false;
        break;
      case 'crafted':
        if (!item.crafted) return false;
        break;
      case 'locked':
        if (!item.locked) return false;
        break;
      case 'equipped':
        if (!item.equipped) return false;
        break;
      case 'vault':
        if (item.owner !== null) return false;
        break;
      case 'weapon':
        if (!item.def || item.def[4] !== 3) return false;
        break;
      case 'armor':
        if (!item.def || item.def[4] !== 2) return false;
        break;
    }
  }
  return true;
}

/** How many items the whole armoury holds, for the honest count on the bar. */
export function countItems(armory: Armory): number {
  return armory.byInstance.size;
}
