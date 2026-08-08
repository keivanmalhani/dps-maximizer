// The pure helpers behind scripts/build-arsenal.mjs. The bake itself needs
// the 190MB manifest; these tests pin down the logic that decides what gets
// baked, so a refactor cannot quietly change what counts as a damage weapon
// or which sockets count as roll columns.

import { describe, expect, it } from 'vitest';
import {
  ARCHETYPES,
  ICON_PREFIX,
  UNCAPPED_THRESHOLD,
  asciiJsonCompact,
  classifyArchetype,
  extractColumns,
  isSunset,
  maxPowerCap,
  pickFrame,
  scanEntries,
  shortenIcon,
  toAscii
} from '../scripts/lib/arsenal-lib.mjs';

describe('toAscii', () => {
  it('passes plain ASCII through untouched', () => {
    expect(toAscii('Edge Transit')).toBe('Edge Transit');
  });

  it('folds the U+2019 apostrophes manifest names use', () => {
    expect(toAscii('Praedyth\u2019s Revenge')).toBe("Praedyth's Revenge");
  });

  it('folds dashes, ellipsis, accents and non-breaking spaces', () => {
    expect(toAscii('A\u2014B')).toBe('A-B');
    expect(toAscii('wait\u2026')).toBe('wait...');
    expect(toAscii('caf\u00e9')).toBe('cafe');
    expect(toAscii('a\u00a0b')).toBe('a b');
  });

  it('refuses names it cannot fold instead of smuggling a byte', () => {
    expect(toAscii('\u03a9 sword')).toBeNull();
  });
});

describe('asciiJsonCompact', () => {
  it('emits compact JSON with non-ASCII escaped', () => {
    expect(asciiJsonCompact({ a: '\u2019', b: 1 })).toBe('{"a":"\\u2019","b":1}');
  });

  it('round-trips through JSON.parse', () => {
    const value = { name: 'Ros\u00e9', list: [1, 2, 3] };
    expect(JSON.parse(asciiJsonCompact(value))).toEqual(value);
  });
});

describe('scanEntries', () => {
  it('walks top-level entries of a big JSON object one at a time', () => {
    const text = '{"111":{"a":1,"nested":{"b":2}},"222":{"c":[1,2]}}';
    const seen: Array<[string, unknown]> = [];
    scanEntries(text, (key, raw) => seen.push([key, JSON.parse(raw)]));
    expect(seen).toEqual([
      ['111', { a: 1, nested: { b: 2 } }],
      ['222', { c: [1, 2] }]
    ]);
  });

  it('is not fooled by braces and escaped quotes inside strings', () => {
    const text = '{"1":{"s":"}{\\"}\\\\","t":"{"},"2":{"u":0}}';
    const keys: string[] = [];
    scanEntries(text, (key, raw) => {
      keys.push(key);
      expect(() => JSON.parse(raw)).not.toThrow();
    });
    expect(keys).toEqual(['1', '2']);
  });
});

describe('shortenIcon', () => {
  it('strips the shared manifest prefix', () => {
    expect(shortenIcon(ICON_PREFIX + 'abc.jpg')).toBe('abc.jpg');
  });

  it('passes paths outside the prefix through untouched', () => {
    expect(shortenIcon('/other/path.png')).toBe('/other/path.png');
    expect(shortenIcon('')).toBe('');
  });
});

describe('classifyArchetype', () => {
  it('maps the straightforward damage archetypes', () => {
    expect(classifyArchetype('Rocket Launcher', 3, 'Aggressive Frame', 5)).toBe('rocket');
    expect(classifyArchetype('Linear Fusion Rifle', 3, null, 5)).toBe('linear-fusion');
    expect(classifyArchetype('Machine Gun', 3, null, 5)).toBe('machine-gun');
    expect(classifyArchetype('Sword', 3, null, 5)).toBe('sword');
    expect(classifyArchetype('Sniper Rifle', 2, null, 5)).toBe('sniper');
    expect(classifyArchetype('Fusion Rifle', 2, null, 5)).toBe('fusion');
    expect(classifyArchetype('Trace Rifle', 2, null, 5)).toBe('trace');
    expect(classifyArchetype('Glaive', 2, null, 5)).toBe('glaive');
  });

  it('splits grenade launchers on ammo: heavy versus breech', () => {
    expect(classifyArchetype('Grenade Launcher', 3, null, 5)).toBe('heavy-gl');
    expect(classifyArchetype('Grenade Launcher', 2, null, 5)).toBe('breech-gl');
    // Fighting Lion is the one primary-ammo GL; exotic, still a breech.
    expect(classifyArchetype('Grenade Launcher', 1, null, 6)).toBe('breech-gl');
  });

  it('admits sidearms only on the Micro-Missile Frame intrinsic', () => {
    // The manifest has no "Rocket-Assisted Frame" item; rocket sidearms are
    // recognisable only by their intrinsic being named Micro-Missile Frame.
    expect(classifyArchetype('Sidearm', 2, 'Micro-Missile Frame', 5)).toBe('rocket-sidearm');
    expect(classifyArchetype('Sidearm', 1, 'Adaptive Frame', 5)).toBeNull();
  });

  it('keeps every exotic, whatever the archetype', () => {
    expect(classifyArchetype('Pulse Rifle', 1, 'The Corruption Spreads', 6)).toBe('exotic-other');
    expect(classifyArchetype('Hand Cannon', 1, null, 6)).toBe('exotic-other');
  });

  it('rejects legendaries outside the damage archetypes', () => {
    expect(classifyArchetype('Auto Rifle', 1, 'Support Frame', 5)).toBeNull();
    expect(classifyArchetype('Hand Cannon', 1, null, 5)).toBeNull();
    expect(classifyArchetype('Pulse Rifle', 1, null, 5)).toBeNull();
  });

  it('only ever produces keys the ARCHETYPES list knows', () => {
    const produced = [
      classifyArchetype('Rocket Launcher', 3, null, 5),
      classifyArchetype('Grenade Launcher', 3, null, 5),
      classifyArchetype('Grenade Launcher', 2, null, 5),
      classifyArchetype('Linear Fusion Rifle', 3, null, 5),
      classifyArchetype('Machine Gun', 3, null, 5),
      classifyArchetype('Sword', 3, null, 5),
      classifyArchetype('Sniper Rifle', 2, null, 5),
      classifyArchetype('Fusion Rifle', 2, null, 5),
      classifyArchetype('Trace Rifle', 2, null, 5),
      classifyArchetype('Glaive', 2, null, 5),
      classifyArchetype('Sidearm', 2, 'Micro-Missile Frame', 5),
      classifyArchetype('Bow', 1, null, 6)
    ];
    for (const key of produced) {
      expect(key).not.toBeNull();
      expect(ARCHETYPES).toContain(key as string);
    }
  });
});

describe('power caps', () => {
  const caps = new Map<number, number>([
    [7, 999990],
    [8, 1010]
  ]);

  it('takes the highest cap across versions', () => {
    expect(maxPowerCap({ quality: { versions: [{ powerCapHash: 8 }, { powerCapHash: 7 }] } }, caps)).toBe(999990);
  });

  it('returns null when the definition carries no versions', () => {
    expect(maxPowerCap({}, caps)).toBeNull();
    expect(maxPowerCap({ quality: { versions: [] } }, caps)).toBeNull();
  });

  it('ignores cap hashes the cap table does not know', () => {
    expect(maxPowerCap({ quality: { versions: [{ powerCapHash: 999 }] } }, caps)).toBeNull();
  });

  it('calls a weapon sunset only when its best cap is a real cap', () => {
    expect(isSunset({ quality: { versions: [{ powerCapHash: 8 }] } }, caps)).toBe(true);
    expect(isSunset({ quality: { versions: [{ powerCapHash: 8 }, { powerCapHash: 7 }] } }, caps)).toBe(false);
    expect(isSunset({}, caps)).toBe(false);
    expect(UNCAPPED_THRESHOLD).toBeGreaterThan(1010);
    expect(UNCAPPED_THRESHOLD).toBeLessThanOrEqual(999940);
  });
});

describe('pickFrame', () => {
  const plugCats = new Map<number, string>([
    [1, 'intrinsics'],
    [2, 'intrinsics'],
    [10, 'tubes']
  ]);
  const names = new Map<number, string>([
    [1, 'Honed Edge'],
    [2, 'Aggressive Frame'],
    [10, 'Confined Launch']
  ]);

  it('finds the intrinsic socket and reads its name', () => {
    expect(pickFrame([{ singleInitialItemHash: 1 }], plugCats, names)).toEqual({
      frame: 'Honed Edge',
      randomized: false
    });
  });

  it('prefers the plug actually named "* Frame"', () => {
    expect(
      pickFrame([{ singleInitialItemHash: 1 }, { singleInitialItemHash: 2 }], plugCats, names).frame
    ).toBe('Aggressive Frame');
  });

  it('refuses to name a frame the weapon rolls', () => {
    expect(pickFrame([{ singleInitialItemHash: 1, randomizedPlugSetHash: 77 }], plugCats, names)).toEqual({
      frame: null,
      randomized: true
    });
  });

  it('returns null when no intrinsic socket exists', () => {
    expect(pickFrame([{ singleInitialItemHash: 10 }], plugCats, names)).toEqual({
      frame: null,
      randomized: false
    });
  });
});

describe('extractColumns', () => {
  // 1 intrinsic, 10 barrel, 11 magazine, 20-22 traits, 30-31 origins,
  // 40 shader, 50 the Randomized Perks display placeholder.
  const plugCats = new Map<number, string>([
    [1, 'intrinsics'],
    [10, 'tubes'],
    [11, 'magazines_gl'],
    [20, 'frames'],
    [21, 'frames'],
    [22, 'frames'],
    [30, 'origins'],
    [31, 'origins'],
    [40, 'shader'],
    [50, 'frames']
  ]);
  const names = new Map<number, string>([
    [20, 'Bait and Switch'],
    [21, 'Envious Assassin'],
    [22, 'Frenzy'],
    [30, 'Veist Stinger'],
    [31, 'Hakke Breach Armaments'],
    [50, 'Randomized Perks']
  ]);
  const sets = new Map<number, number[]>([
    [100, [10]],
    [200, [21, 20, 21]],
    [300, [30, 31]],
    [400, [40]]
  ]);
  const plugsOf = (hash: number) => sets.get(hash) ?? null;

  it('keeps trait and origin columns, skips everything else', () => {
    const columns = extractColumns(
      [
        { singleInitialItemHash: 1 }, // intrinsic
        { singleInitialItemHash: 10, randomizedPlugSetHash: 100 }, // barrels
        { singleInitialItemHash: 20, randomizedPlugSetHash: 200 }, // trait 1
        { singleInitialItemHash: 30, reusablePlugSetHash: 300 }, // origin
        { singleInitialItemHash: 40, reusablePlugSetHash: 400 } // shader
      ],
      plugCats,
      names,
      plugsOf
    );
    expect(columns).toEqual([
      { i: 2, kind: 'trait', perks: [20, 21] },
      { i: 3, kind: 'origin', perks: [30, 31] }
    ]);
  });

  it('deduplicates and sorts each pool', () => {
    const [col] = extractColumns([{ randomizedPlugSetHash: 200 }], plugCats, names, plugsOf);
    expect(col.perks).toEqual([20, 21]);
  });

  it('falls back to the fixed plug on fixed-roll weapons', () => {
    expect(extractColumns([{ singleInitialItemHash: 22 }], plugCats, names, plugsOf)).toEqual([
      { i: 0, kind: 'trait', perks: [22] }
    ]);
  });

  it('falls back to inline reusablePlugItems before the fixed plug', () => {
    expect(
      extractColumns(
        [{ singleInitialItemHash: 22, reusablePlugItems: [{ plugItemHash: 21 }, { plugItemHash: 20 }] }],
        plugCats,
        names,
        plugsOf
      )
    ).toEqual([{ i: 0, kind: 'trait', perks: [20, 21] }]);
  });

  it('drops the Randomized Perks display placeholder instead of baking it', () => {
    expect(extractColumns([{ singleInitialItemHash: 50 }], plugCats, names, plugsOf)).toEqual([]);
  });

  it('prefers the randomized set when both sets are present', () => {
    const [col] = extractColumns(
      [{ randomizedPlugSetHash: 200, reusablePlugSetHash: 300 }],
      plugCats,
      names,
      plugsOf
    );
    expect(col.kind).toBe('trait');
    expect(col.perks).toEqual([20, 21]);
  });

  it('emits nothing for a set the plug table does not know', () => {
    expect(extractColumns([{ randomizedPlugSetHash: 12345 }], plugCats, names, plugsOf)).toEqual([]);
  });
});
