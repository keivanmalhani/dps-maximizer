# scripts

Build-time tooling. Nothing here runs in CI or in the browser; the outputs
are committed, because the game is frozen at 9.7.0.4 and the manifest no
longer changes.

## The two manifest bakes

| script | output | what it resolves |
| --- | --- | --- |
| `build-data.mjs` | `src/data/items.json` (~19 KB) | the 33 curated tier-list items, their perk/catalyst plugs, stat hashes |
| `build-arsenal.mjs` | `src/data/arsenal.json` (~505 KB raw, ~83 KB gzip) | every damage-relevant legendary and every exotic weapon, trait/origin roll pools, the curated damage-perk map |

Re-run them with:

```
npm run data           # items.json
npm run data:arsenal   # arsenal.json
```

Both fetch the manifest from the keyless bungie.net endpoint, verify every
expectation against what the manifest actually says, and FAIL LOUDLY without
writing anything on a miss. Where the manifest disagrees with a stated
expectation, the manifest wins and the disagreement is printed and recorded
(arsenal.json keeps them in `meta.spotCheckDisagreements` / `meta.poolMisses`).

The item table is ~190 MB of JSON, so both scripts accept an already
downloaded copy, and `build-arsenal.mjs` also takes a directory of the
smaller component tables (`DestinyPlugSetDefinition.json`,
`DestinyEquipmentSlotDefinition.json`, `DestinyPowerCapDefinition.json`;
anything missing is fetched):

```
node scripts/build-data.mjs    /path/to/DestinyInventoryItemDefinition.json
node scripts/build-arsenal.mjs /path/to/DestinyInventoryItemDefinition.json /path/to/components-dir
```

`build-arsenal.mjs` streams the item table with the same top-level scanner as
`build-data.mjs` instead of `JSON.parse` on the whole string, so it runs in
modest memory. (Measured on Node 22: a full parse costs about 600 MB of heap;
the streaming scan keeps the peak near the size of the raw text.)

What `build-arsenal.mjs` verifies before it will write:

- the three weapon equipment slot definitions still carry their names
- ten spot-check weapons resolve with expected tier, slot, archetype, frame
  and pool contents (Hezen Vengeance, Gjallarhorn, Edge Transit, Whisper,
  Outbreak, The Queenbreaker, Apex Predator, Thunderlord, VS Chill
  Inhibitor, Indebted Kindness)
- every curated damage perk resolves to base plus enhanced plug hashes by
  display name, and every perk can actually roll in at least one baked pool
- it prints the weapons-per-archetype table for eyeballing

The pure logic (archetype classification, sunset check, roll-column
extraction, the streaming scanner) lives in `lib/arsenal-lib.mjs` and is
covered by `tests/arsenal-lib.test.ts`; the committed JSON is cross-checked
against `items.json` and `tiers.ts` by `tests/arsenal-data.test.ts`.

## The share card

`render-og.mjs` renders `public/og.png` and is deliberately outside the
build because it needs a native canvas:

```
npm install --no-save @napi-rs/canvas
node scripts/render-og.mjs
```
