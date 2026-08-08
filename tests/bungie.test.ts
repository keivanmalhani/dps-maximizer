// The platform client's retry discipline: the error code decides first, the
// HTTP status only votes when there is no code, and the four codes that mean
// the sign-in is over are never retried.

import { describe, expect, it } from 'vitest';
import {
  AUTH_EXPIRY_CODES,
  BungieError,
  ERROR_CODES,
  PROFILE_COMPONENTS,
  explainFailure,
  formatBungieName,
  getProfile,
  kindForCode,
  platformFetch
} from '../src/bungie';

function fetchStub(
  responses: Array<{ status?: number; body?: unknown; reject?: boolean }>
): { impl: typeof fetch; calls: Array<{ url: string; headers: Record<string, string> }> } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  let index = 0;
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>
    });
    const step = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (step.reject) throw new TypeError('network down');
    return new Response(JSON.stringify(step.body ?? {}), {
      status: step.status ?? 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as typeof fetch;
  return { impl, calls };
}

const ok = { body: { ErrorCode: 1, Response: { fine: true } } };

describe('platformFetch', () => {
  it('returns the Response payload on success', async () => {
    const { impl } = fetchStub([ok]);
    const result = await platformFetch<{ fine: boolean }>('/x/', {}, impl);
    expect(result.fine).toBe(true);
  });

  it('sends the API key on every request', async () => {
    const { impl, calls } = fetchStub([ok]);
    await platformFetch('/x/', {}, impl);
    expect(calls[0].headers['X-API-Key']).toBeTruthy();
  });

  it('sends the bearer token when one is supplied', async () => {
    const { impl, calls } = fetchStub([ok]);
    await platformFetch('/x/', { accessToken: 'token-1' }, impl);
    expect(calls[0].headers['Authorization']).toBe('Bearer token-1');
  });

  it.each([[99], [2111], [2123], [2124]])(
    'never retries auth expiry code %d, even inside an HTTP 500',
    async (code) => {
      const { impl, calls } = fetchStub([
        { status: 500, body: { ErrorCode: code, Message: 'expired' } }
      ]);
      await expect(platformFetch('/x/', {}, impl)).rejects.toMatchObject({
        kind: 'signed-out',
        code
      });
      expect(calls.length).toBe(1);
    }
  );

  it('never retries a private account answer', async () => {
    const { impl, calls } = fetchStub([
      { status: 500, body: { ErrorCode: ERROR_CODES.DestinyPrivacyRestriction } }
    ]);
    await expect(platformFetch('/x/', {}, impl)).rejects.toMatchObject({ kind: 'private' });
    expect(calls.length).toBe(1);
  });

  it('never retries an account that does not exist', async () => {
    const { impl, calls } = fetchStub([
      { status: 500, body: { ErrorCode: ERROR_CODES.DestinyAccountNotFound } }
    ]);
    await expect(platformFetch('/x/', {}, impl)).rejects.toMatchObject({ kind: 'not-found' });
    expect(calls.length).toBe(1);
  });

  it('never retries a rejected application key', async () => {
    const { impl, calls } = fetchStub([
      { status: 500, body: { ErrorCode: ERROR_CODES.ApiInvalidOrExpiredKey } }
    ]);
    await expect(platformFetch('/x/', {}, impl)).rejects.toMatchObject({ kind: 'app-key' });
    expect(calls.length).toBe(1);
  });

  it('retries SystemDisabled and succeeds when Bungie comes back', async () => {
    const { impl, calls } = fetchStub([
      { status: 500, body: { ErrorCode: ERROR_CODES.SystemDisabled } },
      ok
    ]);
    const result = await platformFetch<{ fine: boolean }>('/x/', {}, impl);
    expect(result.fine).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('retries a network failure', async () => {
    const { impl, calls } = fetchStub([{ reject: true }, ok]);
    const result = await platformFetch<{ fine: boolean }>('/x/', {}, impl);
    expect(result.fine).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('retries a non JSON body as bungie-down', async () => {
    const calls: string[] = [];
    let first = true;
    const impl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      if (first) {
        first = false;
        return new Response('<html>maintenance</html>', { status: 200 });
      }
      return new Response(JSON.stringify(ok.body), { status: 200 });
    }) as typeof fetch;
    const result = await platformFetch<{ fine: boolean }>('/x/', {}, impl);
    expect(result.fine).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('a codeless HTTP 500 is retried, because only then does status matter', async () => {
    const { impl, calls } = fetchStub([{ status: 500, body: {} }, ok]);
    const result = await platformFetch<{ fine: boolean }>('/x/', {}, impl);
    expect(result.fine).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('gives up after the retry budget and surfaces the last error', async () => {
    const { impl, calls } = fetchStub([
      { status: 500, body: { ErrorCode: ERROR_CODES.SystemDisabled, Message: 'down' } }
    ]);
    await expect(platformFetch('/x/', { retries: 1 }, impl)).rejects.toMatchObject({
      kind: 'bungie-down'
    });
    expect(calls.length).toBe(2);
  });
});

describe('kindForCode', () => {
  it('maps the whole expiry set to signed-out', () => {
    for (const code of AUTH_EXPIRY_CODES) expect(kindForCode(code)).toBe('signed-out');
  });

  it('maps the rest of the table', () => {
    expect(kindForCode(ERROR_CODES.ApiKeyMissingFromRequest)).toBe('app-key');
    expect(kindForCode(ERROR_CODES.ApiInvalidOrExpiredKey)).toBe('app-key');
    expect(kindForCode(ERROR_CODES.DestinyPrivacyRestriction)).toBe('private');
    expect(kindForCode(ERROR_CODES.DestinyAccountNotFound)).toBe('not-found');
    expect(kindForCode(ERROR_CODES.SystemDisabled)).toBe('bungie-down');
    expect(kindForCode(ERROR_CODES.DestinyUnexpectedError)).toBe('bungie-down');
    expect(kindForCode(424242)).toBe('unknown');
  });

  it('the expiry set is exactly the four codes', () => {
    expect([...AUTH_EXPIRY_CODES].sort((a, b) => a - b)).toEqual([99, 2111, 2123, 2124]);
  });
});

describe('explainFailure', () => {
  it('has a sentence for every kind', () => {
    for (const kind of [
      'app-key',
      'signed-out',
      'private',
      'not-found',
      'no-characters',
      'network',
      'bungie-down',
      'unknown'
    ] as const) {
      expect(explainFailure(kind).length, kind).toBeGreaterThan(20);
    }
  });

  it('BungieError keeps its kind and code', () => {
    const error = new BungieError('private', 'no', 1665);
    expect(error.kind).toBe('private');
    expect(error.code).toBe(1665);
    expect(error.name).toBe('BungieError');
  });
});

describe('getProfile', () => {
  it('asks for exactly the components the site reads', async () => {
    const { impl, calls } = fetchStub([ok]);
    await getProfile(
      { membershipType: 3, membershipId: '900', displayName: 'X', displayNameCode: 1 },
      'token-x',
      impl
    );
    expect(calls[0].url).toContain('/Destiny2/3/Profile/900/');
    expect(calls[0].url).toContain('components=100,102,200,201,205,300,304,305,800,900');
    expect(calls[0].headers['Authorization']).toBe('Bearer token-x');
  });

  it('the component list is the documented one', () => {
    expect([...PROFILE_COMPONENTS]).toEqual([100, 102, 200, 201, 205, 300, 304, 305, 800, 900]);
  });
});

describe('formatBungieName', () => {
  it('pads the code to four digits', () => {
    expect(formatBungieName({ displayName: 'Meridian', displayNameCode: 404 })).toBe(
      'Meridian#0404'
    );
    expect(formatBungieName({ displayName: 'A', displayNameCode: 1 })).toBe('A#0001');
  });
});
