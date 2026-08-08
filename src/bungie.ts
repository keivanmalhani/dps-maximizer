// Bungie.net platform client.
//
// Every call carries the shared application key from auth.ts, plus the
// signed-in visitor's access token: the whole point of this site is reading
// the vault and Collections, and those are authenticated components. There is
// no anonymous lookup path here, because GetProfile without the token would
// silently return a fraction of the truth and the site would rather not lie
// by omission.
//
// The retry rule is the one the sibling sites measured the hard way: Bungie
// returns ordinary application errors as HTTP 500 with a real ErrorCode in
// the body, so any retry written as `status >= 500` retries a private
// account, a missing account and an expired token four times over for the
// same answer. The ERROR CODE decides first; the HTTP status only matters
// when there is no code at all. The four codes that mean the sign-in is over
// (99, 2111, 2123, 2124) are never retried.

import { API_KEY } from './auth';
import type { ProfileResponse } from './ownership';

export const PLATFORM = 'https://www.bungie.net/Platform';
export const BUNGIE_ROOT = 'https://www.bungie.net';

/** Platform error codes this app reacts to by name. */
export const ERROR_CODES = {
  Success: 1,
  WebAuthRequired: 99,
  SystemDisabled: 5,
  DestinyAccountNotFound: 1601,
  DestinyUnexpectedError: 1618,
  DestinyPrivacyRestriction: 1665,
  ApiInvalidOrExpiredKey: 2101,
  ApiKeyMissingFromRequest: 2102,
  AccessTokenHasExpired: 2111,
  AuthorizationRecordExpired: 2123,
  AuthorizationRecordRevoked: 2124
} as const;

/**
 * The codes that mean the hour ran out, as opposed to the request being
 * wrong. Bungie issues no refresh token to a public client, so there is
 * nothing to do about any of these except sign in again, and retrying them
 * is asking the same question louder.
 */
export const AUTH_EXPIRY_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES.WebAuthRequired,
  ERROR_CODES.AccessTokenHasExpired,
  ERROR_CODES.AuthorizationRecordExpired,
  ERROR_CODES.AuthorizationRecordRevoked
]);

/**
 * A detached reference to the global fetch throws in some browsers, so every
 * default goes through this wrapper rather than through `fetch` directly.
 */
export const defaultFetch: typeof fetch = (input, init) => fetch(input, init);

export type FailureKind =
  | 'app-key'
  | 'signed-out'
  | 'private'
  | 'not-found'
  | 'no-characters'
  | 'network'
  | 'bungie-down'
  | 'unknown';

export class BungieError extends Error {
  readonly kind: FailureKind;
  readonly code: number;

  constructor(kind: FailureKind, message: string, code = 0) {
    super(message);
    this.name = 'BungieError';
    this.kind = kind;
    this.code = code;
  }
}

/** Human readable explanation for every failure the UI can hit. */
export function explainFailure(kind: FailureKind): string {
  switch (kind) {
    case 'app-key':
      return 'Bungie rejected this site\'s own API key, which is a fault here and not anything to do with your account. Nothing will load until the key is replaced.';
    case 'signed-out':
      return 'That sign-in has run out. Bungie sessions last an hour and cannot be renewed, so signing in again is the only way to carry on.';
    case 'private':
      return 'Bungie will not show this account\'s inventory. Signing in as the account holder is what makes a private vault readable, so if you are seeing this while signed in, the session has likely lapsed.';
    case 'not-found':
      return 'That Bungie account has no Destiny account on it.';
    case 'no-characters':
      return 'That account exists but has no Destiny characters on it.';
    case 'network':
      return 'The request to bungie.net did not complete. That is usually a connection problem rather than an account problem.';
    case 'bungie-down':
      return 'The Bungie API is in maintenance or returning errors right now. Try again in a little while.';
    default:
      return 'Something went wrong talking to bungie.net.';
  }
}

export function kindForCode(code: number): FailureKind {
  if (AUTH_EXPIRY_CODES.has(code)) return 'signed-out';
  switch (code) {
    case ERROR_CODES.ApiKeyMissingFromRequest:
    case ERROR_CODES.ApiInvalidOrExpiredKey:
      return 'app-key';
    case ERROR_CODES.DestinyPrivacyRestriction:
      return 'private';
    case ERROR_CODES.DestinyAccountNotFound:
      return 'not-found';
    case ERROR_CODES.SystemDisabled:
    case ERROR_CODES.DestinyUnexpectedError:
      return 'bungie-down';
    default:
      return 'unknown';
  }
}

export interface BungieEnvelope<T> {
  Response?: T;
  ErrorCode?: number;
  ErrorStatus?: string;
  Message?: string;
}

export interface FetchOptions {
  /** Overrides the shared application key. Only tests have a reason to. */
  apiKey?: string;
  /** The signed-in visitor's token. */
  accessToken?: string | null;
  retries?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One platform GET with retry. The error code decides whether a retry can
 * help; only 'bungie-down', 'network' and codeless 'unknown' failures are
 * transient. Auth expiry (99, 2111, 2123, 2124), privacy, not-found and a
 * bad application key are answered questions and are thrown immediately.
 */
export async function platformFetch<T>(
  path: string,
  options: FetchOptions = {},
  fetchImpl: typeof fetch = defaultFetch
): Promise<T> {
  const retries = options.retries ?? 2;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Key': options.apiKey || API_KEY
  };
  if (options.accessToken) headers['Authorization'] = 'Bearer ' + options.accessToken;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(300 * Math.pow(2, attempt - 1));
    let response: Response;
    try {
      response = await fetchImpl(PLATFORM + path, { headers, signal: options.signal });
    } catch {
      lastError = new BungieError('network', 'Could not reach bungie.net.');
      continue;
    }
    let envelope: BungieEnvelope<T>;
    try {
      envelope = (await response.json()) as BungieEnvelope<T>;
    } catch {
      lastError = new BungieError('bungie-down', 'bungie.net returned a non JSON body.');
      continue;
    }
    const code = envelope.ErrorCode ?? 0;
    if (code === ERROR_CODES.Success && envelope.Response !== undefined) {
      return envelope.Response;
    }
    if (code === 0) {
      // No code at all: only now does the HTTP status get a vote.
      lastError = new BungieError(
        response.ok ? 'unknown' : 'bungie-down',
        'bungie.net answered HTTP ' + response.status + ' with no error code.'
      );
      continue;
    }
    const kind = kindForCode(code);
    const error = new BungieError(
      kind,
      envelope.Message || 'bungie.net returned error code ' + code,
      code
    );
    // Only transient classes are worth another attempt. 'signed-out' is
    // never one of them: those four codes mean sign in again, full stop.
    if (kind === 'bungie-down' || kind === 'unknown') {
      lastError = error;
      continue;
    }
    throw error;
  }
  throw lastError instanceof Error
    ? lastError
    : new BungieError('unknown', 'bungie.net request failed.');
}

// ------------------------------------------------------------------ profile

/**
 * The components this site reads, and why:
 *   100 profile           which characters exist
 *   102 profileInventory  the vault
 *   200 characters        class, light, Armor 3.0 stats
 *   201 charInventories   what characters are carrying
 *   205 equipment         what characters are wearing
 *   300 itemInstances     instance-level state
 *   305 itemSockets       rolls and catalysts
 *   800 collectibles      what is unlocked but not held
 *   900 records           requested for completeness of the snapshot
 */
export const PROFILE_COMPONENTS = [100, 102, 200, 201, 205, 300, 305, 800, 900] as const;

export interface PlayerRef {
  membershipType: number;
  membershipId: string;
  displayName: string;
  displayNameCode: number;
}

/**
 * One authenticated GetProfile for everything. The vault and Collections are
 * only populated when the token belongs to the account, which is why this
 * site is sign-in only.
 */
export async function getProfile(
  player: PlayerRef,
  accessToken: string,
  fetchImpl: typeof fetch = defaultFetch
): Promise<ProfileResponse> {
  return platformFetch<ProfileResponse>(
    '/Destiny2/' +
      player.membershipType +
      '/Profile/' +
      player.membershipId +
      '/?components=' +
      PROFILE_COMPONENTS.join(','),
    { accessToken },
    fetchImpl
  );
}

/** Render a player back into the canonical "Name#0042" form. */
export function formatBungieName(player: {
  displayName: string;
  displayNameCode: number;
}): string {
  const code = String(player.displayNameCode).padStart(4, '0');
  return player.displayName + '#' + code;
}
