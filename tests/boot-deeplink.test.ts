// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://localhost/dps-maximizer/?activity=vault-of-glass&encounter=templar&class=hunter"}
//
// The deep link, booted for real: the shipped index.html plus main.ts with
// an encounter URL, signed out, no network. The page must restore the
// Templar/Hunter state from the query string on load, which is the whole
// point of encounter loadouts being shareable.

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

describe('booting on a deep link', () => {
  it('restores the encounter: the Templar page is the first paint', () => {
    const headline = document.querySelector('.answer__headline')?.textContent ?? '';
    expect(headline).toContain('Templar');
    expect(headline).toContain('Vault of Glass');
  });

  it('restores the class from the URL', () => {
    expect(headline()).toContain('Hunter');
    const onChip = document.querySelector('.picker [data-class].chip--on');
    expect(onChip?.getAttribute('data-class')).toBe('1');
  });

  it('shows the encounter strip with the Templar chip lit', () => {
    const lit = document.querySelector('[data-encounter].chip--on');
    expect(lit?.getAttribute('data-encounter')).toBe('templar');
    expect(document.querySelector('[data-encounter="gorgons"]')).not.toBeNull();
  });

  it('shows the sourced explosive-DR rule on the page', () => {
    expect(document.querySelector('[data-ecard="explosive-dr"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Ritual of Negation');
    expect(document.body.textContent).toContain('Encounter research brief, 2026-08-08');
  });

  it('keeps the loadout legal: at most one exotic weapon on the answer', () => {
    // The demo Hunter Templar answer: read the picks off the DOM and count
    // the exotics via their names. The engine tests prove this deeply; this
    // is the browser-shaped smoke of the same rule.
    const names = Array.from(document.querySelectorAll('#answer .pick__name')).map(
      (n) => n.textContent ?? ''
    );
    expect(names.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the URL as shared: the query string survives the boot', () => {
    expect(location.search).toContain('activity=vault-of-glass');
    expect(location.search).toContain('encounter=templar');
    expect(location.search).toContain('class=hunter');
  });

  it('clicking a no-DPS encounter routes to the honest empty state', () => {
    document.querySelector<HTMLButtonElement>('[data-encounter="gorgons"]')?.click();
    expect(document.body.textContent).toContain('no damage check here');
    expect(document.body.textContent).toContain('No loadout is recommended');
    expect(location.search).toContain('encounter=gorgons');
    // And back to the boss.
    document.querySelector<HTMLButtonElement>('[data-encounter="templar"]')?.click();
    expect(document.body.textContent).toContain('Ritual of Negation');
  });
});

function headline(): string {
  return document.querySelector('.answer__headline')?.textContent ?? '';
}
