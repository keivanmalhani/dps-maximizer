// The markup functions: pure strings in, pure strings out, so what the page
// says is testable without a browser.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile, DEMO_FLAG_LINE } from '../fixtures/demo';
import { MANIFEST_VERSION } from '../src/data/items';
import { escapeText, clampStat } from '../src/format';
import { parseProfile } from '../src/ownership';
import { recommend } from '../src/recommend';
import { signInView } from '../src/signin';
import {
  answerSection,
  buffsSection,
  footerSection,
  nextUnlockSection,
  pickerSection,
  resultPage,
  rotationSection,
  runbar,
  statsSection,
  type PageModel
} from '../src/ui/sections';
import type { GuardianClass } from '../src/types';

const data = parseProfile(buildDemoProfile());

function model(overrides: Partial<PageModel> = {}): PageModel {
  return {
    source: 'demo',
    playerName: 'Meridian#0404',
    flagLine: DEMO_FLAG_LINE,
    classType: 0 as GuardianClass,
    activity: 'boss-burst',
    availableClasses: [0, 1, 2],
    character: data.characters[0],
    ...overrides
  };
}

const signedOut = signInView(null, 0);

describe('escapeText and clampStat', () => {
  it('escapes the five characters that matter', () => {
    expect(escapeText('<a b="c">&\'')).toBe('&lt;a b=&quot;c&quot;&gt;&amp;&#39;');
  });

  it('clamps stats into 0..200', () => {
    expect(clampStat(-5)).toBe(0);
    expect(clampStat(120.6)).toBe(121);
    expect(clampStat(900)).toBe(200);
    expect(clampStat(Number.NaN)).toBe(0);
  });
});

describe('runbar', () => {
  it('flags the demo as invented', () => {
    const html = runbar(model(), signedOut);
    expect(html).toContain('Demo data');
    expect(html).toContain('invented account');
  });

  it('flags a live read as the visitor\'s account', () => {
    const html = runbar(model({ source: 'live', playerName: 'Real#0001' }), signedOut);
    expect(html).toContain('Your account');
    expect(html).toContain('Real#0001');
    expect(html).toContain('Nothing was stored');
  });

  it('offers sign-in signed out, and only sign-in', () => {
    const html = runbar(model(), signedOut);
    expect(html).toContain('id="signin"');
    expect(html).not.toContain('id="mine"');
    expect(html).not.toContain('id="signout"');
  });

  it('offers the vault read and sign-out once signed in', () => {
    const signedIn = signInView(
      { accessToken: 't', expiresAt: Date.now() + 3600000, membershipId: 'm' },
      55
    );
    const html = runbar(model(), signedIn);
    expect(html).toContain('Read my vault');
    expect(html).toContain('id="signout"');
    expect(html).not.toContain('id="signin"');
  });

  it('escapes a hostile player name', () => {
    const html = runbar(
      model({ source: 'live', playerName: '<img src=x onerror=alert(1)>#0001' }),
      signedOut
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('picker', () => {
  it('renders a chip per class and activity, with the current ones lit', () => {
    const html = pickerSection(model());
    expect(html).toContain('data-class="0"');
    expect(html).toContain('data-class="1"');
    expect(html).toContain('data-class="2"');
    for (const activity of ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions', 'pvp']) {
      expect(html).toContain('data-activity="' + activity + '"');
    }
    expect(html).toContain('chip chip--on');
  });

  it('offers only the classes the account actually has', () => {
    const html = pickerSection(model({ availableClasses: [2] }));
    expect(html).toContain('data-class="2"');
    expect(html).not.toContain('data-class="0"');
  });
});

describe('answerSection', () => {
  const verdict = recommend(data, 0, 'boss-burst');

  it('leads with the headline and carries the stamp', () => {
    const html = answerSection(verdict);
    expect(html).toContain('The answer');
    expect(html).toContain('Update 9.7.0.4, 28 July 2026');
  });

  it('shows a quoted reason with its source on a pick', () => {
    // Was Gjallarhorn's quote before the one-exotic rule: that loadout
    // (Ergo Sum + Gjallarhorn) was illegal, and the legal answer keeps Ergo
    // Sum, so the quote asserted here is Ergo Sum's.
    const html = answerSection(verdict);
    expect(html).toContain('&quot;Best sword damage when Transcendent&quot;');
    expect(html).toContain('Aegis boss damage sheet, equipment tab, 2026-07');
  });

  it('renders the one-exotic note in the red honest voice', () => {
    const html = answerSection(verdict);
    expect(html).toContain('pick__exclusive');
    expect(html).toContain('you can only equip one exotic weapon');
    expect(html).toContain('Gjallarhorn');
  });

  it('renders the one-exotic note inside an emptied slot card too', () => {
    // Boss sustained: the exotic seat goes to Thunderlord (power), the
    // energy slot has no tiered legendary, and the empty card says why.
    const html = answerSection(recommend(data, 0, 'boss-sustained'));
    expect(html).toContain('pick--empty');
    expect(html).toContain('Cloudstrike is the best energy pick you own');
    expect(html).toContain('this loadout&#39;s exotic is Thunderlord');
  });

  it('links every pick to its light.gg page as a real anchor', () => {
    const html = answerSection(verdict);
    expect(html).toContain('https://www.light.gg/db/items/');
    expect(html).toContain('rel="noreferrer noopener"');
  });

  it('names the gap when the ideal is missing', () => {
    const html = answerSection(verdict);
    expect(html).toContain('Hezen Vengeance');
    expect(html).toContain('cannot build yet');
  });

  it('keeps the fireteam jobs out of the personal slots', () => {
    const html = answerSection(verdict);
    expect(html).toContain('Fireteam jobs, not your slots');
    expect(html).toContain('Tractor Cannon');
  });

  it('renders the pvp refusal as the whole answer', () => {
    const html = answerSection(recommend(data, 0, 'pvp'));
    expect(html).toContain('PvP is out of scope');
    expect(html).not.toContain('answer__grid');
  });

  it('marks warnings with their ids for the tests and the eye', () => {
    const html = answerSection(recommend(data, 1, 'boss-burst'));
    expect(html).toContain('data-warning="well-overrides-golden-gun"');
  });

  it('shows the champion notes in master mode', () => {
    const html = answerSection(recommend(data, 0, 'master-champions'));
    expect(html).toContain('Stuns');
    expect(html).toContain('no activation criteria');
  });
});

describe('rotationSection', () => {
  it('renders numbered steps and the caveats', () => {
    const verdict = recommend(data, 0, 'boss-sustained');
    const html = rotationSection(verdict);
    expect(html).toContain('The rotation');
    expect(html).toContain('rotation__n');
  });

  it('renders nothing for pvp', () => {
    expect(rotationSection(recommend(data, 0, 'pvp'))).toBe('');
  });
});

describe('nextUnlockSection', () => {
  it('shows one item with its acquisition and the cipher pointer', () => {
    const verdict = recommend(data, 0, 'boss-burst');
    const html = nextUnlockSection(verdict);
    expect(html).toContain('Hezen Vengeance');
    expect(html).toContain('Vault of Glass');
    expect(html).toContain('One item on purpose');
    expect(html).toContain('The Queenbreaker');
  });

  it('celebrates completion honestly when nothing is missing', () => {
    const everything = parseProfile(buildDemoProfile());
    for (const entry of Object.values(everything.owned)) {
      entry.state = 'instances';
      if (entry.instanceIds.length === 0) entry.instanceIds = ['x'];
    }
    const html = nextUnlockSection(recommend(everything, 0, 'boss-burst'));
    expect(html).toContain('There is no next unlock');
    expect(html).toContain('practice, not shopping');
  });
});

describe('statsSection', () => {
  it('shows the six stats against their published ceilings', () => {
    const html = statsSection(model());
    expect(html).toContain('Weapons');
    expect(html).toContain('/200');
    expect(html).toContain('15% weapon damage');
    expect(html).toContain('Powerhouse');
    expect(html).toContain('Bungie/PC Gamer 2025-07-14');
  });

  it('says when the numbers are demo numbers', () => {
    expect(statsSection(model())).toContain('demo numbers');
    expect(statsSection(model({ source: 'live' }))).not.toContain('demo numbers');
  });

  it('renders nothing without a character', () => {
    expect(statsSection(model({ character: null }))).toBe('');
  });
});

describe('buffsSection', () => {
  const html = buffsSection();

  it('renders all four buckets', () => {
    expect(html).toContain('1. Empowering buffs');
    expect(html).toContain('2. Weapon surges');
    expect(html).toContain('3. Weapon perks');
    expect(html).toContain('4. Debuffs');
  });

  it('carries the verified numbers and the pending label', () => {
    expect(html).toContain('35 percent');
    expect(html).toContain('10 percent');
    expect(html).toContain('30 percent');
    expect(html).toContain('pending');
  });

  it('debunks the myths on the page', () => {
    expect(html).toContain('Myth: bosses take more damage early');
    expect(html).toContain('Myth: higher FPS');
  });
});

describe('footer and whole page', () => {
  it('the footer carries the stamp and the manifest version', () => {
    const html = footerSection();
    expect(html).toContain('Update 9.7.0.4, 28 July 2026');
    expect(html).toContain(MANIFEST_VERSION);
    expect(html).toContain('github.com/keivanmalhani/dps-maximizer');
  });

  it('resultPage assembles every section in product order', () => {
    const verdict = recommend(data, 0, 'boss-burst');
    const html = resultPage(model(), verdict, signedOut);
    const order = [
      html.indexOf('id="runbar"'),
      html.indexOf('id="picker"'),
      html.indexOf('id="answer"'),
      html.indexOf('The rotation'),
      html.indexOf('Next unlock'),
      html.indexOf('Your stats'),
      html.indexOf('The arithmetic'),
      html.indexOf('Class notes')
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i], 'section ' + i).toBeGreaterThan(order[i - 1]);
    }
  });

  it('the pvp page skips stats but keeps the cheat sheet', () => {
    const verdict = recommend(data, 0, 'pvp');
    const html = resultPage(model({ activity: 'pvp' }), verdict, signedOut);
    expect(html).not.toContain('Your stats');
    expect(html).toContain('The arithmetic');
  });
});
