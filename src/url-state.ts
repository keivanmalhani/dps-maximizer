// Deep links. The run target (a generic mode, or an activity + encounter)
// and the class live in the query string, so an encounter loadout is a URL
// somebody can send to their fireteam. Pure functions; the tests round-trip
// them without a browser.

import { ACTIVITY_BY_ID, findEncounter, firstDamageEncounter } from './data/encounters';
import type { Activity, GuardianClass } from './types';

export type RunTarget =
  | { kind: 'mode'; activity: Activity }
  | { kind: 'encounter'; activityId: string; encounterId: string };

export const DEFAULT_TARGET: RunTarget = { kind: 'mode', activity: 'boss-burst' };

const MODES: Activity[] = ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions', 'pvp'];

const CLASS_TOKENS: Record<string, GuardianClass> = {
  titan: 0,
  hunter: 1,
  warlock: 2
};

export function classToken(classType: GuardianClass): string {
  return classType === 0 ? 'titan' : classType === 1 ? 'hunter' : 'warlock';
}

export interface UrlState {
  target: RunTarget;
  /** null = the URL named no class; keep whatever the page already shows. */
  classType: GuardianClass | null;
}

/**
 * Read ?activity=&encounter=&class= into a run target. Anything unknown
 * falls back to the default, because a bad link must still paint a page.
 */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const classRaw = (params.get('class') ?? '').toLowerCase();
  const classType = classRaw in CLASS_TOKENS ? CLASS_TOKENS[classRaw] : null;

  const activityRaw = (params.get('activity') ?? '').toLowerCase();
  if (activityRaw === '') return { target: DEFAULT_TARGET, classType };

  if ((MODES as string[]).includes(activityRaw)) {
    return { target: { kind: 'mode', activity: activityRaw as Activity }, classType };
  }

  const activity = ACTIVITY_BY_ID.get(activityRaw);
  if (!activity) return { target: DEFAULT_TARGET, classType };

  const encounterRaw = (params.get('encounter') ?? '').toLowerCase();
  const hit = encounterRaw ? findEncounter(activity.id, encounterRaw) : null;
  const encounter = hit ? hit.encounter : firstDamageEncounter(activity);
  return {
    target: { kind: 'encounter', activityId: activity.id, encounterId: encounter.id },
    classType
  };
}

/** The query string for a state, always shareable, always parseable back. */
export function serializeUrlState(target: RunTarget, classType: GuardianClass): string {
  const params = new URLSearchParams();
  if (target.kind === 'mode') {
    params.set('activity', target.activity);
  } else {
    params.set('activity', target.activityId);
    params.set('encounter', target.encounterId);
  }
  params.set('class', classToken(classType));
  return '?' + params.toString();
}
