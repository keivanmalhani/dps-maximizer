// The encounter-aware markup: picker growth, the facts panel with sources
// and confidence codes, the rule cards, the alternatives, the arsenal table.
// Pure strings, no browser, same as sections.test.ts.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDemoProfile, DEMO_FLAG_LINE } from '../fixtures/demo';
import {
  ownedArsenal,
  rankArsenal,
  DEFAULT_ARSENAL_FILTERS,
  type ArsenalData
} from '../src/arsenal';
import { findEncounter } from '../src/data/encounters';
import { recommendEncounter } from '../src/encounter';
import { parseProfile } from '../src/ownership';
import { alternativeLoadouts, recommend } from '../src/recommend';
import { signInView } from '../src/signin';
import {
  alternativesSection,
  answerSection,
  arsenalShellSection,
  arsenalTableHtml,
  encounterFactsSection,
  noDpsSection,
  pickerSection,
  resultPage,
  type PageModel
} from '../src/ui/sections';
import type { GuardianClass } from '../src/types';

const data = parseProfile(buildDemoProfile());
const signedOut = signInView(null, 0);

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

function ev(activityId: string, encounterId: string, classType: GuardianClass = 0) {
  const hit = findEncounter(activityId, encounterId)!;
  return recommendEncounter(data, classType, hit.activity, hit.encounter);
}

describe('the grown picker', () => {
  it('keeps the generic chips and adds the grouped activity select', () => {
    const html = pickerSection(model());
    expect(html).toContain('data-activity="boss-burst"');
    expect(html).toContain('id="activity-select"');
    expect(html).toContain('<optgroup label="Raids">');
    expect(html).toContain('<optgroup label="Dungeons">');
    expect(html).toContain('<optgroup label="Pantheon">');
    expect(html).toContain('value="vault-of-glass"');
    expect(html).toContain('value="equilibrium"');
    expect(html).toContain('value="pantheon-insurrection-prime"');
  });

  it('shows the encounter strip for an encounter target, bosses lit, filler dimmed', () => {
    const html = pickerSection(
      model({ target: { kind: 'encounter', activityId: 'vault-of-glass', encounterId: 'templar' } })
    );
    expect(html).toContain('data-encounter="templar"');
    expect(html).toContain('data-encounter="gorgons"');
    expect(html).toContain('chip--dim');
    expect(html).toContain('chip--on');
    // The selected activity is reflected in the select.
    expect(html).toMatch(/value="vault-of-glass" selected/);
  });

  it('shows no strip for generic modes', () => {
    expect(pickerSection(model())).not.toContain('data-encounter=');
  });
});

describe('the facts panel', () => {
  it('Templar: window, range, rules with sources and confidence codes', () => {
    const html = encounterFactsSection(ev('vault-of-glass', 'templar'));
    expect(html).toContain('15s');
    expect(html).toContain('close-mid');
    expect(html).toContain('data-rule="explosive-dr"');
    expect(html).toContain('Ritual of Negation');
    expect(html).toContain('[confidence V]');
    expect(html).toContain('Encounter research brief, 2026-08-08');
    // The window/movement confidence disclaimer is on the page.
    expect(html).toContain('community knowledge unless marked verified');
    // No sourced loadout consensus for Templar: the gap line renders.
    expect(html).toContain('generic boss DPS');
  });

  it('says unrecorded instead of inventing a range for Crota', () => {
    const html = encounterFactsSection(ev('crotas-end', 'crota'));
    expect(html).toContain('unrecorded');
    expect(html).toContain('data-rule="sword-bonus"');
  });

  it('hedges the contested Atheon multiplier in the rules list', () => {
    const html = encounterFactsSection(ev('vault-of-glass', 'atheon'));
    expect(html).toContain('Reported but unconfirmed');
    expect(html).toContain('[confidence C]');
  });

  it('Pantheon pages carry the unpublished-window gap, hedged', () => {
    const html = encounterFactsSection(ev('pantheon-calus-resplendent', 'calus'));
    expect(html).toContain('seconds unpublished');
    expect(html).toContain('data-rule="pantheon-gap"');
    expect(html).toContain('Reported but unconfirmed');
  });
});

describe('the answer section, encounter-aware', () => {
  it('Templar renders the explosive-DR card with tone and source', () => {
    const e = ev('vault-of-glass', 'templar');
    const html = answerSection(e.verdict!, e);
    expect(html).toContain('data-ecard="explosive-dr"');
    expect(html).toContain('ecard--warning');
    expect(html).toContain('data-ecard="cluster-bombs"');
    expect(html).toContain('ecard--bonus');
    expect(html).toContain('Encounter research brief, 2026-08-08');
  });

  it('Iatros leads with the supers-first warning', () => {
    const e = ev('desert-perpetual', 'iatros');
    const html = answerSection(e.verdict!, e);
    expect(html).toContain('data-ecard="non-super-dr"');
    expect(html).toContain('35 percent');
    expect(html).toContain('Super rotations are the answer');
  });

  it('proxy pages replace the fireteam section with the debuffs-are-dead line', () => {
    const e = ev('deep-stone-crypt', 'atraks-1');
    const html = answerSection(e.verdict!, e);
    expect(html).toContain('Debuffs do nothing here');
    // No fireteam item cards render; the override paragraph (which names the
    // debuff jobs to say they are useless here) is the whole section.
    expect(html).not.toContain('fireteam__item');
    expect(html).toContain('add nothing to this damage check');
  });

  it('the super caution renders as its own card where sourced', () => {
    const e = ev('root-of-nightmares', 'nezarec');
    const html = answerSection(e.verdict!, e);
    expect(html).toContain('data-ecard="super-caution"');
    expect(html).toContain('suppressing melee');
  });

  it('the demoted pick explains itself on the card', () => {
    const e = ev('last-wish', 'morgeth');
    const html = answerSection(e.verdict!, e);
    expect(html).toContain('pick__encounter');
    expect(html).toContain('[rule: sniper-dr]');
  });
});

describe('no-DPS encounters', () => {
  it('Gorgons renders the honest empty state instead of a loadout', () => {
    const e = ev('vault-of-glass', 'gorgons');
    const html = noDpsSection(e);
    expect(html).toContain('no damage check here');
    expect(html).toContain('Pick a boss encounter');
  });

  it('resultPage for a no-DPS target skips the answer grid and the arsenal', () => {
    const e = ev('vault-of-glass', 'gorgons');
    const html = resultPage(
      model({ target: { kind: 'encounter', activityId: 'vault-of-glass', encounterId: 'gorgons' } }),
      recommend(data, 0, 'boss-burst'),
      signedOut,
      { encounter: e }
    );
    expect(html).not.toContain('answer__grid');
    expect(html).not.toContain('id="arsenal"');
    expect(html).toContain('data-encounter="templar"'); // the strip still offers the bosses
  });
});

describe('alternatives', () => {
  it('renders options B and C with the exotic-seat story', () => {
    const alts = alternativeLoadouts('boss-burst', data);
    const html = alternativesSection(alts);
    expect(html).toContain('Option B');
    expect(html).toContain('exotic seat');
    expect(html).toContain('one-exotic rule');
  });

  it('renders nothing when there is nothing meaningfully different', () => {
    expect(alternativesSection([])).toBe('');
  });
});

describe('the arsenal table markup', () => {
  const arsenal = JSON.parse(
    readFileSync(new URL('../src/data/arsenal.json', import.meta.url), 'utf8')
  ) as ArsenalData;
  const rows = ownedArsenal(arsenal, buildDemoProfile());

  it('renders the shell in both auto and on-demand flavours', () => {
    expect(arsenalShellSection(true)).toContain('id="arsenal-status"');
    expect(arsenalShellSection(false)).toContain('id="arsenal-load"');
  });

  it('renders roll lines for both fixture states and the filters', () => {
    const ranked = rankArsenal(rows, 'boss-burst', null);
    const html = arsenalTableHtml(
      ranked,
      DEFAULT_ARSENAL_FILTERS,
      '/common/destiny2_content/icons/',
      'Raid boss burst'
    );
    expect(html).toContain('Your roll: Bait and Switch + Envious Assassin.');
    expect(html).toContain('lacks a damage roll; wishlist:');
    expect(html).toContain('Exotic: perks are fixed');
    expect(html).toContain('data-arsslot="power"');
    expect(html).toContain('data-arsroll="toggle"');
    expect(html).toContain('id="ars-archetype"');
    expect(html).toContain('unranked tail');
  });

  it('renders the exclusion block on setpiece pages', () => {
    const oryx = findEncounter('kings-fall', 'oryx')!;
    const ranked = rankArsenal(rows, 'boss-burst', oryx.encounter);
    const html = arsenalTableHtml(
      ranked,
      DEFAULT_ARSENAL_FILTERS,
      '/common/destiny2_content/icons/',
      'Oryx'
    );
    expect(html).toContain('Excluded here');
    expect(html).toContain('Truth');
  });

  it('applies the filters to the rendered rows', () => {
    const ranked = rankArsenal(rows, 'boss-burst', null);
    const html = arsenalTableHtml(
      ranked,
      { slot: 'power', archetype: 'all', damageRollOnly: true },
      '/common/destiny2_content/icons/',
      'Raid boss burst'
    );
    expect(html).toContain('Cataphract GL3');
    expect(html).not.toContain('Commemoration');
  });
});

describe('the whole encounter page', () => {
  it('assembles answer, facts, alternatives, rotation, arsenal in order', () => {
    const e = ev('desert-perpetual', 'koregos');
    const html = resultPage(
      model({ target: { kind: 'encounter', activityId: 'desert-perpetual', encounterId: 'koregos' } }),
      e.verdict!,
      signedOut,
      { encounter: e, arsenalAuto: true }
    );
    const order = [
      html.indexOf('id="picker"'),
      html.indexOf('id="answer"'),
      html.indexOf('the rules the loadout is bent around'),
      html.indexOf('Other legal builds'),
      html.indexOf('The rotation'),
      html.indexOf('id="arsenal"'),
      html.indexOf('Next unlock')
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i], 'section ' + i).toBeGreaterThan(order[i - 1]);
    }
    expect(html).toContain('Koregos');
    expect(html).toContain('data-ecard="surrounded-hop"');
    // Sustained window, said in words on the subline.
    expect(html).toContain('80s windows');
    expect(html).toContain('sustained damage');
  });
});
