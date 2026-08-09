// Turning a GetProfile response into what the engine needs to know, purely.
//
// Ownership has two honest levels and the difference matters:
//
// - An item in the vault, a character inventory or equipped is buildable now.
// - An item that is only lit up in Collections can be pulled back out if it
//   is an exotic, and cannot if it is a random-roll legendary. The page says
//   which, instead of pretending Collections is a vault.
//
// Nothing in this file fetches. It takes the JSON bungie.net returned and the
// baked hash maps, and the tests feed it fixtures.

import {
  BAKED_ITEMS,
  CATALYST_HASHES,
  CIPHER_HASH,
  EMPTY_CATALYST_HASHES,
  ITEM_ID_BY_COLLECTIBLE,
  ITEM_ID_BY_HASH,
  PERK_HASHES,
  STAT_HASHES
} from './data/items';
import { CURATED_BY_ID } from './data/tiers';
import type {
  CatalystState,
  CharacterInfo,
  GuardianClass,
  OwnershipEntry,
  PlayerData,
  RollState,
  StatName
} from './types';

// The slices of the GetProfile response this site reads. Everything is
// optional because it is somebody else's JSON and a missing field is not a
// crash, it is a fact to report.

export interface ApiItem {
  itemHash?: number;
  itemInstanceId?: string;
  quantity?: number;
}

export interface ApiCharacter {
  characterId?: string;
  classType?: number;
  light?: number;
  stats?: Record<string, number>;
}

export interface ProfileResponse {
  profileInventory?: { data?: { items?: ApiItem[] } };
  characterInventories?: { data?: Record<string, { items?: ApiItem[] }> };
  characterEquipment?: { data?: Record<string, { items?: ApiItem[] }> };
  profileCollectibles?: { data?: { collectibles?: Record<string, { state?: number }> } };
  characterCollectibles?: {
    data?: Record<string, { collectibles?: Record<string, { state?: number }> }>;
  };
  characters?: { data?: Record<string, ApiCharacter> };
  itemComponents?: {
    sockets?: {
      data?: Record<string, { sockets?: Array<{ plugHash?: number; isEnabled?: boolean }> }>;
    };
    /** Component 300. Power lives here, and only the armoury reads it. */
    instances?: { data?: Record<string, { primaryStat?: { value?: number } }> };
    /** Component 304. Per item stat rolls, likewise armoury only. */
    stats?: { data?: Record<string, { stats?: Record<string, { value?: number }> }> };
  };
}

/** Collectible state bit 1 set means NotAcquired; bit clear means unlocked. */
export function collectibleAcquired(state: number | undefined): boolean {
  if (typeof state !== 'number') return false;
  return (state & 1) === 0;
}

/** Walk every item the profile carries, vault and characters alike. */
export function eachItem(response: ProfileResponse, fn: (item: ApiItem) => void): void {
  for (const item of response.profileInventory?.data?.items ?? []) fn(item);
  const perCharacter = response.characterInventories?.data ?? {};
  for (const bucket of Object.values(perCharacter)) for (const item of bucket.items ?? []) fn(item);
  const equipped = response.characterEquipment?.data ?? {};
  for (const bucket of Object.values(equipped)) for (const item of bucket.items ?? []) fn(item);
}

/**
 * The whole response, reduced to the model the engine runs on. Pure.
 */
export function parseProfile(response: ProfileResponse): PlayerData {
  const owned: Record<string, OwnershipEntry> = {};
  for (const id of Object.keys(BAKED_ITEMS)) {
    owned[id] = { state: 'none', instanceIds: [], quantity: 0, power: null };
  }

  let ciphers: number | null = response.profileInventory?.data?.items ? 0 : null;

  eachItem(response, (item) => {
    const hash = item.itemHash ?? 0;
    if (hash === CIPHER_HASH) {
      ciphers = (ciphers ?? 0) + (item.quantity ?? 1);
      return;
    }
    const id = ITEM_ID_BY_HASH.get(hash);
    if (!id) return;
    const entry = owned[id];
    entry.state = 'instances';
    entry.quantity += item.quantity ?? 1;
    if (item.itemInstanceId) {
      entry.instanceIds.push(item.itemInstanceId);
      // Component 300, the same field armory.ts reads. The recommendation
      // engine gets an honest Power number instead of only a tier label.
      const power = response.itemComponents?.instances?.data?.[item.itemInstanceId]?.primaryStat?.value;
      if (typeof power === 'number') {
        entry.power = entry.power === null ? power : Math.max(entry.power, power);
      }
    }
  });

  // Collections only upgrades 'none' to 'collections'; it never downgrades a
  // real copy.
  const collectibleStates: Array<Record<string, { state?: number }>> = [];
  const profileLevel = response.profileCollectibles?.data?.collectibles;
  if (profileLevel) collectibleStates.push(profileLevel);
  for (const perChar of Object.values(response.characterCollectibles?.data ?? {})) {
    if (perChar.collectibles) collectibleStates.push(perChar.collectibles);
  }
  for (const table of collectibleStates) {
    for (const [hashText, value] of Object.entries(table)) {
      const id = ITEM_ID_BY_COLLECTIBLE.get(Number(hashText));
      if (!id) continue;
      if (owned[id].state === 'none' && collectibleAcquired(value.state)) {
        owned[id].state = 'collections';
      }
    }
  }

  const socketsData = response.itemComponents?.sockets?.data;
  const socketsByInstance: Record<string, number[]> = {};
  if (socketsData) {
    for (const [instanceId, value] of Object.entries(socketsData)) {
      socketsByInstance[instanceId] = (value.sockets ?? [])
        .map((s) => s.plugHash ?? 0)
        .filter((h) => h !== 0);
    }
  }

  const characters: CharacterInfo[] = Object.values(response.characters?.data ?? {})
    .filter((c): c is ApiCharacter & { characterId: string } => typeof c.characterId === 'string')
    .map((c) => ({
      characterId: c.characterId,
      classType: (c.classType === 0 || c.classType === 1 || c.classType === 2
        ? c.classType
        : 0) as GuardianClass,
      light: c.light ?? 0,
      stats: readStats(c.stats)
    }));

  return {
    owned,
    socketsByInstance,
    socketsAvailable: !!socketsData,
    characters,
    ciphers
  };
}

/** Character stats by Armor 3.0 name, via the baked profile-keyed hashes. */
export function readStats(
  raw: Record<string, number> | undefined
): Partial<Record<StatName, number>> {
  const out: Partial<Record<StatName, number>> = {};
  if (!raw) return out;
  for (const [name, hash] of Object.entries(STAT_HASHES) as Array<[StatName, number]>) {
    const value = raw[String(hash)];
    if (typeof value === 'number') out[name] = value;
  }
  return out;
}

/**
 * Does any owned instance of this item carry the wanted roll? A roll is a set
 * of perk-name columns; an instance matches when every column matches at
 * least one of its plugs, base or enhanced.
 */
export function rollState(id: string, player: PlayerData): RollState {
  const curated = CURATED_BY_ID.get(id);
  const wanted = curated?.wantedRoll;
  if (!wanted) return 'not-checked';
  const entry = player.owned[id];
  if (!entry || entry.state !== 'instances') return 'not-checked';
  if (!player.socketsAvailable) return 'unknown';

  const columns = wanted.columns.map((column) =>
    column.flatMap((perkName) => PERK_HASHES[perkName] ?? [])
  );
  let sawSockets = false;
  for (const instanceId of entry.instanceIds) {
    const plugs = player.socketsByInstance[instanceId];
    if (!plugs) continue;
    sawSockets = true;
    const hasAll = columns.every((column) => column.some((hash) => plugs.includes(hash)));
    if (hasAll) return 'has-roll';
  }
  return sawSockets ? 'missing-roll' : 'unknown';
}

/**
 * Catalyst state for the exotics where it matters, read from instance
 * sockets. Collections-only copies and missing socket data are 'unknown',
 * said plainly, never guessed.
 */
export function catalystState(id: string, player: PlayerData): CatalystState {
  const catalyst = CATALYST_HASHES[id];
  if (!catalyst) return 'unknown';
  const entry = player.owned[id];
  if (!entry || entry.state !== 'instances') return 'unknown';
  if (!player.socketsAvailable) return 'unknown';

  let sawEmpty = false;
  let sawSockets = false;
  for (const instanceId of entry.instanceIds) {
    const plugs = player.socketsByInstance[instanceId];
    if (!plugs) continue;
    sawSockets = true;
    if (catalyst.hashes.some((hash) => plugs.includes(hash))) return 'slotted';
    if (EMPTY_CATALYST_HASHES.some((hash) => plugs.includes(hash))) sawEmpty = true;
  }
  if (!sawSockets) return 'unknown';
  return sawEmpty ? 'not-slotted' : 'unknown';
}
