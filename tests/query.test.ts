// The arsenal search language. Every operator here is a promise made to
// somebody typing into a box, so every operator gets a test.

import { describe, expect, it } from 'vitest';
import {
  dimSearchFor,
  parseQuery,
  QUERY_EXAMPLES,
  QUERY_KEYS,
  runQuery
} from '../src/query';
import type { RankedArsenalRow } from '../src/arsenal';

function row(over: Partial<RankedArsenalRow> & { name: string }): RankedArsenalRow {
  const { name, ...rest } = over;
  return {
    weapon: {
      hash: 1,
      name,
      icon: '',
      tierType: 5,
      slot: 'power',
      damageType: 1,
      ammoType: 3,
      itemTypeDisplayName: 'Rocket Launcher',
      archetype: 'rocket',
      frame: 'Adaptive Frame',
      ...(over.weapon ?? {})
    },
    instanceCount: 1,
    rollPerks: [],
    wishlist: [],
    tierLabel: null,
    curatedId: null,
    flags: [],
    archetypeSourced: true,
    ...rest
  } as RankedArsenalRow;
}

const VAULT: RankedArsenalRow[] = [
  row({ name: 'Apex Predator', rollPerks: ['Bait and Switch'], tierLabel: 'Tier 3', instanceCount: 2 }),
  row({ name: 'Ergo Sum', weapon: { hash: 2, name: 'Ergo Sum', icon: '', tierType: 6, slot: 'energy', damageType: 1, ammoType: 2, itemTypeDisplayName: 'Sword', archetype: 'sword', frame: null }, tierLabel: 'Tier 1' }),
  row({ name: 'Commemoration', weapon: { hash: 3, name: 'Commemoration', icon: '', tierType: 5, slot: 'power', damageType: 1, ammoType: 3, itemTypeDisplayName: 'Machine Gun', archetype: 'machine-gun', frame: 'Adaptive Frame' }, wishlist: ['Reconstruction'], archetypeSourced: false }),
  row({ name: "Praedyth's Revenge", weapon: { hash: 4, name: "Praedyth's Revenge", icon: '', tierType: 5, slot: 'kinetic', damageType: 1, ammoType: 2, itemTypeDisplayName: 'Sniper Rifle', archetype: 'sniper', frame: 'Rapid-Fire Frame' }, tierLabel: 'Tier 2', flags: [{ ruleId: 'sniper-dr', text: 'demoted' }] })
];

const names = (q: string) => runQuery(VAULT, q).rows.map((r) => r.weapon.name).sort();

describe('the empty and broken cases', () => {
  it('a blank query returns everything and says so', () => {
    const r = runQuery(VAULT, '   ');
    expect(r.rows).toHaveLength(4);
    expect(r.empty).toBe(true);
    expect(r.error).toBeNull();
  });

  it('a broken query keeps the rows on screen and reports the fault', () => {
    const r = runQuery(VAULT, 'is:power )');
    expect(r.error).not.toBeNull();
    expect(r.rows).toHaveLength(4);
  });

  it('an unterminated quote still searches instead of erroring', () => {
    expect(names('perk:"bait and switch')).toEqual(['Apex Predator']);
  });

  it('an unknown is: value matches nothing, never everything', () => {
    expect(names('is:banana')).toEqual([]);
  });
});

describe('free text', () => {
  it('matches the name', () => expect(names('ergo')).toEqual(['Ergo Sum']));
  it('two bare words are ANDed, not treated as one phrase', () =>
    expect(names('machine gun')).toEqual(['Commemoration']));
  it('matches a single word of the type label', () => expect(names('machine')).toEqual(['Commemoration']));
  it('is case insensitive', () => expect(names('ERGO')).toEqual(['Ergo Sum']));
  it('quoted phrases match across words', () => expect(names('"machine gun"')).toEqual(['Commemoration']));
});

describe('the keys', () => {
  it('is:power', () => expect(names('is:power')).toEqual(['Apex Predator', 'Commemoration']));
  it('is:exotic', () => expect(names('is:exotic')).toEqual(['Ergo Sum']));
  it('is:legendary', () => expect(names('is:legendary').length).toBe(3));
  it('is:tiered and is:untiered partition the vault', () => {
    expect(names('is:tiered').length + names('is:untiered').length).toBe(VAULT.length);
  });
  it('is:roll and is:noroll', () => {
    expect(names('is:roll')).toEqual(['Apex Predator']);
    expect(names('is:noroll').length).toBe(3);
  });
  it('is:dupe', () => expect(names('is:dupe')).toEqual(['Apex Predator']));
  it('is:flagged', () => expect(names('is:flagged')).toEqual(["Praedyth's Revenge"]));
  it('is:unsourced', () => expect(names('is:unsourced')).toEqual(['Commemoration']));
  it('slot:', () => expect(names('slot:kinetic')).toEqual(["Praedyth's Revenge"]));
  it('type: matches archetype or type label', () => {
    expect(names('type:sniper')).toEqual(["Praedyth's Revenge"]);
    expect(names('type:sword')).toEqual(['Ergo Sum']);
  });
  it('frame:', () => expect(names('frame:rapid')).toEqual(["Praedyth's Revenge"]));
  it('perk: reads YOUR roll', () => expect(names('perk:"bait and switch"')).toEqual(['Apex Predator']));
  it('wish: reads the wishlist', () => expect(names('wish:reconstruction')).toEqual(['Commemoration']));
  it('name: matches the name only, not the type', () => {
    expect(names('name:machine')).toEqual([]);
    expect(names('name:commemoration')).toEqual(['Commemoration']);
  });
  it('tier: exact and comparison', () => {
    expect(names('tier:1')).toEqual(['Ergo Sum']);
    expect(names('tier:<=2')).toEqual(['Ergo Sum', "Praedyth's Revenge"]);
  });
  it('count: comparison', () => expect(names('count:>1')).toEqual(['Apex Predator']));
  it('an untiered row never satisfies a tier comparison', () => {
    expect(names('tier:>0')).not.toContain('Commemoration');
  });
});

describe('the operators', () => {
  it('adjacent terms are AND', () => expect(names('is:power is:roll')).toEqual(['Apex Predator']));
  it('explicit and', () => expect(names('is:power and is:roll')).toEqual(['Apex Predator']));
  it('or', () => expect(names('is:exotic or is:dupe')).toEqual(['Apex Predator', 'Ergo Sum']));
  it('not', () => expect(names('is:power not is:roll')).toEqual(['Commemoration']));
  it('leading dash negates a single term', () => expect(names('is:power -is:roll')).toEqual(['Commemoration']));
  it('parentheses group', () => {
    expect(names('(is:exotic or is:dupe) is:power')).toEqual(['Apex Predator']);
  });
  it('or binds looser than and', () => {
    expect(names('is:power is:roll or is:exotic')).toEqual(['Apex Predator', 'Ergo Sum']);
  });
  it('a quoted operator word is a search term, not an operator', () => {
    // Unquoted, a dangling `or` is a parse error. Quoted, it is free text,
    // so it matches every row containing those two letters anywhere. The
    // expectation is computed rather than typed, because "which words happen
    // to contain o-r" is not the thing under test.
    expect(parseQuery('is:power or').ok).toBe(false);
    const r = runQuery(VAULT, '"or"');
    expect(r.error).toBeNull();
    const expected = VAULT.filter((x) =>
      [x.weapon.name, x.weapon.itemTypeDisplayName, x.weapon.archetype, x.weapon.frame ?? '', x.tierLabel ?? '']
        .join(' ')
        .toLowerCase()
        .includes('or')
    ).map((x) => x.weapon.name).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(r.rows.map((x) => x.weapon.name).sort()).toEqual(expected);
  });
});

describe('the parser reports where it broke', () => {
  it('unclosed paren', () => {
    const { ok, error } = parseQuery('(is:power');
    expect(ok).toBe(false);
    expect(error!.message).toContain('Unclosed');
  });
  it('dangling or', () => expect(parseQuery('is:power or').ok).toBe(false));
  it('dangling not', () => expect(parseQuery('not').ok).toBe(false));
  it('a good query parses', () => expect(parseQuery('is:power -type:sword').ok).toBe(true));
});

describe('the documented examples all work', () => {
  it('every example query parses', () => {
    for (const ex of QUERY_EXAMPLES) {
      expect(parseQuery(ex.query).ok, ex.query).toBe(true);
    }
  });
  it('every key in the hint is a key the engine handles', () => {
    for (const { key } of QUERY_KEYS) {
      const probe = key + 'x';
      // A handled key never falls through to the free-text branch, which is
      // the only branch that would match the literal "key:x" string.
      expect(runQuery(VAULT, probe).error).toBeNull();
    }
    expect(QUERY_KEYS.length).toBeGreaterThan(5);
  });
});

describe('the DIM handoff', () => {
  it('quotes each name and joins with or', () => {
    expect(dimSearchFor(['Ergo Sum', 'Apex Predator'])).toBe('"Ergo Sum" or "Apex Predator"');
  });
  it('drops blanks and duplicates', () => {
    expect(dimSearchFor(['Ergo Sum', '', 'Ergo Sum'])).toBe('"Ergo Sum"');
  });
  it('is empty when there is nothing to hand over', () => {
    expect(dimSearchFor([])).toBe('');
  });
  it('strips quotes out of a name so the query cannot break', () => {
    expect(dimSearchFor(['A "quoted" gun'])).toBe('"A quoted gun"');
  });
});
