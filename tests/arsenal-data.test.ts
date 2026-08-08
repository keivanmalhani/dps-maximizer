// arsenal.json is generated from the live manifest by
// scripts/build-arsenal.mjs and committed. These tests are the drift alarm
// for the WHOLE damage arsenal the way items-data.test.ts is for the curated
// list: if the bake, the curated bake and this file ever disagree, CI fails
// instead of the site quietly forgetting a weapon or a roll.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ICON_PREFIX } from '../scripts/lib/arsenal-lib.mjs';
import { BAKED_ITEMS, MANIFEST_VERSION, PERK_HASHES } from '../src/data/items';
import { WANTED_PERK_NAMES } from '../src/data/tiers';

interface ArsenalColumn {
  i: number;
  kind: string;
  perks: number[];
}

interface ArsenalWeapon {
  hash: number;
  name: string;
  icon: string;
  tierType: number;
  slot: string;
  damageType: number;
  ammoType: number;
  itemTypeDisplayName: string;
  archetype: string;
  frame: string | null;
  classType?: number;
  collectibleHash?: number;
  columns?: ArsenalColumn[];
}

interface Arsenal {
  manifestVersion: string;
  generated: string;
  note: string;
  meta: Record<string, unknown> & {
    iconPrefix: string;
    rolls: string;
    sunset: string;
    counts: Array<{ archetype: string; legendary: number; exotic: number }>;
  };
  damagePerks: Record<string, { hashes: number[]; note: string; source: string }>;
  perkNames: Record<string, string>;
  weapons: ArsenalWeapon[];
}

const rawText = readFileSync(new URL('../src/data/arsenal.json', import.meta.url), 'utf8');
const arsenal = JSON.parse(rawText) as Arsenal;

const legendaries = arsenal.weapons.filter((w) => w.tierType === 5);
const exotics = arsenal.weapons.filter((w) => w.tierType === 6);

/** Every perk hash any legendary can actually roll, per the bake. */
const pooled = new Set<number>();
for (const w of legendaries) {
  for (const col of w.columns ?? []) for (const h of col.perks) pooled.add(h);
}

const byName = new Map<string, ArsenalWeapon[]>();
for (const w of arsenal.weapons) {
  const list = byName.get(w.name) ?? [];
  list.push(w);
  byName.set(w.name, list);
}
const unionPool = (name: string): Set<number> => {
  const set = new Set<number>();
  for (const w of byName.get(name) ?? []) {
    for (const col of w.columns ?? []) for (const h of col.perks) set.add(h);
  }
  return set;
};

/** The curated damage-perk list, in the manifest's own spelling. */
const DAMAGE_PERK_NAMES = [
  'Auto-Loading Holster',
  'Bait and Switch',
  'Bipod',
  'Cascade Point',
  'Chain Reaction',
  'Clown Cartridge',
  'Desperate Measures',
  'Envious Arsenal',
  'Envious Assassin',
  'Explosive Light',
  'Field Prep',
  'Firing Line',
  'Focused Fury',
  "Fourth Time's the Charm",
  'Frenzy',
  'High-Impact Reserves',
  'Kinetic Tremors',
  // The manifest spells it lowercase-f "One for All"; the bake fails loudly
  // if asked for "One For All", which is how the spelling got here.
  'One for All',
  'Precision Instrument',
  'Reconstruction',
  'Surrounded',
  'Triple Tap',
  'Vorpal Weapon'
];

describe('the arsenal bake as a whole', () => {
  it('was generated from the same frozen manifest as items.json', () => {
    expect(arsenal.manifestVersion).toBe(MANIFEST_VERSION);
  });

  it('stays inside the 600 KB raw budget so the site can lazy-load it', () => {
    expect(Buffer.byteLength(rawText)).toBeLessThan(600 * 1024);
  });

  it('is pure ASCII, like everything else in this repository', () => {
    expect(/^[\x0a\x20-\x7e]*$/.test(rawText)).toBe(true);
  });

  it('carries a real number of weapons, sorted and unique', () => {
    expect(arsenal.weapons.length).toBeGreaterThan(800);
    expect(new Set(arsenal.weapons.map((w) => w.hash)).size).toBe(arsenal.weapons.length);
    for (let i = 1; i < arsenal.weapons.length; i++) {
      const a = arsenal.weapons[i - 1];
      const b = arsenal.weapons[i];
      expect(a.name < b.name || (a.name === b.name && a.hash < b.hash), 'sorted at ' + i).toBe(true);
    }
  });

  it('says out loud that barrels and magazines were skipped, and why', () => {
    expect(arsenal.meta.rolls).toContain('Barrel and magazine');
  });

  it('records what the manifest actually says about sunsetting: nothing is sunset', () => {
    expect(arsenal.meta.sunset).toContain('excluded 0 weapons');
  });

  it('publishes the icon prefix its icon values are relative to', () => {
    expect(arsenal.meta.iconPrefix).toBe(ICON_PREFIX);
  });

  it('counts every archetype in meta, and the counts add up', () => {
    const total = arsenal.meta.counts.reduce((n, row) => n + row.legendary + row.exotic, 0);
    expect(total).toBe(arsenal.weapons.length);
    expect(arsenal.meta.counts.map((r) => r.archetype).sort()).toEqual([...ARCHETYPES].sort());
  });
});

describe('every weapon in the arsenal', () => {
  it('carries the full set of manifest facts', () => {
    for (const w of arsenal.weapons) {
      expect(w.hash, w.name).toBeGreaterThan(0);
      expect(w.name.length, String(w.hash)).toBeGreaterThan(0);
      expect(w.icon.length, w.name).toBeGreaterThan(0);
      expect(w.icon.startsWith(ICON_PREFIX), w.name).toBe(false);
      expect([5, 6], w.name).toContain(w.tierType);
      expect(['kinetic', 'energy', 'power'], w.name).toContain(w.slot);
      expect([1, 2, 3], w.name).toContain(w.ammoType);
      expect(w.damageType, w.name).toBeGreaterThanOrEqual(1);
      expect(w.itemTypeDisplayName.length, w.name).toBeGreaterThan(0);
      expect(ARCHETYPES, w.name).toContain(w.archetype);
      if (w.frame !== null) expect(typeof w.frame, w.name).toBe('string');
    }
  });

  it('never bakes a legendary outside the damage archetypes', () => {
    for (const w of legendaries) {
      expect(w.archetype, w.name).not.toBe('exotic-other');
    }
  });

  it('recognises rocket sidearms by their Micro-Missile Frame intrinsic', () => {
    const sidearms = arsenal.weapons.filter((w) => w.archetype === 'rocket-sidearm');
    expect(sidearms.length).toBeGreaterThan(0);
    for (const w of sidearms) {
      expect(w.frame, w.name).toBe('Micro-Missile Frame');
      expect(w.itemTypeDisplayName, w.name).toBe('Sidearm');
    }
  });

  it('reserves exotic-other for exotics', () => {
    for (const w of arsenal.weapons.filter((x) => x.archetype === 'exotic-other')) {
      expect(w.tierType, w.name).toBe(6);
    }
  });

  it('locks no weapon to a class, because the final manifest locks none', () => {
    // classType is baked only when 0, 1 or 2. The final manifest class-locks
    // zero weapons (even the class glaives read classType 3), so the field
    // appearing anywhere means the manifest changed under us.
    for (const w of arsenal.weapons) {
      expect(w.classType, w.name).toBeUndefined();
    }
  });
});

describe('rolls', () => {
  it('gives every legendary at least one trait column', () => {
    for (const w of legendaries) {
      const traits = (w.columns ?? []).filter((c) => c.kind === 'trait');
      expect(traits.length, w.name + ' ' + w.hash).toBeGreaterThan(0);
    }
  });

  it('bakes no roll columns for exotics, whose perks are fixed or curated elsewhere', () => {
    for (const w of exotics) {
      expect(w.columns, w.name).toBeUndefined();
    }
  });

  it('keeps every column well-formed: kind, index, sorted non-empty pools', () => {
    for (const w of legendaries) {
      for (const col of w.columns ?? []) {
        expect(['trait', 'origin'], w.name).toContain(col.kind);
        expect(Number.isInteger(col.i) && col.i >= 0, w.name).toBe(true);
        expect(col.perks.length, w.name).toBeGreaterThan(0);
        for (let i = 1; i < col.perks.length; i++) {
          expect(col.perks[i - 1], w.name).toBeLessThan(col.perks[i]);
        }
      }
    }
  });

  it('resolves every pooled perk hash to a name in the side table', () => {
    for (const h of pooled) {
      expect(arsenal.perkNames[String(h)], String(h)).toBeTruthy();
    }
  });
});

describe('damage perks', () => {
  it('carries exactly the curated list, in the manifest spelling', () => {
    expect(Object.keys(arsenal.damagePerks).sort()).toEqual([...DAMAGE_PERK_NAMES].sort());
  });

  it('skips Repulsor Brace and Master of Arms on purpose, and says so', () => {
    expect(arsenal.damagePerks['Repulsor Brace']).toBeUndefined();
    expect(arsenal.damagePerks['Master of Arms']).toBeUndefined();
    expect(String(arsenal.meta.skippedPerks)).toContain('Repulsor Brace');
    expect(String(arsenal.meta.skippedPerks)).toContain('Master of Arms');
  });

  it('resolved base and enhanced plugs for every perk', () => {
    for (const name of DAMAGE_PERK_NAMES) {
      const perk = arsenal.damagePerks[name];
      expect(perk, name).toBeTruthy();
      expect(perk.hashes.length, name).toBeGreaterThanOrEqual(2);
      for (const h of perk.hashes) {
        expect(arsenal.perkNames[String(h)], name).toBe(name);
      }
    }
  });

  it('every damage perk can actually roll on at least one baked weapon', () => {
    for (const name of DAMAGE_PERK_NAMES) {
      const perk = arsenal.damagePerks[name];
      expect(perk.hashes.some((h) => pooled.has(h)), name).toBe(true);
    }
  });

  it('carries the one verified number, sourced, and invents none', () => {
    const kt = arsenal.damagePerks['Kinetic Tremors'];
    expect(kt.note).toContain('57.8');
    expect(kt.note).toContain('160.2');
    expect(kt.source).toBe('Aegis FAQ');
    for (const name of DAMAGE_PERK_NAMES) {
      if (name === 'Kinetic Tremors') continue;
      expect(arsenal.damagePerks[name].note, name).toContain('not public post-9.7.0');
    }
  });

  it('marks Chain Reaction as the add-clear pick it is', () => {
    expect(arsenal.damagePerks['Chain Reaction'].note).toContain('Add-clear');
  });
});

describe('spot checks against known weapons', () => {
  const anyHashPooled = (name: string, perkName: string) => {
    const pool = unionPool(name);
    return arsenal.damagePerks[perkName].hashes.some((h) => pool.has(h));
  };

  it('Hezen Vengeance is a legendary power rocket with its wanted roll poolable', () => {
    const defs = byName.get('Hezen Vengeance') ?? [];
    expect(defs.length).toBeGreaterThan(0);
    for (const w of defs) {
      expect(w.tierType).toBe(5);
      expect(w.slot).toBe('power');
      expect(w.archetype).toBe('rocket');
      expect(w.frame).toBe('Aggressive Frame');
    }
    const pool = unionPool('Hezen Vengeance');
    expect(PERK_HASHES['Overflow'].some((h) => pool.has(h))).toBe(true);
    expect(PERK_HASHES['Bait and Switch'].some((h) => pool.has(h))).toBe(true);
  });

  it('Gjallarhorn is the exotic power rocket with the Wolfpack frame', () => {
    const defs = byName.get('Gjallarhorn') ?? [];
    expect(defs.length).toBeGreaterThan(0);
    for (const w of defs) {
      expect(w.tierType).toBe(6);
      expect(w.slot).toBe('power');
      expect(w.archetype).toBe('rocket');
      expect(w.frame).toBe('Wolfpack Rounds');
    }
  });

  it('Edge Transit is a heavy GL that can roll Bait and Switch and both Envious perks', () => {
    const defs = byName.get('Edge Transit') ?? [];
    expect(defs.length).toBeGreaterThan(0);
    for (const w of defs) expect(w.archetype).toBe('heavy-gl');
    expect(anyHashPooled('Edge Transit', 'Bait and Switch')).toBe(true);
    expect(anyHashPooled('Edge Transit', 'Envious Arsenal')).toBe(true);
    expect(anyHashPooled('Edge Transit', 'Envious Assassin')).toBe(true);
  });

  it('VS Chill Inhibitor rolls Envious Arsenal now, not Envious Assassin', () => {
    // The weapon shipped in 2024 with Envious Assassin; the Edge of Fate
    // refresh swapped its column to Envious Arsenal, and the frozen manifest
    // is the version of record. The bake trusts the manifest.
    expect(anyHashPooled('VS Chill Inhibitor', 'Envious Arsenal')).toBe(true);
    expect(anyHashPooled('VS Chill Inhibitor', 'Bait and Switch')).toBe(true);
    expect(anyHashPooled('VS Chill Inhibitor', 'Envious Assassin')).toBe(false);
  });

  it('Whisper and Outbreak are in, because exotics of any archetype are in', () => {
    const whisper = byName.get('Whisper of the Worm') ?? [];
    expect(whisper.length).toBeGreaterThan(0);
    for (const w of whisper) {
      expect(w.tierType).toBe(6);
      expect(w.slot).toBe('power');
      expect(w.archetype).toBe('sniper');
    }
    const outbreak = byName.get('Outbreak Perfected') ?? [];
    expect(outbreak.length).toBeGreaterThan(0);
    for (const w of outbreak) {
      expect(w.tierType).toBe(6);
      expect(w.slot).toBe('kinetic');
      expect(w.itemTypeDisplayName).toBe('Pulse Rifle');
      expect(w.archetype).toBe('exotic-other');
    }
  });
});

describe('stays aligned with the curated bake', () => {
  // The one curated weapon the arsenal rightly leaves out: No Hesitation is
  // a legendary support auto rifle, outside the damage archetypes. Its job
  // on the site is a support job, covered by items.json.
  const OUTSIDE_ARSENAL = new Set(['no-hesitation']);

  it('covers every curated weapon hash except the support auto rifle', () => {
    const arsenalHashes = new Set(arsenal.weapons.map((w) => w.hash));
    for (const [id, item] of Object.entries(BAKED_ITEMS)) {
      if (item.kind !== 'weapon') continue;
      for (const hash of item.hashes) {
        expect(arsenalHashes.has(hash), id + ' hash ' + hash).toBe(!OUTSIDE_ARSENAL.has(id));
      }
    }
  });

  it('agrees with items.json about slot, tier and name for shared hashes', () => {
    const arsenalByHash = new Map(arsenal.weapons.map((w) => [w.hash, w]));
    for (const [id, item] of Object.entries(BAKED_ITEMS)) {
      if (item.kind !== 'weapon' || OUTSIDE_ARSENAL.has(id)) continue;
      for (const hash of item.hashes) {
        const w = arsenalByHash.get(hash);
        expect(w, id + ' hash ' + hash).toBeTruthy();
        if (!w) continue;
        expect(w.slot, id).toBe(item.slot);
        expect(w.tierType, id).toBe(item.tierType);
        expect([item.name, ...item.aliases], id).toContain(w.name);
      }
    }
  });

  it('pools every tier-list roll perk somewhere, except the exotic intrinsic', () => {
    // The Perfect Fifth is Ergo Sum's rolled intrinsic; exotics get no baked
    // columns, so it is the one wanted-roll perk arsenal pools cannot see.
    for (const name of WANTED_PERK_NAMES) {
      const hashes = PERK_HASHES[name];
      expect(hashes, name).toBeTruthy();
      const somePooled = hashes.some((h) => pooled.has(h));
      expect(somePooled, name).toBe(name !== 'The Perfect Fifth');
    }
  });
});
