// @vitest-environment jsdom
//
// The same boot as boot.test.ts with a session already in sessionStorage,
// which is exactly what happens after /d2-auth/ sends somebody back here. It
// needs to be its own file because main.ts reads the session at import, and
// a test file is the smallest thing vitest gives a fresh module registry to.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

beforeAll(async () => {
  sessionStorage.setItem(
    'd2.session',
    JSON.stringify({
      accessToken: 'test-token',
      expiresAt: Date.now() + 3_600_000,
      membershipId: '4611686018400000000'
    })
  );
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/main');
});

describe('booting with a session already written by d2-auth', () => {
  it('offers one button that reads the vault', () => {
    const mine = document.querySelector<HTMLButtonElement>('#mine');
    expect(mine).not.toBeNull();
    expect(mine?.textContent?.trim()).toBe('Read my vault');
  });

  it('drops the sign-in button and offers signing out instead', () => {
    expect(document.querySelector('#signin')).toBeNull();
    expect(document.querySelector('#signout')).not.toBeNull();
  });

  it('says how much of the hour is left, quietly', () => {
    const note = document.querySelector('#session')?.textContent || '';
    expect(note).toContain('Signed in');
    expect(note).toMatch(/about 5[0-9] minutes left/);
    expect(note).toContain('cannot be renewed');
  });

  it('still renders the demo answer, because a session is not a vault read', () => {
    expect(document.querySelectorAll('#answer .pick').length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector('#runbar')?.textContent).toContain('Demo data');
  });

  it('goes back to offering sign-in when the session is thrown away', () => {
    document.querySelector<HTMLButtonElement>('#signout')?.click();
    expect(sessionStorage.getItem('d2.session')).toBeNull();
    expect(document.querySelector('#signin')).not.toBeNull();
    expect(document.querySelector('#mine')).toBeNull();
    expect(document.querySelector('#session')?.textContent).toContain('read your own vault');
  });

  it('and says it signed out without wiping the answer', () => {
    expect(document.querySelector('#runbar-status')?.textContent).toContain('Signed out');
    expect(document.querySelectorAll('#answer .pick').length).toBeGreaterThanOrEqual(4);
  });
});
