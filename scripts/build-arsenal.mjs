// Bakes src/data/arsenal.json from the live Destiny manifest, once.
//
// Where scripts/build-data.mjs resolves the 33 curated tier-list entries,
// this bake teaches the site the WHOLE damage-relevant arsenal: every
// non-sunset legendary in a damage archetype (rockets, grenade launchers
// heavy and breech, linear fusions, machine guns, swords, snipers, fusions,
// traces, rocket sidearms, glaives), every exotic weapon of any archetype,
// the trait and origin perk pools each legendary can roll, and a curated,
// sourced map of the perks that matter for boss damage.
//
// items.json stays untouched; arsenal.json is a second, larger file the site
// lazy-loads. Same rules as the sibling bake: the game is frozen at 9.7.0.4,
// EVERY expectation is verified, and the script FAILS LOUDLY on a miss it
// cannot explain. Where the manifest disagrees with an expectation the
// manifest wins and the disagreement is printed and recorded in meta.
//
// Run with no arguments to download everything from bungie.net, or point it
// at already-downloaded component JSON:
//   node scripts/build-arsenal.mjs [path-to-item-table.json] [components-dir]
// components-dir may hold DestinyPlugSetDefinition.json,
// DestinyEquipmentSlotDefinition.json and DestinyPowerCapDefinition.json;
// anything missing is fetched. No API key is needed for any of this.
//
// Memory note, measured before choosing the approach: the ~190MB item table
// parses whole in about 5s at ~600MB of heap on Node 22, so JSON.parse would
// work on a big machine. The streaming scan below (same scanner as
// build-data.mjs) keeps peak memory near the size of the raw text instead,
// so the bake also runs on small CI boxes. Wall time is a few seconds either
// way; the download dominates.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
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
} from './lib/arsenal-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(here, '..', 'src', 'data', 'arsenal.json');

// ------------------------------------------------------------- damage perks
//
// The curated list of perks that matter for boss damage. Notes are honest:
// the only carried number is the one with a public source; everything else
// says so instead of inventing a decimal. Repulsor Brace (defensive) and
// Master of Arms (no public post-9.7.0 source) are deliberately absent.

const PENDING_NOTE = 'Damage perk; community-verified value not public post-9.7.0.';
const CURATED_SOURCE = 'Curated damage-perk list, 2026-08; hashes resolved against the live manifest.';

const DAMAGE_PERKS = [
  { name: 'Bait and Switch', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Envious Assassin', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Envious Arsenal', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Explosive Light', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Vorpal Weapon', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Surrounded', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Frenzy', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Cascade Point', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Bipod', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Auto-Loading Holster', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Reconstruction', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Clown Cartridge', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Field Prep', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Triple Tap', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: "Fourth Time's the Charm", note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Focused Fury', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Firing Line', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'High-Impact Reserves', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Precision Instrument', note: PENDING_NOTE, source: CURATED_SOURCE },
  { name: 'Desperate Measures', note: PENDING_NOTE, source: CURATED_SOURCE },
  // The manifest spells it "One for All", lowercase f; the first run of this
  // bake asked for "One For All" and failed loudly, which is the system
  // working. The manifest spelling is the key.
  { name: 'One for All', note: PENDING_NOTE, source: CURATED_SOURCE },
  {
    name: 'Kinetic Tremors',
    note:
      'Verified: tremors add roughly 57.8 percent of a rapid-fire sniper shot and roughly 160.2 percent of a rapid scout shot per proc (Aegis FAQ).',
    source: 'Aegis FAQ'
  },
  {
    name: 'Chain Reaction',
    note: 'Add-clear pick, not single-target; community-verified value not public post-9.7.0.',
    source: CURATED_SOURCE
  }
];

/**
 * Damage perks allowed to be absent from every baked pool without killing
 * the build. Empty means the assertion is fully strict; a name goes here
 * only when the manifest itself proves the perk rolls exclusively on
 * archetypes outside the arsenal, and the report says so.
 */
const ALLOWED_POOL_MISSES = new Set([]);

/** Weapon equipment slots, verified against DestinyEquipmentSlotDefinition. */
const SLOT_EXPECTATIONS = [
  { hash: 1498876634, name: 'Kinetic Weapons', slot: 'kinetic' },
  { hash: 2465295065, name: 'Energy Weapons', slot: 'energy' },
  { hash: 953998645, name: 'Power Weapons', slot: 'power' }
];

// -------------------------------------------------------------- spot checks
//
// Ten known weapons with expected properties. A weapon that is missing
// entirely fails the build; a property the manifest disagrees on is printed,
// recorded in meta.spotCheckDisagreements, and the manifest wins.

const SPOT_CHECKS = [
  { name: 'Hezen Vengeance', tierType: 5, slot: 'power', archetype: 'rocket', frame: 'Aggressive Frame', ammoType: 3 },
  { name: 'Gjallarhorn', tierType: 6, slot: 'power', archetype: 'rocket', frame: 'Wolfpack Rounds' },
  {
    name: 'Edge Transit',
    tierType: 5,
    slot: 'power',
    archetype: 'heavy-gl',
    poolsInclude: ['Bait and Switch', 'Envious Arsenal', 'Envious Assassin']
  },
  { name: 'Whisper of the Worm', tierType: 6, slot: 'power', archetype: 'sniper' },
  {
    name: 'Outbreak Perfected',
    tierType: 6,
    slot: 'kinetic',
    archetype: 'exotic-other',
    typeName: 'Pulse Rifle',
    ammoType: 1
  },
  { name: 'The Queenbreaker', tierType: 6, slot: 'power', archetype: 'linear-fusion' },
  { name: 'Apex Predator', tierType: 5, slot: 'power', archetype: 'rocket', poolsInclude: ['Bait and Switch'] },
  { name: 'Thunderlord', tierType: 6, slot: 'power', archetype: 'machine-gun' },
  {
    name: 'VS Chill Inhibitor',
    tierType: 5,
    slot: 'power',
    archetype: 'heavy-gl',
    // First run expected Envious Assassin here, from the weapon's 2024
    // release roll. The final manifest disagrees: the Edge of Fate refresh
    // put Envious Arsenal in column 3 and Envious Assassin is gone from
    // every VS Chill Inhibitor plug set. The manifest won.
    poolsInclude: ['Envious Arsenal', 'Bait and Switch']
  },
  {
    name: 'Indebted Kindness',
    tierType: 5,
    slot: 'energy',
    archetype: 'rocket-sidearm',
    frame: 'Micro-Missile Frame',
    ammoType: 2
  }
];

// -------------------------------------------------------------------- utils

const failures = [];
function fail(message) {
  failures.push(message);
  process.stderr.write('FAIL ' + message + '\n');
}

const disagreements = [];
function disagree(message) {
  disagreements.push(message);
  process.stderr.write('MANIFEST DISAGREES ' + message + ' (the manifest wins)\n');
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

const localItemTable = process.argv[2];
const componentsDir = process.argv[3];

function componentJson(name, urlPath) {
  if (componentsDir) {
    const p = path.join(componentsDir, name + '.json');
    if (fs.existsSync(p)) {
      process.stderr.write('reading ' + name + ' from ' + p + '\n');
      return Promise.resolve(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
  }
  process.stderr.write('downloading ' + name + '\n');
  return fetchJson('https://www.bungie.net' + urlPath);
}

process.stderr.write('reading the manifest index (keyless endpoint)\n');
const manifest = await fetchJson('https://www.bungie.net/Platform/Destiny2/Manifest/');
const version = manifest.Response.version;
const paths = manifest.Response.jsonWorldComponentContentPaths.en;
process.stderr.write('manifest version ' + version + '\n');

let itemText;
if (localItemTable) {
  process.stderr.write('reading item table from ' + localItemTable + '\n');
  itemText = fs.readFileSync(localItemTable, 'utf8');
} else {
  process.stderr.write('downloading ' + paths.DestinyInventoryItemDefinition + '\n');
  const response = await fetch('https://www.bungie.net' + paths.DestinyInventoryItemDefinition);
  if (!response.ok) throw new Error('item table HTTP ' + response.status);
  itemText = await response.text();
}
process.stderr.write('item table: ' + (itemText.length / 1048576).toFixed(0) + ' MB\n');

const [plugSetDefs, slotDefs, capDefs] = await Promise.all([
  componentJson('DestinyPlugSetDefinition', paths.DestinyPlugSetDefinition),
  componentJson('DestinyEquipmentSlotDefinition', paths.DestinyEquipmentSlotDefinition),
  componentJson('DestinyPowerCapDefinition', paths.DestinyPowerCapDefinition)
]);

// ------------------------------------------------- verify slot expectations

for (const expected of SLOT_EXPECTATIONS) {
  const def = slotDefs[String(expected.hash)];
  const got = def && def.displayProperties && def.displayProperties.name;
  if (got !== expected.name) {
    fail('equipment slot ' + expected.hash + ' is "' + got + '", expected "' + expected.name + '"');
  }
}
const slotByHash = new Map(SLOT_EXPECTATIONS.map((s) => [s.hash, s.slot]));

// ---------------------------------------------------- power caps, as found

const capByHash = new Map();
for (const [hash, def] of Object.entries(capDefs)) {
  capByHash.set(Number(hash), def.powerCap);
}
const distinctCaps = [...new Set(capByHash.values())].sort((a, b) => a - b);
process.stderr.write(
  'power caps in DestinyPowerCapDefinition: ' + distinctCaps.join(', ') + '\n'
);

// --------------------------------------------------------------- scan items

const wantedPerkNames = new Set(DAMAGE_PERKS.map((p) => p.name));

const nameByHash = new Map(); // every named entry, folded
const plugCatByHash = new Map(); // plug entries: hash -> plugCategoryIdentifier
const perkPlugMatches = new Map(); // damage perk name -> [{hash, enhanced}]
const candidates = []; // pruned weapon defs
let scanned = 0;
let unfoldableNames = 0;

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
  let name = toAscii(rawName);
  if (name === null) {
    // arsenal.json must carry EVERY weapon, so an unfoldable name is kept
    // raw (the ascii JSON writer escapes it) and counted for the report.
    name = String(rawName);
    unfoldableNames++;
  }
  nameByHash.set(hash, name);
  if (item.plug && item.plug.plugCategoryIdentifier) {
    plugCatByHash.set(hash, item.plug.plugCategoryIdentifier);
  }

  // Damage perk plugs: trait plugs share the display name between base and
  // enhanced; the itemTypeDisplayName tells them apart.
  if (wantedPerkNames.has(name) && item.plug && item.plug.plugCategoryIdentifier === 'frames') {
    const typeName = toAscii(item.itemTypeDisplayName || '') || '';
    if (typeName === 'Trait' || typeName === 'Enhanced Trait') {
      const list = perkPlugMatches.get(name) || [];
      list.push({ hash, enhanced: typeName === 'Enhanced Trait' });
      perkPlugMatches.set(name, list);
    }
  }

  // Weapon candidates, pruned to the fields the bake reads.
  if (item.itemType !== 3 || item.redacted) return;
  const tierType = item.inventory && item.inventory.tierType;
  if (tierType !== 5 && tierType !== 6) return;
  candidates.push({
    hash,
    name,
    icon: (item.displayProperties && item.displayProperties.icon) || '',
    tierType,
    slotHash: item.equippingBlock && item.equippingBlock.equipmentSlotTypeHash,
    ammoType: (item.equippingBlock && item.equippingBlock.ammoType) || 0,
    damageType: item.defaultDamageType || 0,
    classType: item.classType,
    typeName: toAscii(item.itemTypeDisplayName || '') || '',
    collectibleHash: item.collectibleHash,
    quality: item.quality,
    socketEntries: ((item.sockets && item.sockets.socketEntries) || []).map((e) => ({
      singleInitialItemHash: e.singleInitialItemHash,
      randomizedPlugSetHash: e.randomizedPlugSetHash,
      reusablePlugSetHash: e.reusablePlugSetHash,
      reusablePlugItems: e.reusablePlugItems
    }))
  });
});
process.stderr.write('scanned ' + scanned + ' definitions, ' + candidates.length + ' legendary/exotic weapons\n');

// ------------------------------------------------------------ plug set pools

const plugsOfSet = (setHash) => {
  const def = plugSetDefs[String(setHash)];
  if (!def || !Array.isArray(def.reusablePlugItems)) return null;
  return def.reusablePlugItems.map((p) => p.plugItemHash);
};

// ------------------------------------------------------------ build weapons

const weapons = [];
let sunsetExcluded = 0;
let legendariesOutsideArchetypes = 0;
const capsSeen = new Map(); // cap -> weapon version count, for the report

for (const c of candidates) {
  const cap = maxPowerCap(c, capByHash);
  if (cap !== null) capsSeen.set(cap, (capsSeen.get(cap) || 0) + 1);
  if (isSunset(c, capByHash)) {
    sunsetExcluded++;
    continue;
  }

  const { frame } = pickFrame(c.socketEntries, plugCatByHash, nameByHash);
  const archetype = classifyArchetype(c.typeName, c.ammoType, frame, c.tierType);
  if (archetype === null) {
    legendariesOutsideArchetypes++;
    continue;
  }

  const slot = slotByHash.get(c.slotHash);
  if (!slot) {
    fail(c.name + ' (' + c.hash + ') has unknown weapon slot hash ' + c.slotHash);
    continue;
  }

  const entry = {
    hash: c.hash,
    name: c.name,
    icon: shortenIcon(c.icon),
    tierType: c.tierType,
    slot,
    damageType: c.damageType,
    ammoType: c.ammoType,
    itemTypeDisplayName: c.typeName,
    archetype,
    frame
  };
  if (c.classType === 0 || c.classType === 1 || c.classType === 2) entry.classType = c.classType;
  if (c.collectibleHash !== undefined) entry.collectibleHash = c.collectibleHash;

  if (c.tierType === 5) {
    const columns = extractColumns(c.socketEntries, plugCatByHash, nameByHash, plugsOfSet);
    if (columns.length > 0) entry.columns = columns;
  }
  weapons.push(entry);
}

weapons.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.hash - b.hash));

// ------------------------------------------------------- damage perk hashes

const damagePerks = {};
for (const perk of DAMAGE_PERKS) {
  const matches = perkPlugMatches.get(perk.name) || [];
  const base = matches.filter((m) => !m.enhanced).map((m) => m.hash);
  const enhanced = matches.filter((m) => m.enhanced).map((m) => m.hash);
  if (base.length === 0) {
    fail('damage perk "' + perk.name + '" resolved to no base trait plug');
    continue;
  }
  if (enhanced.length === 0) {
    disagree('damage perk "' + perk.name + '" has no Enhanced Trait variant in the manifest');
  }
  damagePerks[perk.name] = {
    hashes: [...base, ...enhanced].sort((a, b) => a - b),
    note: perk.note,
    source: perk.source
  };
}

// ---------------------------------------------------------- perk name table

const perkNames = {};
const referencedPerkHashes = new Set();
for (const w of weapons) {
  for (const col of w.columns || []) {
    for (const h of col.perks) referencedPerkHashes.add(h);
  }
}
for (const entry of Object.values(damagePerks)) {
  for (const h of entry.hashes) referencedPerkHashes.add(h);
}
for (const h of [...referencedPerkHashes].sort((a, b) => a - b)) {
  const n = nameByHash.get(h);
  if (n === undefined) {
    fail('perk hash ' + h + ' appears in a pool but has no definition');
    continue;
  }
  perkNames[h] = n;
}

// ------------------------------------------------------------------- verify

// (a) ten spot checks. Missing weapon = fail; property disagreement = the
// manifest wins, printed and recorded.
const weaponsByName = new Map();
for (const w of weapons) {
  const list = weaponsByName.get(w.name) || [];
  list.push(w);
  weaponsByName.set(w.name, list);
}
const unionPools = (name) => {
  const set = new Set();
  for (const w of weaponsByName.get(name) || []) {
    for (const col of w.columns || []) for (const h of col.perks) set.add(h);
  }
  return set;
};

process.stderr.write('\n--- spot checks (10) ---\n');
for (const check of SPOT_CHECKS) {
  const defs = weaponsByName.get(check.name) || [];
  if (defs.length === 0) {
    fail('spot check: "' + check.name + '" is not in the arsenal at all');
    continue;
  }
  const problems = [];
  const scalarKeys = ['tierType', 'slot', 'archetype', 'frame', 'ammoType', 'typeName'];
  const fieldOf = (w, key) => (key === 'typeName' ? w.itemTypeDisplayName : w[key]);
  const satisfies = (w) => scalarKeys.every((k) => check[k] === undefined || fieldOf(w, k) === check[k]);
  if (!defs.some(satisfies)) {
    const w = defs[0];
    for (const k of scalarKeys) {
      if (check[k] !== undefined && !defs.some((d) => fieldOf(d, k) === check[k])) {
        problems.push(k + ' expected ' + JSON.stringify(check[k]) + ', manifest says ' + JSON.stringify(fieldOf(w, k)));
      }
    }
    if (problems.length === 0) {
      problems.push('no single definition satisfies all expected properties at once');
    }
  }
  for (const perkName of check.poolsInclude || []) {
    const hashes = (damagePerks[perkName] && damagePerks[perkName].hashes) || [];
    const pool = unionPools(check.name);
    if (!hashes.some((h) => pool.has(h))) {
      problems.push('pools were expected to include "' + perkName + '" and do not');
    }
  }
  if (problems.length === 0) {
    process.stderr.write('PASS ' + check.name + ' (' + defs.length + ' definition(s))\n');
  } else {
    for (const p of problems) disagree('spot check ' + check.name + ': ' + p);
  }
}

// (b) every damage-perk hash appears in at least one legendary pool.
const pooled = new Set();
for (const w of weapons) {
  for (const col of w.columns || []) for (const h of col.perks) pooled.add(h);
}
const poolMisses = [];
for (const [name, entry] of Object.entries(damagePerks)) {
  const missing = entry.hashes.filter((h) => !pooled.has(h));
  if (missing.length === entry.hashes.length) {
    if (ALLOWED_POOL_MISSES.has(name)) {
      disagree('damage perk "' + name + '" appears in no baked pool (allowed, see meta)');
      poolMisses.push(name + ': no hash pooled');
    } else {
      fail('damage perk "' + name + '" appears in NO baked weapon pool');
    }
  } else if (missing.length > 0) {
    // Some variants (usually a stray duplicate) may never be pooled; that is
    // manifest reality, worth a line in the report but not a dead build.
    disagree('damage perk "' + name + '" hash(es) ' + missing.join(', ') + ' appear in no baked pool');
    poolMisses.push(name + ': ' + missing.join(', '));
  }
}

// (c) weapons per archetype.
const countRows = [];
process.stderr.write('\n--- weapons per archetype (definitions, legendary/exotic) ---\n');
for (const key of ARCHETYPES) {
  const leg = weapons.filter((w) => w.archetype === key && w.tierType === 5).length;
  const exo = weapons.filter((w) => w.archetype === key && w.tierType === 6).length;
  countRows.push({ archetype: key, legendary: leg, exotic: exo });
  process.stderr.write(
    '  ' + key.padEnd(16) + String(leg).padStart(5) + String(exo).padStart(5) + String(leg + exo).padStart(7) + '\n'
  );
}
process.stderr.write(
  '  ' + 'total'.padEnd(16) +
    String(weapons.filter((w) => w.tierType === 5).length).padStart(5) +
    String(weapons.filter((w) => w.tierType === 6).length).padStart(5) +
    String(weapons.length).padStart(7) + '\n'
);

const legendariesWithoutTraitColumns = weapons.filter(
  (w) => w.tierType === 5 && !(w.columns || []).some((c) => c.kind === 'trait')
).length;

// -------------------------------------------------------------------- write

if (failures.length > 0) {
  process.stderr.write('\n' + failures.length + ' failure(s). Nothing was written, on purpose.\n');
  process.exit(1);
}

const capsSummary = [...capsSeen.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([cap, n]) => cap + ' (x' + n + ')')
  .join(', ');

const out = {
  manifestVersion: version,
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Generated by scripts/build-arsenal.mjs. Do not edit by hand. The game is frozen at 9.7.0.4; this file only changes if the bake rules do.',
  meta: {
    iconPrefix: ICON_PREFIX,
    iconNote:
      'Weapon icon values are relative to iconPrefix; a value starting with "/" kept its full manifest path.',
    rolls:
      'columns lists trait and origin perk pools per socket index for legendaries, hashes only; resolve display names through perkNames. Barrel and magazine columns are deliberately not baked: they do not decide whether an instance has a wanted damage roll, and dropping them keeps this file lazy-loadable.',
    sunset:
      'Power caps in the final manifest: ' + distinctCaps.join(', ') + '. Every legendary/exotic weapon version references an uncapped sentinel (>= ' + UNCAPPED_THRESHOLD + '), so the sunset filter excluded ' + sunsetExcluded + ' weapons. Sunsetting is dead in the frozen game; the filter stays as a guard.',
    weaponCaps: 'Caps referenced by baked weapons: ' + capsSummary + '.',
    skippedPerks:
      'Repulsor Brace (defensive, not a damage perk) and Master of Arms (no public post-9.7.0 source) are deliberately absent from damagePerks.',
    legendariesWithoutTraitColumns:
      legendariesWithoutTraitColumns +
      ' baked legendary definitions lack a trait pool. The "Randomized Perks" placeholder display copies in the manifest are itemType 0, not weapons, so they never enter the bake; the guard against the placeholder plug stays anyway.',
    spotCheckDisagreements: disagreements.filter((d) => d.startsWith('spot check')),
    poolMisses,
    counts: countRows
  },
  damagePerks,
  perkNames,
  weapons
};

const json = asciiJsonCompact(out) + '\n';
fs.writeFileSync(outPath, json);
const rawBytes = Buffer.byteLength(json);
const gzipBytes = zlib.gzipSync(Buffer.from(json)).length;
process.stderr.write('\nwrote ' + outPath + '\n');
process.stderr.write(
  'size: ' + (rawBytes / 1024).toFixed(1) + ' KB raw, ' + (gzipBytes / 1024).toFixed(1) + ' KB gzip' +
    (rawBytes > 600 * 1024 ? '  OVER the 600 KB budget' : '  (budget 600 KB)') + '\n'
);
process.stderr.write(
  weapons.length + ' weapons, ' + Object.keys(damagePerks).length + ' damage perks, ' +
    Object.keys(perkNames).length + ' named perk hashes, manifest ' + version + '\n'
);
process.stderr.write(
  'excluded: ' + sunsetExcluded + ' sunset, ' + legendariesOutsideArchetypes +
    ' legendaries outside the damage archetypes; ' + unfoldableNames + ' names kept unfolded\n'
);
if (disagreements.length > 0) {
  process.stderr.write(disagreements.length + ' manifest disagreement(s) recorded in meta; the manifest won each time.\n');
}
