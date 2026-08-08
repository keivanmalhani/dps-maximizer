// Bakes src/data/items.json from the live Destiny manifest, once.
//
// The site does NOT ship or fetch the 50MB+ item manifest client-side. The
// game stopped receiving content updates with 9.7.0 (final hotfix 9.7.0.4,
// 28 July 2026), so the manifest is as frozen as the meta: resolving the
// curated list at build time and committing the result is the correct
// architecture, not a shortcut.
//
// Run with no arguments to download the item table from bungie.net, or pass
// a path to an already downloaded DestinyInventoryItemDefinition.json:
//   node scripts/build-data.mjs [path-to-item-table.json]
//
// Follows weapon-report/scripts/build-weapon-pool.mjs: same streaming scan,
// same ASCII folding. No API key is needed for any of this.
//
// EVERY resolution is verified against the expected display name, and the
// script FAILS LOUDLY on a miss or an ambiguity it cannot explain, because a
// wrong hash here means the site recommends the wrong gun with a straight
// face. Loudness is the feature.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(here, '..', 'src', 'data', 'items.json');

// ---------------------------------------------------------------- the list
//
// Mirrors src/data/tiers.ts (id, name, kind, classType). tests/items-data
// cross-checks items.json against tiers.ts, so drift between the two files
// breaks CI rather than shipping quietly.

const CURATED = [
  { id: 'hezen-vengeance', name: 'Hezen Vengeance', kind: 'weapon', aliases: ['Hezen Vengeance (Timelost)'] },
  { id: 'cuirass-of-the-falling-star', name: 'Cuirass of the Falling Star', kind: 'armor', classType: 0 },
  { id: 'celestial-nighthawk', name: 'Celestial Nighthawk', kind: 'armor', classType: 1 },
  { id: 'ergo-sum', name: 'Ergo Sum', kind: 'weapon' },
  { id: 'sanguine-alchemy', name: 'Sanguine Alchemy', kind: 'armor', classType: 2 },
  { id: 'tractor-cannon', name: 'Tractor Cannon', kind: 'weapon' },
  { id: 'gjallarhorn', name: 'Gjallarhorn', kind: 'weapon' },
  { id: 'edge-transit', name: 'Edge Transit', kind: 'weapon' },
  { id: 'praedyths-revenge', name: "Praedyth's Revenge", kind: 'weapon', aliases: ["Praedyth's Revenge (Timelost)"] },
  { id: 'the-queenbreaker', name: 'The Queenbreaker', kind: 'weapon' },
  { id: 'thunderlord', name: 'Thunderlord', kind: 'weapon' },
  { id: 'still-hunt', name: 'Still Hunt', kind: 'weapon' },
  { id: 'izanagis-burden', name: "Izanagi's Burden", kind: 'weapon' },
  { id: 'lumina', name: 'Lumina', kind: 'weapon' },
  { id: 'no-hesitation', name: 'No Hesitation', kind: 'weapon' },
  { id: 'lunafaction-boots', name: 'Lunafaction Boots', kind: 'armor', classType: 2 },
  { id: 'synthoceps', name: 'Synthoceps', kind: 'armor', classType: 0 },
  { id: 'vs-chill-inhibitor', name: 'VS Chill Inhibitor', kind: 'weapon' },
  { id: 'divinity', name: 'Divinity', kind: 'weapon' },
  { id: 'anarchy', name: 'Anarchy', kind: 'weapon' },
  { id: 'apex-predator', name: 'Apex Predator', kind: 'weapon' },
  { id: 'witherhoard', name: 'Witherhoard', kind: 'weapon' },
  { id: 'outbreak-perfected', name: 'Outbreak Perfected', kind: 'weapon' },
  { id: 'winterbite', name: 'Winterbite', kind: 'weapon' },
  { id: 'briarbinds', name: 'Briarbinds', kind: 'armor', classType: 2 },
  { id: 'cloudstrike', name: 'Cloudstrike', kind: 'weapon' },
  { id: 'one-thousand-voices', name: 'One Thousand Voices', kind: 'weapon' },
  { id: 'whisper-of-the-worm', name: 'Whisper of the Worm', kind: 'weapon' },
  { id: 'grand-overture', name: 'Grand Overture', kind: 'weapon' },
  { id: 'lucky-pants', name: 'Lucky Pants', kind: 'armor', classType: 1 },
  { id: 'star-eater-scales', name: 'Star-Eater Scales', kind: 'armor', classType: 1 },
  { id: 'finalitys-auger', name: "Finality's Auger", kind: 'weapon' },
  { id: 'shards-of-galanor', name: 'Shards of Galanor', kind: 'armor', classType: 1 }
];

/**
 * Roll-check perks. Base and enhanced share a display name; keep both.
 * "The Perfect Fifth" is Ergo Sum's roll and lives in the intrinsics plug
 * category rather than frames, verified against the live table.
 */
const PERK_NAMES = [
  'Overflow',
  'Envious Assassin',
  'Envious Arsenal',
  'Bait and Switch',
  'Cluster Bomb',
  'Elemental Honing',
  'The Perfect Fifth'
];
const INTRINSIC_PERK_NAMES = new Set(['The Perfect Fifth']);

/**
 * Exotics whose catalyst matters to the tier; plug name verified against the
 * live table (Whisper's plug is literally "Whisper Catalyst"). itemType 19 is
 * the real plug; the same names also exist as itemType 20 dummies.
 */
const CATALYSTS = [
  { id: 'izanagis-burden', plugName: "Izanagi's Burden Catalyst" },
  { id: 'outbreak-perfected', plugName: 'Outbreak Perfected Catalyst' },
  { id: 'whisper-of-the-worm', plugName: 'Whisper Catalyst' },
  { id: 'grand-overture', plugName: 'Grand Overture Catalyst' }
];

const EMPTY_CATALYST_NAME = 'Empty Catalyst Socket';
const CIPHER_NAME = 'Exotic Cipher';

/** Equipment slot hashes, verified below against DestinyEquipmentSlotDefinition. */
const SLOT_EXPECTATIONS = [
  { hash: 1498876634, name: 'Kinetic Weapons', slot: 'kinetic' },
  { hash: 2465295065, name: 'Energy Weapons', slot: 'energy' },
  { hash: 953998645, name: 'Power Weapons', slot: 'power' },
  { hash: 3448274439, name: 'Helmet', slot: 'helmet' },
  { hash: 3551918588, name: 'Gauntlets', slot: 'gauntlets' },
  { hash: 14239492, name: 'Chest Armor', slot: 'chest' },
  { hash: 20886954, name: 'Leg Armor', slot: 'legs' },
  { hash: 1585787867, name: 'Class Armor', slot: 'classitem' }
];

/** Armor 3.0 character stats, resolved by name from DestinyStatDefinition. */
const STAT_NAMES = ['Weapons', 'Health', 'Class', 'Grenade', 'Super', 'Melee'];

/**
 * The six hashes character.stats has been keyed by since launch; Armor 3.0
 * renamed their definitions in place (Mobility became Weapons, Recovery
 * became Class, Strength became Melee, and so on) and also added duplicate
 * defs under new hashes. Profiles still key on these, so when a name is
 * ambiguous the candidate in this set is the one the profile will use.
 */
const CHARACTER_STAT_HASHES = new Set([
  2996146975, // Weapons (was Mobility)
  392767087, // Health (was Resilience)
  1943323491, // Class (was Recovery)
  1735777505, // Grenade (was Discipline)
  144602215, // Super (was Intellect)
  4244567218 // Melee (was Strength)
]);

// -------------------------------------------------------------------- utils

const failures = [];
function fail(message) {
  failures.push(message);
  process.stderr.write('FAIL ' + message + '\n');
}

// The repository is ASCII only, and manifest names use U+2019 apostrophes.
// Same folding as the sibling scripts: fold what can be folded, and treat
// anything still outside ASCII as unresolvable rather than smuggling a byte.
function toAscii(name) {
  const folded = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00e9/g, 'e');
  return /^[\x20-\x7e]*$/.test(folded) ? folded : null;
}

function asciiJson(value) {
  return JSON.stringify(value, null, 2).replace(/[\u0080-\uffff]/g, (c) => {
    return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

// Streaming top-level scan of a huge JSON object, one entry at a time, so the
// 200MB+ item table never has to be parsed whole. Verbatim from
// weapon-report/scripts/build-weapon-pool.mjs.
function scanEntries(text, onEntry) {
  let started = false;
  let state = 'seekkey';
  let key = '';
  let entry = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!started) { if (c === '{') started = true; continue; }
    if (state === 'seekkey') { if (c === '"') { state = 'readkey'; key = ''; } continue; }
    if (state === 'readkey') { if (c === '"') state = 'seekval'; else key += c; continue; }
    if (state === 'seekval') {
      if (c === '{') { state = 'readval'; entry = '{'; depth = 1; inString = false; escaped = false; }
      continue;
    }
    entry += c;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{') { depth++; continue; }
    if (c === '}') {
      depth--;
      if (depth === 0) { onEntry(key, entry); entry = ''; state = 'seekkey'; }
    }
  }
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

// -------------------------------------------------------------------- fetch

const local = process.argv[2];
process.stderr.write('reading the manifest index (keyless endpoint)\n');
const manifest = await fetchJson('https://www.bungie.net/Platform/Destiny2/Manifest/');
const version = manifest.Response.version;
const paths = manifest.Response.jsonWorldComponentContentPaths.en;
process.stderr.write('manifest version ' + version + '\n');

let itemText;
if (local) {
  process.stderr.write('reading item table from ' + local + '\n');
  itemText = fs.readFileSync(local, 'utf8');
} else {
  process.stderr.write('downloading ' + paths.DestinyInventoryItemDefinition + '\n');
  const response = await fetch('https://www.bungie.net' + paths.DestinyInventoryItemDefinition);
  if (!response.ok) throw new Error('item table HTTP ' + response.status);
  itemText = await response.text();
}
process.stderr.write('item table: ' + (itemText.length / 1048576).toFixed(0) + ' MB\n');

const slotDefs = await fetchJson('https://www.bungie.net' + paths.DestinyEquipmentSlotDefinition);
const statDefs = await fetchJson('https://www.bungie.net' + paths.DestinyStatDefinition);

// ------------------------------------------------- verify slot expectations

for (const expected of SLOT_EXPECTATIONS) {
  const def = slotDefs[String(expected.hash)];
  const got = def && def.displayProperties && def.displayProperties.name;
  if (got !== expected.name) {
    fail('equipment slot ' + expected.hash + ' is "' + got + '", expected "' + expected.name + '"');
  }
}
const slotByHash = new Map(SLOT_EXPECTATIONS.map((s) => [s.hash, s.slot]));

// ------------------------------------------------------------ resolve stats

const statHashes = {};
for (const wanted of STAT_NAMES) {
  const candidates = Object.entries(statDefs).filter(
    ([, def]) => def.displayProperties && def.displayProperties.name === wanted
  );
  if (candidates.length === 0) {
    fail('stat "' + wanted + '" not found in DestinyStatDefinition');
    continue;
  }
  const keyed = candidates.filter(([hash]) => CHARACTER_STAT_HASHES.has(Number(hash)));
  if (keyed.length === 1) {
    statHashes[wanted] = Number(keyed[0][0]);
    if (candidates.length > 1) {
      process.stderr.write(
        'stat "' + wanted + '": ' + candidates.length + ' defs share the name, kept the profile-keyed one ' + keyed[0][0] + '\n'
      );
    }
  } else {
    fail(
      'stat "' + wanted + '" did not resolve to exactly one profile-keyed hash: ' +
        candidates.map(([h, d]) => h + ' (category ' + d.statCategory + ')').join(', ')
    );
  }
}

// --------------------------------------------------------------- scan items

const wantedItemNames = new Map(); // folded name -> [{id, kind, viaAlias}]
for (const cur of CURATED) {
  const push = (name, viaAlias) => {
    const list = wantedItemNames.get(name) || [];
    list.push({ id: cur.id, kind: cur.kind, viaAlias });
    wantedItemNames.set(name, list);
  };
  push(cur.name, false);
  for (const alias of cur.aliases || []) push(alias, true);
}
const wantedPerkNames = new Set(PERK_NAMES);
const wantedCatalystNames = new Map(CATALYSTS.map((c) => [c.plugName, c.id]));

const nameByHash = new Map(); // every entry, folded name, for intrinsic lookup
const plugCatByHash = new Map(); // plug entries only: hash -> plugCategoryIdentifier
const itemMatches = new Map(); // id -> [{hash, def, viaAlias}]
const perkMatches = new Map(); // perk name -> [{hash, def}]
const catalystMatches = new Map(); // id -> [{hash, def}]
const emptyCatalystHashes = [];
const cipherCandidates = [];

let scanned = 0;
scanEntries(itemText, (hashText, raw) => {
  scanned++;
  let item;
  try {
    item = JSON.parse(raw);
  } catch {
    return;
  }
  const hash = Number(hashText);
  const rawName = item.displayProperties && item.displayProperties.name;
  if (!rawName) return;
  const name = toAscii(rawName);
  if (name === null) return;
  nameByHash.set(hash, name);
  if (item.plug && item.plug.plugCategoryIdentifier) {
    plugCatByHash.set(hash, item.plug.plugCategoryIdentifier);
  }

  const curatedHits = wantedItemNames.get(name);
  if (curatedHits) {
    for (const hit of curatedHits) {
      const typeOk = hit.kind === 'weapon' ? item.itemType === 3 : item.itemType === 2;
      if (!typeOk) continue;
      const list = itemMatches.get(hit.id) || [];
      list.push({ hash, def: item, viaAlias: hit.viaAlias, foldedName: name });
      itemMatches.set(hit.id, list);
    }
  }

  if (wantedPerkNames.has(name)) {
    const plugCat = item.plug && item.plug.plugCategoryIdentifier;
    const isRollPlug =
      plugCat === 'frames' ||
      /trait/i.test(item.itemTypeDisplayName || '') ||
      (INTRINSIC_PERK_NAMES.has(name) && plugCat === 'intrinsics');
    if (isRollPlug) {
      const list = perkMatches.get(name) || [];
      list.push({ hash, def: item });
      perkMatches.set(name, list);
    }
  }

  // itemType 19 is the real plug; the same catalyst names also exist as
  // itemType 20 display dummies that never appear in a socket.
  const catalystId = wantedCatalystNames.get(name);
  if (catalystId && item.plug && item.itemType === 19) {
    const list = catalystMatches.get(catalystId) || [];
    list.push({ hash, def: item });
    catalystMatches.set(catalystId, list);
  }

  if (name === EMPTY_CATALYST_NAME && item.plug && item.itemType === 19) {
    emptyCatalystHashes.push(hash);
  }

  if (name === CIPHER_NAME && item.itemType !== 20) {
    cipherCandidates.push({ hash, def: item });
  }
});
process.stderr.write('scanned ' + scanned + ' definitions\n');

// ------------------------------------------------------------ build entries

function primaryOf(matches) {
  // Prefer an entry with a collectible (the canonical issue), newest hash as
  // the tiebreak so reissues win over ancient power-capped copies.
  const sorted = [...matches].sort((a, b) => b.hash - a.hash);
  return sorted.find((m) => m.def.collectibleHash !== undefined) || sorted[0];
}

const items = {};
for (const cur of CURATED) {
  const matches = (itemMatches.get(cur.id) || []).filter(
    (m) => m.def.inventory && m.def.inventory.tierType >= 5
  );
  if (matches.length === 0) {
    fail('curated item "' + cur.name + '" (' + cur.id + ') resolved to nothing');
    continue;
  }
  if (matches.length > 8) {
    fail('curated item "' + cur.name + '" resolved to ' + matches.length + ' defs, which smells wrong');
    continue;
  }

  const canonical = matches.filter((m) => !m.viaAlias);
  if (canonical.length === 0) {
    fail('curated item "' + cur.name + '" only matched via alias, never by its own name');
    continue;
  }
  const primary = primaryOf(canonical);

  // The point of the exercise: the resolved hash's name must be the expected
  // name, exactly, or the build dies. A wrong hash recommends the wrong gun.
  if (primary.foldedName !== cur.name) {
    fail('hash ' + primary.hash + ' resolved to "' + primary.foldedName + '", expected "' + cur.name + '"');
    continue;
  }

  if (cur.classType !== undefined) {
    const bad = canonical.find((m) => m.def.classType !== cur.classType);
    if (bad) {
      fail(cur.name + ' hash ' + bad.hash + ' has classType ' + bad.def.classType + ', expected ' + cur.classType);
      continue;
    }
  }

  const def = primary.def;
  const slotHash = def.equippingBlock && def.equippingBlock.equipmentSlotTypeHash;
  const slot = slotByHash.get(slotHash);
  if (!slot) {
    fail(cur.name + ' has unknown equipment slot hash ' + slotHash);
    continue;
  }

  // The intrinsic frame decides the Anti-Champion 2.0 stun, so it has to be
  // read from the manifest, not remembered. Find the socket whose initial
  // plug is in the intrinsics category; prefer one named "* Frame". A weapon
  // whose intrinsic socket is randomized (Ergo Sum rolls its frame) gets
  // null, and the champion note says so instead of guessing.
  let frame = null;
  if (cur.kind === 'weapon') {
    const entries = (def.sockets && def.sockets.socketEntries) || [];
    const intrinsicSockets = entries.filter(
      (s) => plugCatByHash.get(s.singleInitialItemHash) === 'intrinsics'
    );
    const preferred =
      intrinsicSockets.find((s) => /\sFrame$/.test(nameByHash.get(s.singleInitialItemHash) || '')) ||
      intrinsicSockets[0];
    if (preferred) {
      if (preferred.randomizedPlugSetHash) {
        process.stderr.write('note: ' + cur.name + ' rolls its intrinsic; frame left null on purpose\n');
      } else {
        frame = nameByHash.get(preferred.singleInitialItemHash) || null;
      }
    }
    if (!frame && !(preferred && preferred.randomizedPlugSetHash)) {
      process.stderr.write('note: no intrinsic frame resolved for ' + cur.name + '; champion note will say so\n');
    }
  }

  items[cur.id] = {
    name: cur.name,
    hashes: matches.map((m) => m.hash).sort((a, b) => a - b),
    collectibleHashes: matches
      .map((m) => m.def.collectibleHash)
      .filter((h) => h !== undefined)
      .sort((a, b) => a - b),
    primaryHash: primary.hash,
    icon: (def.displayProperties && def.displayProperties.icon) || '',
    kind: cur.kind,
    slot,
    classType: def.classType,
    tierType: def.inventory.tierType,
    itemTypeDisplayName: toAscii(def.itemTypeDisplayName || '') || '',
    ammoType: (def.equippingBlock && def.equippingBlock.ammoType) || 0,
    damageType: def.defaultDamageType || 0,
    frame,
    aliases: (cur.aliases || []).filter((alias) =>
      matches.some((m) => m.foldedName === alias)
    )
  };
}

const perks = {};
for (const name of PERK_NAMES) {
  const matches = perkMatches.get(name) || [];
  if (matches.length === 0) {
    fail('perk "' + name + '" resolved to no trait plugs');
    continue;
  }
  perks[name] = matches.map((m) => m.hash).sort((a, b) => a - b);
}

const catalysts = {};
for (const cat of CATALYSTS) {
  const matches = catalystMatches.get(cat.id) || [];
  if (matches.length === 0) {
    fail('catalyst plug "' + cat.plugName + '" resolved to nothing');
    continue;
  }
  catalysts[cat.id] = {
    name: cat.plugName,
    hashes: matches.map((m) => m.hash).sort((a, b) => a - b)
  };
}

if (emptyCatalystHashes.length === 0) fail('"' + EMPTY_CATALYST_NAME + '" resolved to nothing');

let cipher = null;
if (cipherCandidates.length === 0) {
  fail('"' + CIPHER_NAME + '" resolved to nothing');
} else if (cipherCandidates.length === 1) {
  cipher = { name: CIPHER_NAME, hash: cipherCandidates[0].hash };
} else {
  fail(
    '"' + CIPHER_NAME + '" is ambiguous: ' +
      cipherCandidates.map((c) => c.hash + ' (itemType ' + c.def.itemType + ')').join(', ')
  );
}

// -------------------------------------------------------------------- write

if (failures.length > 0) {
  process.stderr.write('\n' + failures.length + ' failure(s). Nothing was written, on purpose.\n');
  process.exit(1);
}

const out = {
  manifestVersion: version,
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Generated by scripts/build-data.mjs. Do not edit by hand. The game is frozen at 9.7.0.4, so this file only changes if the curated list does.',
  statHashes,
  cipher,
  emptyCatalystSocket: emptyCatalystHashes.sort((a, b) => a - b),
  perks,
  catalysts,
  items
};

fs.writeFileSync(outPath, asciiJson(out) + '\n');
process.stderr.write('wrote ' + outPath + '\n');
process.stderr.write(
  Object.keys(items).length + ' items, ' +
    Object.keys(perks).length + ' perks, ' +
    Object.keys(catalysts).length + ' catalysts, manifest ' + version + '\n'
);
for (const [id, item] of Object.entries(items)) {
  process.stderr.write(
    '  ' + id + ' -> ' + item.primaryHash + ' "' + item.name + '" [' + item.slot + ']' +
      (item.frame ? ' frame: ' + item.frame : '') + '\n'
  );
}
