// The rotation builder: what each loadout requires of you, with the FAQ's
// timings kept exact and the contested point kept contested.

import { describe, expect, it } from 'vitest';
import { PERK_HASHES } from '../src/data/items';
import { BAIT_AND_SWITCH, ENVIOUS_LOOP, SWAP_EXOTICS, TWO_VS_THREE } from '../src/data/rotations';
import { recommend } from '../src/recommend';
import { ownsEverything, player } from './helpers';

function rotationFor(
  ids: Parameters<typeof player>[0],
  classType: 0 | 1 | 2,
  activity: 'boss-burst' | 'boss-sustained' | 'add-clear' | 'master-champions'
) {
  return recommend(player(ids), classType, activity).rotation;
}

describe('the Bait and Switch plan', () => {
  const withHezen = () => rotationFor(['hezen-vengeance'], 0, 'boss-burst')!;

  it('fires when the power pick wants Bait and Switch', () => {
    expect(withHezen().title).toBe('Bait and Switch with Hezen Vengeance');
  });

  it('keeps the timings the FAQ measured', () => {
    const steps = withHezen().steps.join(' ');
    expect(steps).toContain('7 seconds');
    expect(steps).toContain('14 seconds');
  });

  it('says the armed buff stores indefinitely', () => {
    expect(withHezen().steps.join(' ')).toContain('indefinitely');
  });

  it('says you cannot bank slack between the first two hits', () => {
    expect(withHezen().caveats.join(' ')).toContain('cannot bank slack');
  });

  it('keeps the activating-shot question contested instead of picking a side', () => {
    const caveats = withHezen().caveats.join(' ');
    expect(caveats).toContain('contested');
    expect(caveats).toContain('does not pick a side');
  });

  it('tells a Hezen owner without Gjallarhorn that one teammate should bring it', () => {
    const caveats = withHezen().caveats.join(' ');
    expect(caveats).toContain('one teammate should bring it');
    expect(caveats).toContain('25 to 30 percent');
  });

  it('tells a Gjallarhorn owner to hand it to ONE teammate', () => {
    const rotation = rotationFor(['hezen-vengeance', 'gjallarhorn'], 0, 'boss-burst')!;
    expect(rotation.caveats.join(' ')).toContain('hand it to ONE teammate');
  });

  it('cites the FAQ', () => {
    expect(withHezen().source).toBe('Aegis FAQ');
  });
});

describe('swap-speed exotics, class filtered', () => {
  it('a Warlock is offered Rain of Fire with its measured time', () => {
    const rotation = rotationFor(['hezen-vengeance'], 2, 'boss-burst')!;
    const caveats = rotation.caveats.join(' ');
    expect(caveats).toContain('Rain of Fire');
    expect(caveats).toContain('2.366');
  });

  it('a Hunter is offered Dragon\'s Shadow and Radiant Dance Machines', () => {
    const rotation = rotationFor(['hezen-vengeance'], 1, 'boss-burst')!;
    const caveats = rotation.caveats.join(' ');
    expect(caveats).toContain("Dragon's Shadow");
    expect(caveats).toContain('Radiant Dance Machines');
    expect(caveats).toContain('2.383');
    expect(caveats).toContain('2.732');
  });

  it('a Titan is told the swap exotics belong to other classes', () => {
    const rotation = rotationFor(['hezen-vengeance'], 0, 'boss-burst')!;
    const caveats = rotation.caveats.join(' ');
    expect(caveats).toContain('Warlock and Hunter armor');
    expect(caveats).toContain('keeps its damage exotic');
  });

  it('the measured order is fastest first in the data', () => {
    expect(SWAP_EXOTICS.map((s) => s.name)).toEqual([
      'Rain of Fire',
      "Dragon's Shadow",
      'Radiant Dance Machines'
    ]);
    expect(SWAP_EXOTICS[0].seconds).toBeLessThan(SWAP_EXOTICS[1].seconds);
    expect(SWAP_EXOTICS[1].seconds).toBeLessThan(SWAP_EXOTICS[2].seconds);
  });
});

describe('the Izanagi two-or-three plan', () => {
  it('fires when Izanagi anchors the kinetic slot', () => {
    const rotation = rotationFor(['izanagis-burden', 'thunderlord'], 0, 'boss-sustained')!;
    expect(rotation.title).toBe(TWO_VS_THREE.title);
  });

  it('quotes the measured 4 percent and recommends the simpler rotation', () => {
    const steps = TWO_VS_THREE.steps.join(' ');
    expect(steps).toContain('about 4 percent');
    expect(steps).toContain('Run the two-weapon version');
  });
});

describe('the Envious loop', () => {
  it('fires when Witherhoard anchors the kinetic slot', () => {
    const rotation = rotationFor(['witherhoard', 'thunderlord'], 0, 'boss-sustained')!;
    expect(rotation.title).toBe(ENVIOUS_LOOP.title);
  });

  it('names the good fillers', () => {
    const caveats = ENVIOUS_LOOP.caveats.join(' ');
    expect(caveats).toContain('Witherhoard');
    expect(caveats).toContain('Ice Breaker');
    expect(caveats).toContain('Conditional Finality');
  });

  it('records the Parasite catalyst change with its dev insight source', () => {
    const caveats = ENVIOUS_LOOP.caveats.join(' ');
    expect(caveats).toContain('Parasite');
    expect(caveats).toContain('Envious Arsenal');
    expect(caveats).toContain('2026-05-29');
  });
});

describe('other modes', () => {
  it('sustained without a special anchor gets the plain pressure plan', () => {
    const rotation = rotationFor(['the-queenbreaker', 'praedyths-revenge'], 0, 'boss-sustained')!;
    expect(rotation.title).toContain('The Queenbreaker');
    expect(rotation.steps.join(' ')).toContain('crit spot');
  });

  it('add clear says plainly that it is not a rotation', () => {
    const rotation = rotationFor(['thunderlord', 'witherhoard'], 0, 'add-clear')!;
    expect(rotation.title).toBe('Add clear is not a rotation');
    expect(rotation.caveats.join(' ')).toContain('thinner than its boss advice');
  });

  it('burst without Bait and Switch gets the generic dump plan', () => {
    const rotation = rotationFor(['one-thousand-voices'], 0, 'boss-burst')!;
    expect(rotation.title).toContain('One Thousand Voices');
  });

  it('master mode with Hezen still teaches the Bait and Switch plan', () => {
    const rotation = recommend(ownsEverything(), 0, 'master-champions').rotation!;
    expect(rotation.title).toContain('Bait and Switch');
  });
});

describe('the rotation facts themselves', () => {
  it('Bait and Switch steps are numbered work, not vibes', () => {
    expect(BAIT_AND_SWITCH.steps.length).toBeGreaterThanOrEqual(3);
    expect(BAIT_AND_SWITCH.steps[0]).toContain('each of your three weapons');
  });

  it('the perks the plans reference resolve to real plug hashes', () => {
    expect(PERK_HASHES['Bait and Switch'].length).toBeGreaterThan(0);
    expect(PERK_HASHES['Envious Assassin'].length).toBeGreaterThan(0);
    expect(PERK_HASHES['Envious Arsenal'].length).toBeGreaterThan(0);
  });
});
