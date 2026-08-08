// Loadouts: save a set of gear, then put it back on in one action.
//
// WHY THIS IS NOT JUST A LIST OF ITEM IDS
//
// Destiny has no "move this from my Titan to my Hunter" call. There is only
// "move to vault" and "move from vault", so a cross character swap is two
// hops. On top of that, an item that is currently EQUIPPED cannot be moved
// at all: the game requires something else to go into the slot first. DIM
// hides both of these, and the hiding is most of what makes DIM feel like
// magic.
//
// So applying a loadout is a PLAN, not a loop. This module builds that plan
// as data, in the order the API will accept it, and hands it to the caller.
// Nothing here talks to the network. The plan is a value you can print, test
// and show to a person before a single item moves, which is exactly what
// rule 2 in write.ts is asking for: the sentence the human agrees to is
// generated from the same structure that then executes.
//
// The one thing this module refuses to do quietly is guess. If a step is
// impossible, the plan carries a blocker with the reason and a suggested
// way out, and the caller shows it rather than firing a request that will
// come back as a Bungie enum nobody can read.

import {
  EQUIP_BUCKETS,
  BUCKET_LABELS,
  sortItems,
  type Armory,
  type ArmoryCharacter,
  type ArmoryItem
} from './armory';

export const STORAGE_KEY = 'dps.loadouts.v1';
export const LOADOUT_FORMAT = 1;

export interface LoadoutItem {
  instanceId: string;
  hash: number;
  /** The slot it goes in, so a loadout still reads correctly if the item is gone. */
  bucket: number;
  /** Kept for display when the item no longer exists in the account. */
  name: string;
}

export interface Loadout {
  id: string;
  name: string;
  /** 0 Titan, 1 Hunter, 2 Warlock, 3 any. Class armour makes this matter. */
  classType: number;
  items: LoadoutItem[];
  /** ISO date. Stamped by the caller, so this module stays pure. */
  saved: string;
}

// ------------------------------------------------------------------ storage

interface StoredFile {
  format: number;
  loadouts: Loadout[];
}

function isLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Loadout>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.classType === 'number' &&
    Array.isArray(candidate.items)
  );
}

/**
 * Read the saved loadouts. A corrupt or foreign value returns an empty list
 * rather than throwing: this runs on page load, and a bad localStorage entry
 * from some other tool should not be able to take the whole site down.
 */
export function loadSaved(store: Storage | null): Loadout[] {
  if (!store) return [];
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredFile;
    if (!parsed || !Array.isArray(parsed.loadouts)) return [];
    return parsed.loadouts.filter(isLoadout);
  } catch {
    return [];
  }
}

export function saveAll(store: Storage | null, loadouts: Loadout[]): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ format: LOADOUT_FORMAT, loadouts }));
    return true;
  } catch {
    // Quota, or private browsing. The caller says so rather than pretending.
    return false;
  }
}

/** A loadout file a player can keep, or hand to somebody else. */
export function exportJson(loadouts: Loadout[]): string {
  return JSON.stringify({ format: LOADOUT_FORMAT, loadouts }, null, 2);
}

export function importJson(text: string): { loadouts: Loadout[]; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { loadouts: [], error: 'That is not valid JSON.' };
  }
  const file = parsed as Partial<StoredFile>;
  if (!file || !Array.isArray(file.loadouts)) {
    return { loadouts: [], error: 'That JSON has no loadouts array in it.' };
  }
  const good = file.loadouts.filter(isLoadout);
  if (good.length === 0) {
    return { loadouts: [], error: 'None of the entries in that file look like a loadout.' };
  }
  return { loadouts: good, error: null };
}

// ---------------------------------------------------------------- snapshot

/**
 * Everything a character is wearing right now, as a loadout. This is the
 * cheapest useful feature in the whole armory: "save what I have on" is how
 * a player makes a safety net before experimenting.
 */
export function snapshot(
  character: ArmoryCharacter,
  name: string,
  id: string,
  saved: string
): Loadout {
  const items: LoadoutItem[] = [];
  for (const bucket of EQUIP_BUCKETS) {
    const item = character.equipped.get(bucket);
    if (!item || !item.instanceId) continue;
    items.push({
      instanceId: item.instanceId,
      hash: item.hash,
      bucket,
      name: item.def ? item.def[0] : 'Unknown item'
    });
  }
  return { id, name, classType: character.classType, items, saved };
}

// -------------------------------------------------------------------- plan

export type StepKind = 'to-vault' | 'to-character' | 'equip';

export interface PlanStep {
  kind: StepKind;
  itemId: string;
  itemHash: number;
  itemName: string;
  bucket: number;
  /** The character the call is addressed to. Vault moves name the SOURCE. */
  characterId: string;
  /** One sentence, in the words the confirm dialog will show. */
  why: string;
}

export interface PlanBlocker {
  itemName: string;
  bucket: number;
  reason: string;
  /** What the player can do about it, or null when there is nothing. */
  fix: string | null;
}

export interface ApplyPlan {
  targetCharacterId: string;
  steps: PlanStep[];
  blockers: PlanBlocker[];
  /** Items already equipped on the target, so nothing needs to happen. */
  alreadyOn: string[];
  /** The sentence a human confirms. Generated, never hand written. */
  summary: string;
}

function slotName(bucket: number): string {
  return BUCKET_LABELS[bucket] ?? 'slot ' + bucket;
}

/**
 * The item this character should put on so a currently equipped piece can be
 * moved. Highest power in the same slot that is not the item leaving, which
 * is what a player would pick and is at worst harmless.
 */
export function replacementFor(
  character: ArmoryCharacter,
  bucket: number,
  leavingInstanceId: string
): ArmoryItem | null {
  const candidates = sortItems(character.carried.get(bucket) ?? []).filter(
    (item) => item.instanceId && item.instanceId !== leavingInstanceId
  );
  return candidates[0] ?? null;
}

/**
 * Build the ordered plan. Pure, and the order is the order the API accepts:
 * everything leaves first, then everything arrives, then one bulk equip.
 *
 * Doing all the vault moves before any of the arrivals is not cosmetic. A
 * character has ten slots per bucket, and moving in before moving out is how
 * a plan hits DestinyNoRoomInDestination halfway through and leaves the
 * account in a state neither the player nor this page asked for.
 */
export function planApply(loadout: Loadout, armory: Armory, targetCharacterId: string): ApplyPlan {
  const target = armory.characters.find((c) => c.characterId === targetCharacterId);
  const steps: PlanStep[] = [];
  const blockers: PlanBlocker[] = [];
  const alreadyOn: string[] = [];

  if (!target) {
    return {
      targetCharacterId,
      steps: [],
      blockers: [
        {
          itemName: 'the whole loadout',
          bucket: 0,
          reason: 'That character is not on this account any more.',
          fix: 'Pick a different character.'
        }
      ],
      alreadyOn: [],
      summary: 'Nothing can be applied: the character this was aimed at is gone.'
    };
  }

  const leaving: PlanStep[] = [];
  const arriving: PlanStep[] = [];
  const equipping: PlanStep[] = [];

  for (const wanted of loadout.items) {
    const live = armory.byInstance.get(wanted.instanceId);
    if (!live) {
      blockers.push({
        itemName: wanted.name,
        bucket: wanted.bucket,
        reason: 'That exact copy is not in the account any more. It was dismantled, or it is in the postmaster.',
        fix: 'Take it out of the loadout, or save the loadout again with the copy you have now.'
      });
      continue;
    }

    // Class armour on the wrong class is a refusal Destiny will make anyway,
    // and saying so here is the difference between a sentence and an enum.
    if (live.def && live.def[6] !== 3 && live.def[6] !== target.classType) {
      blockers.push({
        itemName: wanted.name,
        bucket: wanted.bucket,
        reason: 'That is class locked and this character is a different class.',
        fix: 'Apply this loadout to the character it was saved from.'
      });
      continue;
    }

    if (live.owner === targetCharacterId && live.equipped) {
      alreadyOn.push(wanted.name);
      continue;
    }

    // Equipped somewhere else. This is the case that cannot simply be moved.
    if (live.equipped && live.owner && live.owner !== targetCharacterId) {
      const source = armory.characters.find((c) => c.characterId === live.owner);
      const swap = source ? replacementFor(source, live.bucket, wanted.instanceId) : null;
      blockers.push({
        itemName: wanted.name,
        bucket: wanted.bucket,
        reason:
          'It is equipped on your ' +
          (source ? source.className : 'other character') +
          ', and Destiny will not move something a character is wearing.',
        fix: swap
          ? 'Equip ' + (swap.def ? swap.def[0] : 'another item') + ' on that character first, then apply again.'
          : 'That character has nothing else in the ' + slotName(live.bucket) + ' slot to swap to.'
      });
      continue;
    }

    if (live.owner && live.owner !== targetCharacterId) {
      leaving.push({
        kind: 'to-vault',
        itemId: wanted.instanceId,
        itemHash: live.hash,
        itemName: wanted.name,
        bucket: live.bucket,
        characterId: live.owner,
        why: 'Move ' + wanted.name + ' off your other character into the vault.'
      });
      arriving.push({
        kind: 'to-character',
        itemId: wanted.instanceId,
        itemHash: live.hash,
        itemName: wanted.name,
        bucket: live.bucket,
        characterId: targetCharacterId,
        why: 'Pull ' + wanted.name + ' out of the vault onto your ' + target.className + '.'
      });
    } else if (live.owner === null) {
      arriving.push({
        kind: 'to-character',
        itemId: wanted.instanceId,
        itemHash: live.hash,
        itemName: wanted.name,
        bucket: live.bucket,
        characterId: targetCharacterId,
        why: 'Pull ' + wanted.name + ' out of the vault onto your ' + target.className + '.'
      });
    }

    equipping.push({
      kind: 'equip',
      itemId: wanted.instanceId,
      itemHash: live.hash,
      itemName: wanted.name,
      bucket: wanted.bucket,
      characterId: targetCharacterId,
      why: 'Equip ' + wanted.name + ' in the ' + slotName(wanted.bucket) + ' slot.'
    });
  }

  steps.push(...leaving, ...arriving, ...equipping);

  const moves = leaving.length + arriving.length;
  const parts: string[] = [];
  if (moves > 0) parts.push(moves + (moves === 1 ? ' item move' : ' item moves'));
  if (equipping.length > 0) {
    parts.push(equipping.length + (equipping.length === 1 ? ' item equipped' : ' items equipped'));
  }
  let summary: string;
  if (parts.length === 0) {
    summary =
      blockers.length > 0
        ? 'Nothing can be done automatically: every item in this loadout is blocked.'
        : 'Your ' + target.className + ' is already wearing this loadout.';
  } else {
    summary =
      'Apply ' + loadout.name + ' to your ' + target.className + ': ' + parts.join(' and ') + '.';
    if (blockers.length > 0) {
      summary +=
        ' ' +
        blockers.length +
        (blockers.length === 1 ? ' item is blocked and will be skipped.' : ' items are blocked and will be skipped.');
    }
  }

  return { targetCharacterId, steps, blockers, alreadyOn, summary };
}

/** The instance ids the bulk equip call should be given, in plan order. */
export function equipIds(plan: ApplyPlan): string[] {
  return plan.steps.filter((step) => step.kind === 'equip').map((step) => step.itemId);
}
