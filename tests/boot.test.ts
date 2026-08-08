// @vitest-environment jsdom
//
// Boots the real page: the shipped index.html markup plus main.ts, with no
// network and nobody signed in. Demo mode has to render a full answer on
// load with nothing set up, which is the promise the site makes. The
// signed-in half of the same boot is in boot-signed-in.test.ts, which needs
// its own module registry to seed a session before main.ts reads one.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

beforeAll(async () => {
  sessionStorage.clear();
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  await import('../src/main');
});

describe('first paint', () => {
  it('renders the full answer card signed out with no network call', () => {
    expect(document.querySelector('#answer')).not.toBeNull();
    expect(document.querySelectorAll('#answer .pick').length).toBeGreaterThanOrEqual(4);
  });

  it('flags the demo as invented', () => {
    const text = document.querySelector('#runbar')?.textContent || '';
    expect(text).toContain('Demo data');
    expect(text).toContain('invented account');
  });

  it('carries the stamp, visibly', () => {
    expect(document.body.textContent).toContain(
      'Data current as of Update 9.7.0.4, 28 July 2026'
    );
  });

  it('renders the rotation, the next unlock, the stats and the cheat sheet', () => {
    const text = document.body.textContent || '';
    expect(text).toContain('The rotation');
    expect(text).toContain('Next unlock');
    expect(text).toContain('What your armor is doing for your damage');
    expect(text).toContain('What stacks, what does not, and the myths');
  });

  it('the next unlock is the missing tier 1 rocket with its raid path', () => {
    const text = document.body.textContent || '';
    expect(text).toContain('Hezen Vengeance');
    expect(text).toContain('Vault of Glass');
  });
});

describe('the way in', () => {
  it('asks nobody for an API key', () => {
    expect(document.querySelector('#api-key')).toBeNull();
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
    const text = document.body.textContent || '';
    expect(text).not.toContain('API key');
    expect(document.body.innerHTML).not.toContain('bungie.net/en/Application');
  });

  it('offers sign-in and says plainly what it buys', () => {
    const button = document.querySelector<HTMLButtonElement>('#signin');
    expect(button).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('Sign in with Bungie');
    expect(document.querySelector('#session')?.textContent).toContain('read your own vault');
  });

  it('has no name-lookup box, because a vault is owner-only', () => {
    expect(document.querySelectorAll('input')).toHaveLength(0);
  });
});

describe('the pickers', () => {
  it('switching activity to PvP shows the honest refusal', async () => {
    document
      .querySelector<HTMLButtonElement>('button[data-activity="pvp"]')
      ?.click();
    await new Promise((r) => setTimeout(r, 10));
    const text = document.body.textContent || '';
    expect(text).toContain('No PvP verdict, and that is the verdict');
    expect(text).toContain('out of scope');
  });

  it('and switching back restores the full answer', async () => {
    document
      .querySelector<HTMLButtonElement>('button[data-activity="boss-burst"]')
      ?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelectorAll('#answer .pick').length).toBeGreaterThanOrEqual(4);
  });

  it('switching class to Hunter surfaces the Well versus Golden Gun warning', async () => {
    document.querySelector<HTMLButtonElement>('button[data-class="1"]')?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('[data-warning="well-overrides-golden-gun"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Golden Gun');
  });

  it('switching class to Titan removes it again, exactly', async () => {
    document.querySelector<HTMLButtonElement>('button[data-class="0"]')?.click();
    await new Promise((r) => setTimeout(r, 10));
    expect(document.querySelector('[data-warning="well-overrides-golden-gun"]')).toBeNull();
  });

  it('master mode annotates champions', async () => {
    document
      .querySelector<HTMLButtonElement>('button[data-activity="master-champions"]')
      ?.click();
    await new Promise((r) => setTimeout(r, 10));
    const text = document.body.textContent || '';
    expect(text).toContain('Stuns');
    expect(text).toContain('no activation criteria');
    document
      .querySelector<HTMLButtonElement>('button[data-activity="boss-burst"]')
      ?.click();
  });
});

describe('what the page links out to', () => {
  it('every pick is a real anchor to its light.gg entry', () => {
    const links = Array.from(document.querySelectorAll('a[href^="https://www.light.gg/db/items/"]'));
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it('the footer links the source repo', () => {
    expect(
      document.querySelector('a[href="https://github.com/keivanmalhani/dps-maximizer"]')
    ).not.toBeNull();
  });
});
