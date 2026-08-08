// The roll layer: instance sockets read against the curated damage-perk
// hashes, the wishlist for copies without one, and the encounter-aware
// ranking of everything the profile owns. The demo fixture's literal hashes
// are cross-checked against arsenal.json here, so the fixture can stay
// import-free without being able to drift.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDemoProfile, DEMO_ARSENAL_INSTANCES } from '../fixtures/demo';
import {
  applyFilters,
  damageRollOf,
  ownedArsenal,
  rankArsenal,
  wishlistFor,
  DEFAULT_ARSENAL_FILTERS,
  type ArsenalData
} from '../src/arsenal';
import { findEncounter } from '../src/data/encounters';

const arsenal = JSON.parse(
  readFileSync(new URL('../src/data/arsenal.json', import.meta.url), 'utf8')
) as ArsenalData;

const demo = buildDemoProfile();
const rows = ownedArsenal(arsenal, demo);
const byName = (name: string) => rows.find((r) => r.weapon.name === name);

describe('the demo fixture hashes are real manifest facts', () => {
  it('every fixture instance names a weapon arsenal.json actually carries', () => {
    const weaponByHash = new Map(arsenal.weapons.map((w) => [w.hash, w]));
    for (const entry of DEMO_ARSENAL_INSTANCES) {
      const weapon = weaponByHash.get(entry.itemHash);
      expect(weapon, entry.name).toBeTruthy();
      expect(weapon!.name, String(entry.itemHash)).toBe(entry.name);
    }
  });

  it('every fixture plug is poolable on its weapon, base or enhanced', () => {
    const weaponByHash = new Map(arsenal.weapons.map((w) => [w.hash, w]));
    for (const entry of DEMO_ARSENAL_INSTANCES) {
      const weapon = weaponByHash.get(entry.itemHash)!;
      const poolable = new Set<number>();
      for (const col of weapon.columns ?? []) for (const h of col.perks) poolable.add(h);
      for (const plug of entry.plugs) {
        expect(poolable.has(plug), entry.name + ' plug ' + plug).toBe(true);
      }
    }
  });
});

describe('damageRollOf and wishlistFor, the pure pair', () => {
  it('reads the Cataphract fixture roll: Envious Assassin + Bait and Switch', () => {
    const row = byName('Cataphract GL3')!;
    expect(row.rollPerks).toEqual(['Bait and Switch', 'Envious Assassin']);
  });

  it('reports the Commemoration copy as lacking a damage roll, with a wishlist', () => {
    const row = byName('Commemoration')!;
    expect(row.rollPerks).toEqual([]);
    expect(row.wishlist).toContain('Firing Line');
    expect(row.wishlist).toContain('Reconstruction');
  });

  it('the curated demo Apex Predator lacks a damage roll, per ITS version', () => {
    // The demo owns the original Last Wish hash (2545083870), whose baked
    // pools carry only Auto-Loading Holster from the damage-perk list; the
    // Edge of Fate reissue (1851777734) is the one that rolls Bait and
    // Switch. The wishlist is per owned version, never the union, because a
    // wishlist for a copy you do not own is a lie with extra steps.
    const row = byName('Apex Predator')!;
    expect(row.weapon.hash).toBe(2545083870);
    expect(row.rollPerks).toEqual([]);
    expect(row.wishlist).toEqual(['Auto-Loading Holster']);
    expect(row.tierLabel).toBe('Tier 3');
    expect(row.curatedId).toBe('apex-predator');
  });

  it('never reports a perk the weapon could not roll: roll is a subset of pools', () => {
    for (const weapon of arsenal.weapons) {
      if (!weapon.columns) continue;
      const poolable: number[] = [];
      for (const col of weapon.columns) poolable.push(...col.perks);
      const everything = damageRollOf(poolable, arsenal.damagePerks);
      const wishlist = wishlistFor(weapon, arsenal.damagePerks);
      expect(everything, weapon.name).toEqual(wishlist);
    }
  });

  it('an empty socket set has no roll, whatever the weapon', () => {
    expect(damageRollOf([], arsenal.damagePerks)).toEqual([]);
  });
});

describe('ownedArsenal over the demo profile', () => {
  it('sees the curated instances and the arsenal-only instances together', () => {
    for (const name of [
      'Apex Predator',
      'Gjallarhorn',
      'Thunderlord',
      'Cataphract GL3',
      'Commemoration',
      'Truth',
      'Sleeper Simulant'
    ]) {
      expect(byName(name), name).toBeTruthy();
    }
  });

  it('marks exotics as exotics so the roll layer can skip them honestly', () => {
    expect(byName('Truth')!.weapon.tierType).toBe(6);
    expect(byName('Gjallarhorn')!.weapon.tierType).toBe(6);
  });
});

describe('rankArsenal, mode ordering', () => {
  it('sustained context leads with machine guns: Thunderlord then Commemoration', () => {
    const koregos = findEncounter('desert-perpetual', 'koregos')!;
    const ranked = rankArsenal(rows, 'boss-sustained', koregos.encounter);
    const names = ranked.rows.map((r) => r.weapon.name);
    expect(names[0]).toBe('Thunderlord');
    expect(names.indexOf('Commemoration')).toBeLessThan(names.indexOf('Apex Predator'));
    expect(ranked.orderNote).toContain('machine guns, linear fusions, heavy snipers');
  });

  it('burst context leads with the sourced order: snipers and rockets up top', () => {
    const ranked = rankArsenal(rows, 'boss-burst', null);
    expect(ranked.orderNote).toContain('snipers, rockets, linear fusions, grenade launchers');
    const first = ranked.rows[0].weapon;
    expect(['Sniper Rifle', 'Rocket Launcher']).toContain(first.itemTypeDisplayName);
  });

  it('flags the archetypes outside the sourced order instead of ranking them', () => {
    const ranked = rankArsenal(rows, 'boss-burst', null);
    const outbreak = ranked.rows.find((r) => r.weapon.name === 'Outbreak Perfected')!;
    expect(outbreak.archetypeSourced).toBe(false);
  });
});

describe('rankArsenal, encounter rules', () => {
  it('Oryx excludes the intrinsic trackers: the demo Truth sits out, named', () => {
    const oryx = findEncounter('kings-fall', 'oryx')!;
    const ranked = rankArsenal(rows, 'boss-burst', oryx.encounter);
    expect(ranked.rows.some((r) => r.weapon.name === 'Truth')).toBe(false);
    const excluded = ranked.excluded.find((x) => x.row.weapon.name === 'Truth')!;
    expect(excluded.flag.ruleId).toBe('setpiece');
    // Gjallarhorn is not Truth-class and stays in.
    expect(ranked.rows.some((r) => r.weapon.name === 'Gjallarhorn')).toBe(true);
  });

  it('Morgeth demotes snipers and names Sleeper specifically', () => {
    const morgeth = findEncounter('last-wish', 'morgeth')!;
    const ranked = rankArsenal(rows, 'boss-burst', morgeth.encounter);
    const sleeper = ranked.rows.find((r) => r.weapon.name === 'Sleeper Simulant')!;
    expect(sleeper.flags.some((f) => f.ruleId === 'sniper-dr' && f.text.includes('40 percent'))).toBe(true);
    const praedyth = ranked.rows.find((r) => r.weapon.name === "Praedyth's Revenge")!;
    expect(praedyth.flags.some((f) => f.ruleId === 'sniper-dr')).toBe(true);
    // Demoted rows sink below the un-flagged ones.
    const names = ranked.rows.map((r) => r.weapon.name);
    expect(names.indexOf('Apex Predator')).toBeLessThan(names.indexOf('Sleeper Simulant'));
  });

  it('far-range encounters exclude swords and glaives from the table', () => {
    const witness = findEncounter('salvations-edge', 'witness')!;
    const ranked = rankArsenal(rows, 'boss-burst', witness.encounter);
    expect(ranked.rows.some((r) => r.weapon.itemTypeDisplayName === 'Sword')).toBe(false);
    const ergo = ranked.excluded.find((x) => x.row.weapon.name === 'Ergo Sum');
    expect(ergo).toBeTruthy();
  });

  it('Crota promotes the sword to the top of the table', () => {
    const crota = findEncounter('crotas-end', 'crota')!;
    const ranked = rankArsenal(rows, 'boss-burst', crota.encounter);
    expect(ranked.rows[0].weapon.itemTypeDisplayName).toBe('Sword');
    expect(ranked.rows[0].flags.some((f) => f.ruleId === 'sword-bonus')).toBe(true);
  });

  it('proxy targets demote crit archetypes in the table too', () => {
    const zoetic = findEncounter('sundered-doctrine', 'zoetic-lockset')!;
    const ranked = rankArsenal(rows, 'boss-sustained', zoetic.encounter);
    const names = ranked.rows.map((r) => r.weapon.name);
    expect(names.indexOf('Thunderlord')).toBeLessThan(names.indexOf('Sleeper Simulant'));
    const sleeper = ranked.rows.find((r) => r.weapon.name === 'Sleeper Simulant')!;
    expect(sleeper.flags.some((f) => f.ruleId === 'proxy')).toBe(true);
  });
});

describe('the household filters', () => {
  const ranked = rankArsenal(rows, 'boss-burst', null);

  it('slot filter keeps only that slot', () => {
    const power = applyFilters(ranked.rows, { ...DEFAULT_ARSENAL_FILTERS, slot: 'power' });
    expect(power.length).toBeGreaterThan(0);
    for (const row of power) expect(row.weapon.slot).toBe('power');
  });

  it('archetype filter keeps only that archetype', () => {
    const rockets = applyFilters(ranked.rows, { ...DEFAULT_ARSENAL_FILTERS, archetype: 'rocket' });
    expect(rockets.length).toBeGreaterThan(0);
    for (const row of rockets) expect(row.weapon.archetype).toBe('rocket');
  });

  it('the damage-roll chip keeps exactly the copies with a real roll', () => {
    const withRoll = applyFilters(ranked.rows, {
      ...DEFAULT_ARSENAL_FILTERS,
      damageRollOnly: true
    });
    expect(withRoll.map((r) => r.weapon.name)).toEqual(['Cataphract GL3']);
  });
});
