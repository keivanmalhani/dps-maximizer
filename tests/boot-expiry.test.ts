// @vitest-environment jsdom
//
// The awkward half of the hour: the stored session still looks fine, and
// bungie.net rejects the token anyway. A revoked authorisation does this,
// and so does a clock that disagrees. The page has to end up offering the
// sign-in button, because the message it prints tells the reader to press
// one, and code 2111 must never be retried on the way.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

const calls: string[] = [];

beforeAll(async () => {
  sessionStorage.setItem(
    'd2.session',
    JSON.stringify({
      accessToken: 'revoked-token',
      // A full hour left, so nothing local has any reason to doubt it.
      expiresAt: Date.now() + 3_600_000,
      membershipId: '4611686018400000000'
    })
  );
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(
      JSON.stringify({ ErrorCode: 2111, ErrorStatus: 'AccessTokenHasExpired' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/main');

  document.querySelector<HTMLButtonElement>('#mine')?.click();
  await new Promise((r) => setTimeout(r, 80));
});

describe('a token bungie.net rejects before the clock runs out', () => {
  it('asked Bungie who is signed in and got nowhere', () => {
    expect(calls.some((c) => c.includes('/User/GetMembershipsForCurrentUser/'))).toBe(true);
  });

  it('did not retry the dead token', () => {
    expect(calls.length).toBe(1);
  });

  it('says the sign-in ran out instead of printing the error code', () => {
    const status = document.querySelector('#runbar-status')?.textContent || '';
    expect(status).toContain('That sign-in has run out');
    expect(status).toContain('Sign in again');
    expect(status).not.toContain('2111');
    expect(status).not.toContain('AccessTokenHasExpired');
  });

  it('throws the dead session away rather than counting down to nothing', () => {
    expect(sessionStorage.getItem('d2.session')).toBeNull();
  });

  it('puts the button back, since the message tells the reader to press one', () => {
    expect(document.querySelector('#signin')).not.toBeNull();
    expect(document.querySelector('#mine')).toBeNull();
    expect(document.querySelector('#session')?.textContent).toContain('read your own vault');
  });

  it('never wiped the demo answer while any of this happened', () => {
    expect(document.querySelectorAll('#answer .pick').length).toBeGreaterThanOrEqual(4);
  });
});
