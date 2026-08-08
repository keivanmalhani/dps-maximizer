// Per-class notes from the final dev insight and the Aegis sheet. These are
// the sentences that decide the super half of the answer card.

import type { GuardianClass } from '../types';

export const CLASS_NOTES_SOURCE = 'Bungie dev insight 2026-06-04 + Aegis';

export interface SuperRecommendation {
  classType: GuardianClass;
  superName: string;
  /** The armor exotic the super recommendation is built around. */
  armorId: string;
  why: string;
  source: string;
  /** Honest statement of how solid the ranking behind this is. */
  confidence: 'tiered' | 'dev-insight' | 'support-role';
}

export const SUPER_RECOMMENDATIONS: SuperRecommendation[] = [
  {
    classType: 0,
    superName: 'Thundercrash',
    armorId: 'cuirass-of-the-falling-star',
    why: 'Cuirass Thundercrash is the premier low-effort damage super: fly in, hit, leave.',
    source: CLASS_NOTES_SOURCE,
    confidence: 'tiered'
  },
  {
    classType: 1,
    superName: 'Golden Gun',
    armorId: 'celestial-nighthawk',
    why: 'Celestial Nighthawk\'s one-shot Golden Gun, with Still Hunt riding the same treatment.',
    source: CLASS_NOTES_SOURCE,
    confidence: 'tiered'
  },
  {
    classType: 2,
    superName: 'Well of Radiance',
    armorId: 'sanguine-alchemy',
    why:
      'The Warlock is the support and economy class: Well, Lunafactions, Sanguine, Briarbinds. Its best contribution to a damage phase is making five other people hit harder while its own weapons do the rest. No verified tier exists for a Warlock burst super, and this page will not invent one.',
    source: CLASS_NOTES_SOURCE,
    confidence: 'support-role'
  }
];

export interface ClassNote {
  classType: GuardianClass | null; // null = applies to everyone
  note: string;
  source: string;
}

export const CLASS_NOTES: ClassNote[] = [
  {
    classType: 0,
    note:
      'Cuirass, Star-Eater and Synthoceps land within about 50 percent of each other on the sheet\'s super comparison, with the practical difference called negligible; Cuirass is the zero-effort one.',
    source: CLASS_NOTES_SOURCE
  },
  {
    classType: 1,
    note:
      'Shards of Galanor was reworked in 9.7.0: a 5-of-7-knife Blade Barrage now lands in the same neighbourhood as Cuirass Thundercrash for Solar burst.',
    source: CLASS_NOTES_SOURCE
  },
  {
    classType: 2,
    note:
      'The Warlock reads as the support and economy class in the final balance pass: Well, Lunafaction Boots, Sanguine Alchemy and Briarbinds are its tiered entries.',
    source: CLASS_NOTES_SOURCE
  },
  {
    classType: null,
    note:
      'Grapple melee was nerfed against bosses in 9.7.0: grenade and melee stat bonuses are now additive against bosses rather than multiplicative.',
    source: 'Bungie dev insight 2026-06-04'
  }
];
