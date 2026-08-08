// Rotation knowledge, as data. The engine assembles the numbered steps a
// loadout actually requires out of these pieces; nothing here is a number we
// made up, and where the community record is genuinely contested the entry
// says so instead of picking a side.

export const ROTATION_SOURCE = 'Aegis FAQ';

export interface RotationFact {
  id: string;
  title: string;
  /** Numbered steps, plain words. */
  steps: string[];
  /** Caveats that must travel with the steps wherever they appear. */
  caveats: string[];
  source: string;
}

/**
 * Bait and Switch, in the words a player needs and none they do not.
 * Timings are the FAQ's; the contested point is flagged as contested.
 */
export const BAIT_AND_SWITCH: RotationFact = {
  id: 'bait-and-switch',
  title: 'Bait and Switch',
  steps: [
    'Hit the target once with each of your three weapons. That is the whole trick.',
    'You have about 7 seconds between one weapon\'s hit and the next, about 14 seconds end to end.',
    'The third hit arms a large damage bonus on the Bait and Switch weapon. Dump into the boss.',
    'Armed is stored: you can hold the buff indefinitely and fire when the damage phase starts.'
  ],
  caveats: [
    'You cannot bank slack between the first two hits: being quick from weapon one to weapon two does not buy extra time to weapon three.',
    'Whether the shot that activates the buff benefits from it is contested in community testing; this page does not pick a side. Fire the activating shot, then treat the next shots as the buffed ones.'
  ],
  source: ROTATION_SOURCE
};

export const ENVIOUS_LOOP: RotationFact = {
  id: 'envious-loop',
  title: 'The Envious loop',
  steps: [
    'Envious perks overflow the magazine from kills and hits scored while the weapon is stowed.',
    'Fire your filler weapon at the boss, let the Envious weapon grow its magazine, then swap and dump.',
    'Repeat: filler shot, swap, dump. The Envious weapon rarely needs a manual reload.'
  ],
  caveats: [
    'Good fillers: Witherhoard, Ice Breaker, Conditional Finality.',
    'Parasite gained Envious Arsenal in the 9.7.0 catalyst pass (Bungie dev insight 2026-05-29).'
  ],
  source: ROTATION_SOURCE
};

/**
 * Two weapons versus three. The FAQ's own measurement, and the honest
 * recommendation that follows from it for most players.
 */
export const TWO_VS_THREE: RotationFact = {
  id: 'two-vs-three',
  title: 'Two weapons or three',
  steps: [
    'The classic three-weapon rotation (Izanagi\'s Burden, a slug or sniper, an Apex-style rocket) exists, and it is the ceiling.',
    'Dropping the third weapon costs about 4 percent damage.',
    'Run the two-weapon version unless you already have the three-weapon muscle memory: 4 percent is less than what a single fumbled swap costs you.'
  ],
  caveats: [],
  source: ROTATION_SOURCE
};

export interface SwapExotic {
  name: string;
  /** Measured rocket reload-cancel time, seconds. */
  seconds: number;
  className: 'Warlock' | 'Hunter';
}

/**
 * Swap-speed exotics for rocket reload-cancelling, fastest first. The
 * measurements are the FAQ's. Note the class locks: two of the three are
 * Hunter armor and one is Warlock armor; a Titan generally wears Cuirass for
 * the super instead, and the page says so rather than hiding the gap.
 */
export const SWAP_EXOTICS: SwapExotic[] = [
  { name: 'Rain of Fire', seconds: 2.366, className: 'Warlock' },
  { name: "Dragon's Shadow", seconds: 2.383, className: 'Hunter' },
  { name: 'Radiant Dance Machines', seconds: 2.732, className: 'Hunter' }
];

export const SWAP_EXOTICS_SOURCE = ROTATION_SOURCE;
