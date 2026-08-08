// The write module's whole job is to be hard to fire by accident and honest
// about what happened when it does fire.
//
// The test that matters most is the partial bulk equip. Bungie answers
// ErrorCode 1 for the ENVELOPE while individual items failed inside
// equipResults, so any code that reads only the envelope reports a loadout
// as applied while half of it is still in the vault. That is the exact shape
// of mistakes rule 44: the instrument reading the wrong field.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/auth', async () => {
  const actual = await vi.importActual<typeof import('../src/auth')>('../src/auth');
  return {
    ...actual,
    getSession: () => sessionForTest
  };
});

import {
  confirmWrite,
  equipItem,
  equipItems,
  setLockState,
  transferItem,
  type Account
} from '../src/write';

let sessionForTest: { accessToken: string; expiresAt: number; membershipId: string } | null = null;

const account: Account = { membershipType: 3, membershipId: '4611686018467284386' };
const ok = () => confirmWrite('Equip Sunshot in the Kinetic slot.');

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let calls: Call[] = [];

function stubFetch(bodies: unknown[]): void {
  let index = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null
    });
    const body = bodies[Math.min(index, bodies.length - 1)];
    index += 1;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });
}

beforeEach(() => {
  calls = [];
  sessionForTest = { accessToken: 'token-abc', expiresAt: Date.now() + 3_600_000, membershipId: 'm' };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('confirmWrite', () => {
  it('refuses a confirmation with nothing written on it', () => {
    expect(() => confirmWrite('')).toThrow(/sentence/i);
    expect(() => confirmWrite('   ')).toThrow(/sentence/i);
  });

  it('carries the exact sentence through to the result', async () => {
    stubFetch([{ ErrorCode: 1 }]);
    const result = await equipItem(account, 'char-1', 'item-1', confirmWrite('  Put the hat on.  '));
    expect(result.intent).toBe('Put the hat on.');
  });
});

describe('equipItem', () => {
  it('posts with the key, the token and a JSON body', async () => {
    stubFetch([{ ErrorCode: 1 }]);
    const result = await equipItem(account, 'char-1', 'item-1', ok());
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('/Destiny2/Actions/Items/EquipItem/');
    expect(calls[0].headers.Authorization).toBe('Bearer token-abc');
    expect(calls[0].headers['Content-Type']).toBe('application/json');
    expect(calls[0].body).toEqual({ itemId: 'item-1', characterId: 'char-1', membershipType: 3 });
  });

  it('never retries, because a repeated write is not the same as a repeated read', async () => {
    stubFetch([{ ErrorCode: 1618, ErrorStatus: 'DestinyUnexpectedError' }]);
    const result = await equipItem(account, 'char-1', 'item-1', ok());
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('turns Bungie enums into something a player can act on', async () => {
    stubFetch([{ ErrorCode: 1642, ErrorStatus: 'DestinyItemUniqueEquipRestricted' }]);
    const result = await equipItem(account, 'char-1', 'item-1', ok());
    expect(result.message).toMatch(/one exotic weapon and one exotic armour/i);
    expect(result.code).toBe(1642);
  });

  it('says nothing was sent when the session is gone', async () => {
    sessionForTest = null;
    stubFetch([{ ErrorCode: 1 }]);
    const result = await equipItem(account, 'char-1', 'item-1', ok());
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(result.message).toMatch(/nothing was changed/i);
  });
});

describe('equipItems', () => {
  it('reports a partial failure even though the envelope says success', async () => {
    stubFetch([
      {
        ErrorCode: 1,
        Response: {
          equipResults: [
            { itemInstanceId: 'a', equipStatus: 1 },
            { itemInstanceId: 'b', equipStatus: 1642 },
            { itemInstanceId: 'c', equipStatus: 1 }
          ]
        }
      }
    ]);
    const result = await equipItems(account, 'char-1', ['a', 'b', 'c'], ok());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/^1 of 3 items did not equip/);
    expect(result.perItem.filter((entry) => entry.code !== 1)).toEqual([{ itemId: 'b', code: 1642 }]);
  });

  it('reports a clean run as clean', async () => {
    stubFetch([
      { ErrorCode: 1, Response: { equipResults: [{ itemInstanceId: 'a', equipStatus: 1 }] } }
    ]);
    const result = await equipItems(account, 'char-1', ['a'], ok());
    expect(result.ok).toBe(true);
    expect(result.message).toBe('All 1 items equipped.');
  });

  it('does not call bungie at all for an empty loadout', async () => {
    stubFetch([{ ErrorCode: 1 }]);
    const result = await equipItems(account, 'char-1', [], ok());
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('fails the whole call when the envelope itself failed', async () => {
    stubFetch([{ ErrorCode: 99, ErrorStatus: 'WebAuthRequired' }]);
    const result = await equipItems(account, 'char-1', ['a'], ok());
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sign in again/i);
  });
});

describe('transferItem and setLockState', () => {
  it('sends the vault flag and the reference hash the API demands', async () => {
    stubFetch([{ ErrorCode: 1 }]);
    await transferItem(
      account,
      { itemReferenceHash: 1001, itemId: 'i-1', characterId: 'char-1', toVault: true },
      confirmWrite('Move Sunshot to the vault.')
    );
    expect(calls[0].body).toEqual({
      itemReferenceHash: 1001,
      stackSize: 1,
      transferToVault: true,
      itemId: 'i-1',
      characterId: 'char-1',
      membershipType: 3
    });
  });

  it('explains a refusal to move an equipped item', async () => {
    stubFetch([{ ErrorCode: 1623, ErrorStatus: 'DestinyCannotPerformActionOnEquippedItem' }]);
    const result = await transferItem(
      account,
      { itemReferenceHash: 1, itemId: 'i-1', characterId: 'c', toVault: true },
      confirmWrite('Move it.')
    );
    expect(result.message).toMatch(/Equip something else in the slot first/);
  });

  it('locks by boolean, which is what the endpoint wants', async () => {
    stubFetch([{ ErrorCode: 1 }]);
    await setLockState(
      account,
      { itemId: 'i-1', characterId: 'char-1', locked: true },
      confirmWrite('Lock Sunshot.')
    );
    expect(calls[0].body).toMatchObject({ state: true, itemId: 'i-1' });
  });
});
