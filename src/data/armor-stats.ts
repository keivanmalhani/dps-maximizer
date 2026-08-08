// Armor 3.0 stats, scale 1 to 200. The endpoints below are the published
// ones; the curve between a stat's floor and its ceiling is Bungie's, and this
// page shows your stat out of 200 next to the ceiling rather than pretending
// to know the exact percent at every intermediate value.

import type { StatName } from '../types';

export const ARMOR_STATS_SOURCE = 'Bungie/PC Gamer 2025-07-14';

export interface StatEffect {
  stat: StatName;
  /** What the stat does for damage, endpoints only. */
  effect: string;
  /** True when this stat contributes to the damage this site optimises. */
  damageStat: boolean;
}

export const STAT_EFFECTS: StatEffect[] = [
  { stat: 'Weapons', effect: '0 to 15% weapon damage against majors at 200', damageStat: true },
  { stat: 'Grenade', effect: 'up to +65% grenade damage at 200', damageStat: true },
  { stat: 'Super', effect: 'up to +45% super damage at 200', damageStat: true },
  { stat: 'Melee', effect: 'up to +30% melee damage at 200', damageStat: true },
  { stat: 'Health', effect: 'survivability, not damage', damageStat: false },
  { stat: 'Class', effect: 'class ability economy, not damage directly', damageStat: false }
];

export const POWERHOUSE_NOTE =
  'For a damage build, gear toward the Powerhouse archetype (Weapons and Super): those are the two stats that multiply what this page recommends.';
