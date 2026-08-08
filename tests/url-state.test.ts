// Deep links: the run target and class round-trip through the query string
// for every encounter in the catalog, and garbage never breaks first paint.

import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/data/encounters';
import {
  classToken,
  DEFAULT_TARGET,
  parseUrlState,
  serializeUrlState,
  type RunTarget
} from '../src/url-state';
import type { GuardianClass } from '../src/types';

describe('round trips', () => {
  it('every encounter x every class survives serialize -> parse', () => {
    for (const activity of ACTIVITIES) {
      for (const encounter of activity.encounters) {
        for (const classType of [0, 1, 2] as GuardianClass[]) {
          const target: RunTarget = {
            kind: 'encounter',
            activityId: activity.id,
            encounterId: encounter.id
          };
          const search = serializeUrlState(target, classType);
          const parsed = parseUrlState(search);
          expect(parsed.target, search).toEqual(target);
          expect(parsed.classType, search).toBe(classType);
        }
      }
    }
  });

  it('every generic mode survives the trip', () => {
    for (const mode of ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions', 'pvp'] as const) {
      const search = serializeUrlState({ kind: 'mode', activity: mode }, 1);
      const parsed = parseUrlState(search);
      expect(parsed.target).toEqual({ kind: 'mode', activity: mode });
      expect(parsed.classType).toBe(1);
    }
  });

  it('the class tokens are the class names, not magic numbers', () => {
    expect(classToken(0)).toBe('titan');
    expect(classToken(1)).toBe('hunter');
    expect(classToken(2)).toBe('warlock');
    expect(serializeUrlState(DEFAULT_TARGET, 2)).toContain('class=warlock');
  });
});

describe('hostile and partial links fall back honestly', () => {
  it('garbage falls back to the default target and no class opinion', () => {
    for (const search of ['', '?', '?activity=', '?activity=nope', '?activity=<script>', '?x=1']) {
      const parsed = parseUrlState(search);
      expect(parsed.target, search).toEqual(DEFAULT_TARGET);
    }
    expect(parseUrlState('?activity=nope&class=dragon').classType).toBeNull();
  });

  it('an activity without an encounter lands on its first damage check', () => {
    const parsed = parseUrlState('?activity=vault-of-glass');
    expect(parsed.target).toEqual({
      kind: 'encounter',
      activityId: 'vault-of-glass',
      encounterId: 'templar'
    });
  });

  it('a wrong encounter inside a real activity lands on the first damage check', () => {
    const parsed = parseUrlState('?activity=vault-of-glass&encounter=atheon-typo');
    expect(parsed.target).toEqual({
      kind: 'encounter',
      activityId: 'vault-of-glass',
      encounterId: 'templar'
    });
  });

  it('the flagship link works exactly as shipped', () => {
    const parsed = parseUrlState('?activity=vault-of-glass&encounter=templar&class=titan');
    expect(parsed.target).toEqual({
      kind: 'encounter',
      activityId: 'vault-of-glass',
      encounterId: 'templar'
    });
    expect(parsed.classType).toBe(0);
  });
});
