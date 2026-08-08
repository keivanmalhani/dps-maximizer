// The only file in this repository that changes anything in your account.
//
// WHY IT IS ONE FILE
//
// Reading a vault wrong shows a wrong number. Writing to a vault wrong moves
// a stranger's gear, and Destiny transfers can drop an item into a postmaster
// that is already full, where it is deleted after a while. That is a real
// consequence, so the blast radius is contained by construction rather than
// by care: every call that mutates lives here, and nothing here can be called
// by accident.
//
// THE THREE RULES, restated from _hq/bungie-app.md because they are the whole
// point of this module:
//
//   1. Every write lives in one module.        This one.
//   2. Every write is behind an explicit confirm.
//   3. No write ever fires as a side effect of rendering.
//
// Rule 2 is enforced by the type system rather than by a comment. Every
// function below demands a Confirmation, and the only way to obtain one is
// confirmWrite(), which takes the sentence that was shown to the human. A
// render pass cannot produce one by accident, and a test that forgets to
// confirm does not compile. That turns "we were careful" into "it cannot be
// expressed", which is the only version of this that survives a refactor.

import { API_KEY, API_ROOT, getSession } from './auth';

// ------------------------------------------------------------- the consent

const CONFIRMED = Symbol('confirmed');

/**
 * Proof that a human was shown a sentence describing a change and agreed to
 * it. Not constructible from outside this module, so no code path can invent
 * one and no render can synthesise one.
 */
export interface Confirmation {
  readonly [CONFIRMED]: true;
  /** The exact sentence the human agreed to. Logged with every result. */
  readonly intent: string;
}

/**
 * Mint a confirmation. Call this ONLY from a handler that ran because a
 * person clicked, and pass the same words they read. An empty intent is
 * rejected: a confirm with nothing written on it is not a confirm.
 */
export function confirmWrite(intent: string): Confirmation {
  const text = intent.trim();
  if (!text) {
    throw new Error('A write needs the sentence the player agreed to, and this one is empty.');
  }
  return { [CONFIRMED]: true, intent: text } as Confirmation;
}

// ------------------------------------------------------------- the transport

export interface Account {
  membershipType: number;
  membershipId: string;
}

export interface WriteResult {
  ok: boolean;
  /** Bungie's platform error code. 1 is success. */
  code: number;
  /** Something a player can act on, never a raw enum name. */
  message: string;
  intent: string;
}

/**
 * Bungie's names for the ways a write specifically can fail, in words that
 * say what to do next. These are the codes a player actually hits, taken
 * from the platform error table and confirmed against the endpoints below.
 */
function explainWrite(status: string, message: string): string {
  switch (status) {
    case 'DestinyItemNotFound':
      return 'Bungie could not find that item any more. It usually means the vault changed in game since this page loaded, so refresh and try again.';
    case 'DestinyCannotPerformActionOnEquippedItem':
      return 'That item is equipped, and Destiny will not move something you are wearing. Equip something else in the slot first.';
    case 'DestinyCannotPerformActionAtThisLocation':
      return 'Destiny refuses transfers while your character is in an activity or in orbit loading. Stand somewhere safe and try again.';
    case 'DestinyNoRoomInDestination':
      return 'There is no room in the destination. A full slot on the character, or a full vault, both land here.';
    case 'DestinyItemUniqueEquipRestricted':
      return 'That is an exotic and you already have an exotic equipped in that group. Destiny allows one exotic weapon and one exotic armour piece.';
    case 'DestinyItemActionForbidden':
      return 'Destiny will not perform that action on that item. Quest items, engrams and postmaster items all refuse for their own reasons.';
    case 'DestinyCharacterNotInTower':
    case 'DestinyCannotPerformActionWhileInCombat':
      return 'Destiny only allows this while you are not in combat. Head to orbit or a social space.';
    case 'DestinyItemNotTransferrable':
      return 'That item cannot be moved at all. Some quest and seasonal items are bound where they are.';
    case 'ApiKeyMissingFromRequest':
    case 'ApiInvalidOrExpiredKey':
      return 'This site\'s own key was rejected, which is a fault here and nothing to do with your account.';
    case 'WebAuthRequired':
    case 'AuthorizationRecordExpired':
    case 'AccessTokenHasExpired':
      return 'That sign-in has run out. Bungie sessions last an hour, so sign in again and repeat the action.';
    case 'ApiExceededMaxKeys':
    case 'PerEndpointRequestThrottleExceeded':
    case 'ThrottleLimitExceededMomentarily':
      return 'Bungie is rate limiting us. Wait a few seconds before the next change.';
    default:
      return message || status || 'bungie.net refused the change and did not say why.';
  }
}

/**
 * One authenticated POST. There is no retry here, deliberately. A read that
 * is retried costs a second request; a write that is retried can move an
 * item twice, and Bungie's responses are not idempotent enough to tell the
 * difference between "the first one worked" and "neither did".
 */
async function post(
  path: string,
  body: Record<string, unknown>,
  confirmation: Confirmation,
  timeoutMs = 15_000
): Promise<WriteResult> {
  const session = getSession();
  if (!session) {
    return {
      ok: false,
      code: 0,
      message: 'That sign-in has run out, so nothing was changed. Sign in again and repeat the action.',
      intent: confirmation.intent
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(API_ROOT + path, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    // A timeout on a write is the genuinely uncomfortable case: the request
    // may have landed. Say so rather than implying nothing happened.
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      code: 0,
      message: aborted
        ? 'bungie.net did not answer in time. The change may or may not have gone through, so check in game before repeating it.'
        : 'Could not reach bungie.net, and nothing was sent.',
      intent: confirmation.intent
    };
  } finally {
    clearTimeout(timer);
  }

  let payload: { ErrorCode?: number; ErrorStatus?: string; Message?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return {
      ok: false,
      code: 0,
      message: 'bungie.net answered HTTP ' + response.status + ' with something that was not JSON.',
      intent: confirmation.intent
    };
  }

  const code = payload.ErrorCode ?? 0;
  if (code === 1) {
    return { ok: true, code, message: 'Done.', intent: confirmation.intent };
  }
  return {
    ok: false,
    code,
    message: explainWrite(payload.ErrorStatus ?? '', payload.Message ?? ''),
    intent: confirmation.intent
  };
}

// -------------------------------------------------------------- the actions

/** Equip one item on one character. The item must already be on that character. */
export function equipItem(
  account: Account,
  characterId: string,
  itemId: string,
  confirmation: Confirmation
): Promise<WriteResult> {
  return post(
    '/Destiny2/Actions/Items/EquipItem/',
    { itemId, characterId, membershipType: account.membershipType },
    confirmation
  );
}

export interface BulkEquipOutcome {
  itemId: string;
  code: number;
}

export interface BulkEquipResult extends WriteResult {
  /** Per item, because Bungie reports a partial success as an overall one. */
  perItem: BulkEquipOutcome[];
}

/**
 * Equip several items at once, which is how a loadout should be applied.
 *
 * The trap here, and the reason this does not just return WriteResult: this
 * endpoint answers ErrorCode 1 even when individual items failed, and puts
 * the real answer in equipResults. Reading only the envelope reports a
 * loadout as applied while half of it is still in the vault.
 */
export async function equipItems(
  account: Account,
  characterId: string,
  itemIds: string[],
  confirmation: Confirmation
): Promise<BulkEquipResult> {
  if (itemIds.length === 0) {
    return { ok: true, code: 1, message: 'Nothing to equip.', intent: confirmation.intent, perItem: [] };
  }
  const session = getSession();
  if (!session) {
    return {
      ok: false,
      code: 0,
      message: 'That sign-in has run out, so nothing was changed.',
      intent: confirmation.intent,
      perItem: []
    };
  }

  let payload: {
    ErrorCode?: number;
    ErrorStatus?: string;
    Message?: string;
    Response?: { equipResults?: Array<{ itemInstanceId?: string; equipStatus?: number }> };
  } = {};
  try {
    const response = await fetch(API_ROOT + '/Destiny2/Actions/Items/EquipItems/', {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ itemIds, characterId, membershipType: account.membershipType })
    });
    payload = (await response.json()) as typeof payload;
  } catch {
    return {
      ok: false,
      code: 0,
      message: 'Could not reach bungie.net while applying the loadout.',
      intent: confirmation.intent,
      perItem: []
    };
  }

  const perItem: BulkEquipOutcome[] = (payload.Response?.equipResults ?? []).map((entry) => ({
    itemId: entry.itemInstanceId ?? '',
    code: entry.equipStatus ?? 0
  }));
  const failed = perItem.filter((entry) => entry.code !== 1);
  const envelopeCode = payload.ErrorCode ?? 0;

  if (envelopeCode !== 1) {
    return {
      ok: false,
      code: envelopeCode,
      message: explainWrite(payload.ErrorStatus ?? '', payload.Message ?? ''),
      intent: confirmation.intent,
      perItem
    };
  }
  if (failed.length > 0) {
    return {
      ok: false,
      code: 1,
      message:
        failed.length +
        ' of ' +
        itemIds.length +
        ' items did not equip. Destiny reports these one by one, so the rest of the loadout did go on.',
      intent: confirmation.intent,
      perItem
    };
  }
  return {
    ok: true,
    code: 1,
    message: 'All ' + itemIds.length + ' items equipped.',
    intent: confirmation.intent,
    perItem
  };
}

/**
 * Move an item to a character or to the vault.
 *
 * Destiny has no character to character transfer. Moving a gun from your
 * Titan to your Hunter is two calls: to the vault, then out of it. The
 * loadout planner in loadouts.ts is what knows that; this function stays the
 * single hop the API actually offers.
 */
export function transferItem(
  account: Account,
  options: {
    itemReferenceHash: number;
    itemId: string;
    characterId: string;
    toVault: boolean;
    stackSize?: number;
  },
  confirmation: Confirmation
): Promise<WriteResult> {
  return post(
    '/Destiny2/Actions/Items/TransferItem/',
    {
      itemReferenceHash: options.itemReferenceHash,
      stackSize: options.stackSize ?? 1,
      transferToVault: options.toVault,
      itemId: options.itemId,
      characterId: options.characterId,
      membershipType: account.membershipType
    },
    confirmation
  );
}

/** Lock or unlock, which is the one write with no way to lose an item. */
export function setLockState(
  account: Account,
  options: { itemId: string; characterId: string; locked: boolean },
  confirmation: Confirmation
): Promise<WriteResult> {
  return post(
    '/Destiny2/Actions/Items/SetLockState/',
    {
      state: options.locked,
      itemId: options.itemId,
      characterId: options.characterId,
      membershipType: account.membershipType
    },
    confirmation
  );
}
