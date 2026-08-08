// The buff and debuff arithmetic, which is the tribal knowledge this site
// exists to replace. The framework (four multiplicative buckets) has been
// stable for years. The specific percentages quoted here are the ones
// verified current via Aegis; the general percentage table is pending Court's
// June-2026 transcription, and where a number is not listed the honest answer
// is "pending", not a guess.

export const BUFFS_SOURCE = 'Aegis FAQ; framework long-stable';
export const PENDING_NOTE =
  'The general percentage table is pending Court\'s June-2026 transcription. Numbers not shown here are pending, not zero.';

export interface BuffBucket {
  id: string;
  title: string;
  rule: string;
  detail: string;
  examples: string[];
}

export const BUCKETS: BuffBucket[] = [
  {
    id: 'empowering',
    title: '1. Empowering buffs',
    rule: 'Do not stack. Highest wins.',
    detail:
      'Well of Radiance, Radiant and Lumina\'s Noble Rounds (35 percent, verified) all live in this bucket, so running two of them buys nothing. The one exception in the game: No Hesitation\'s 10 percent (verified) is universally stackable and sits on top of whatever else is running.',
    examples: [
      'Well + Radiant: you get the better of the two, not both.',
      'Lumina 35% + Well: you get Lumina\'s 35%.',
      'No Hesitation 10% + anything: stacks. The exception, and the reason it is tiered.'
    ]
  },
  {
    id: 'surges',
    title: '2. Weapon surges',
    rule: 'Do not stack within an element. Highest wins.',
    detail:
      'Armor surge mods of the same element take the strongest, not the sum. Percentages per mod count: pending transcription.',
    examples: ['Two solar surges on your legs: you get the better one\'s effect, not double.']
  },
  {
    id: 'perks',
    title: '3. Weapon perks',
    rule: 'Stack multiplicatively with everything.',
    detail:
      'Bait and Switch, Vorpal Weapon and friends multiply with your empowering buff, your surge and the debuff on the target. This is why the roll on the gun matters as much as the gun.',
    examples: ['Bait and Switch armed inside a Well against a Tractored boss: all three multiply.']
  },
  {
    id: 'debuffs',
    title: '4. Debuffs',
    rule: 'One per enemy. Highest wins. Multiplies with your buffs.',
    detail:
      'Tractor Cannon\'s 30 percent (verified) is the easiest long-term source. A second debuff on the same target is wasted; a debuff plus your own buffs is the whole game.',
    examples: ['Tractor 30% + Well + Bait and Switch: one from each bucket, all multiplying.']
  }
];

export interface WarningCard {
  id: string;
  title: string;
  body: string;
  source: string;
}

/** Verified oddities worth a card of their own. */
export const ODDITIES: WarningCard[] = [
  {
    id: 'well-overrides-golden-gun',
    title: 'Well overrides Radiant for Golden Gun',
    body:
      'Verified: standing in a Well of Radiance replaces Radiant on your Golden Gun and the result is LESS damage than Radiant alone would have given it. Stand outside the Well for the shot. Kinetic surges no longer stack with Golden Gun either.',
    source: BUFFS_SOURCE
  },
  {
    id: 'debuff-refresh',
    title: 'Keeping the 30 percent up',
    body:
      'Tractor Cannon\'s and Felwinter\'s 30 percent weaken can be extended by timer-based weakens like Echo of Undermining or Snare Bomb refreshing the clock. It does NOT work with Tether: Tether is its own debuff, not a timer refresh.',
    source: BUFFS_SOURCE
  }
];

/** Myths the community still repeats, debunked with the testing that did it. */
export const MYTHS: WarningCard[] = [
  {
    id: 'frontload',
    title: 'Myth: bosses take more damage early in the health bar',
    body:
      'Verified false. Health bars are uniform; this was tested across every raid and dungeon boss. Damage falling off late in a phase is your buffs and ammo running out, not the boss armoring up.',
    source: BUFFS_SOURCE
  },
  {
    id: 'fps',
    title: 'Myth: higher FPS means higher damage',
    body: 'Verified false. Frame rate does not affect weapon damage.',
    source: BUFFS_SOURCE
  }
];
