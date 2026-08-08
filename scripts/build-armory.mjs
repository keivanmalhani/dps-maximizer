// Bake the whole armory: every weapon and armour piece in the game, plus the
// plugs that appear in their sockets, trimmed to what a grid actually draws.
//
// WHY THIS IS A BAKE AND NOT A RUNTIME DOWNLOAD
//
// DIM downloads DestinyInventoryItemDefinition on first run and keeps it in
// IndexedDB. That table is 199 MB of JSON, measured 2026-08-08 against
// manifest 244213.26.06.29.2000-1-bnet.65583, and the download is why a new
// DIM tab sits on a progress bar the first time you open it.
//
// It has to work that way because Destiny used to change every season. This
// site does not, because the game stopped: the last content update was 9.7.0
// on 9 June 2026 and the last hotfix 9.7.0.4 on 28 July 2026. A frozen game
// turns a cache-invalidation problem into a build step. So the table is
// trimmed at build time, shipped as one static asset, and the grid paints on
// the first frame with nothing to download.
//
// The trim is aggressive on purpose. Each item is an ARRAY, not an object,
// because 8000 repetitions of the same nine keys is most of the file. The
// field order is documented below and mirrored in src/armory.ts, and there is
// a test that fails if the two disagree.
//
// Usage:
//   node scripts/build-armory.mjs
//   node scripts/build-armory.mjs /path/to/DestinyInventoryItemDefinition.json
//
// The second form skips the download when the table is already on disk, which
// is the difference between a two second run and a thirty second one.

import { asciiJsonCompact } from './lib/arsenal-lib.mjs';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'data', 'armory.json');
const OUT_PLUGS = join(HERE, '..', 'src', 'data', 'armory-plugs.json');
const API_KEY = 'fe8c4f1f1a404e2e80b9e61924352167';

// Destiny's own enumerations, spelled out so the reader does not have to look
// them up. Source: BungieNetPlatform DestinyItemType and DestinyItemSubType.
const ITEM_TYPE_ARMOR = 2;
const ITEM_TYPE_WEAPON = 3;

// The field order of one baked item row. src/armory.ts reads by these indexes
// and tests/armory-data.test.ts asserts this list against the reader.
export const ITEM_FIELDS = [
  'name',        // 0  displayProperties.name
  'icon',        // 1  displayProperties.icon, relative to the icon prefix
  'bucket',      // 2  inventory.bucketTypeHash, where it lives
  'tier',        // 3  inventory.tierType, 6 is exotic and 5 legendary
  'type',        // 4  itemType, 2 armour and 3 weapon
  'sub',         // 5  itemSubType, the frame family
  'klass',       // 6  classType, 0 Titan 1 Hunter 2 Warlock 3 any
  'damage',      // 7  defaultDamageType
  'typeName',    // 8  itemTypeDisplayName, the words under the name in game
  'ammo',        // 9  equippingBlock.ammoType
  'slot'         // 10 equippingBlock.equipmentSlotTypeHash
];

const ICON_PREFIX = '/common/destiny2_content/icons/';

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'X-API-Key': API_KEY } });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' from ' + url);
  return response.json();
}

/** Strip the shared prefix so 8000 rows do not each carry the same 40 bytes. */
function shortIcon(icon) {
  if (!icon) return '';
  return icon.startsWith(ICON_PREFIX) ? icon.slice(ICON_PREFIX.length) : icon;
}

/** displayProperties.name, or empty. Unnamed definitions are never shown. */
function nameOf(def) {
  return (def && def.displayProperties && def.displayProperties.name) || '';
}

async function loadTable(paths, key, cacheHint) {
  if (cacheHint && existsSync(cacheHint)) {
    process.stderr.write('reading ' + cacheHint + '\n');
    return JSON.parse(readFileSync(cacheHint, 'utf8'));
  }
  const url = 'https://www.bungie.net' + paths[key];
  process.stderr.write('downloading ' + key + '\n');
  return fetchJson(url);
}

const manifest = await fetchJson('https://www.bungie.net/Platform/Destiny2/Manifest/');
const version = manifest.Response.version;
const paths = manifest.Response.jsonWorldComponentContentPaths.en;

const itemCache = process.argv[2] || null;
const items = await loadTable(paths, 'DestinyInventoryItemDefinition', itemCache);
const buckets = await loadTable(paths, 'DestinyInventoryBucketDefinition', null);
const damages = await loadTable(paths, 'DestinyDamageTypeDefinition', null);
const stats = await loadTable(paths, 'DestinyStatDefinition', null);
const tiers = await loadTable(paths, 'DestinyItemTierTypeDefinition', null);

// --------------------------------------------------------------- the items

const bakedItems = {};
const socketPlugHashes = new Set();

for (const [hash, def] of Object.entries(items)) {
  const type = def.itemType;
  if (type !== ITEM_TYPE_ARMOR && type !== ITEM_TYPE_WEAPON) continue;
  const name = nameOf(def);
  if (!name) continue;
  // Redacted definitions are placeholders Bungie has not published yet. They
  // carry a name of "Classified" and no useful fields, and a grid that draws
  // them is a grid full of grey squares.
  if (def.redacted) continue;

  const inv = def.inventory || {};
  const eq = def.equippingBlock || {};
  bakedItems[hash] = [
    name,
    shortIcon(def.displayProperties && def.displayProperties.icon),
    inv.bucketTypeHash || 0,
    inv.tierType || 0,
    type,
    def.itemSubType || 0,
    def.classType === undefined ? 3 : def.classType,
    def.defaultDamageType || 0,
    def.itemTypeDisplayName || '',
    eq.ammoType || 0,
    eq.equipmentSlotTypeHash || 0
  ];

  // Collect every plug this item's sockets can hold, so the plug table below
  // is exactly the set the detail panel can be asked to name and nothing
  // more. Walking sockets is what keeps the plug bake at a few hundred KB
  // instead of the ten thousand plugs in the game.
  for (const entry of (def.sockets && def.sockets.socketEntries) || []) {
    if (entry.singleInitialItemHash) socketPlugHashes.add(entry.singleInitialItemHash);
    for (const option of entry.reusablePlugItems || []) {
      if (option.plugItemHash) socketPlugHashes.add(option.plugItemHash);
    }
    if (entry.randomizedPlugSetHash) socketPlugHashes.add('set:' + entry.randomizedPlugSetHash);
    if (entry.reusablePlugSetHash) socketPlugHashes.add('set:' + entry.reusablePlugSetHash);
  }
}

// Plug sets are indirection: a socket points at a set, the set lists the
// plugs. Resolve them so a random roll's perks can be named.
const plugSets = await loadTable(paths, 'DestinyPlugSetDefinition', null);
for (const marker of [...socketPlugHashes]) {
  if (typeof marker !== 'string') continue;
  socketPlugHashes.delete(marker);
  const set = plugSets[marker.slice(4)];
  for (const entry of (set && set.reusablePlugItems) || []) {
    if (entry.plugItemHash) socketPlugHashes.add(entry.plugItemHash);
  }
}

const bakedPlugs = {};
for (const hash of socketPlugHashes) {
  const def = items[String(hash)];
  if (!def || def.redacted) continue;
  const name = nameOf(def);
  if (!name) continue;
  bakedPlugs[hash] = [
    name,
    shortIcon(def.displayProperties && def.displayProperties.icon),
    (def.displayProperties && def.displayProperties.description) || '',
    (def.plug && def.plug.plugCategoryIdentifier) || ''
  ];
}

// ------------------------------------------------------- the small tables

const bakedBuckets = {};
for (const [hash, def] of Object.entries(buckets)) {
  const name = nameOf(def);
  if (!name) continue;
  bakedBuckets[hash] = [name, def.category || 0, def.bucketOrder || 0, def.itemCount || 0];
}

const bakedDamage = {};
for (const [hash, def] of Object.entries(damages)) {
  const name = nameOf(def);
  if (!name) continue;
  bakedDamage[hash] = [name, shortIcon(def.displayProperties && def.displayProperties.icon), def.enumValue || 0];
}

const bakedStats = {};
for (const [hash, def] of Object.entries(stats)) {
  const name = nameOf(def);
  if (!name) continue;
  bakedStats[hash] = name;
}

const bakedTiers = {};
for (const [hash, def] of Object.entries(tiers)) {
  const name = nameOf(def);
  if (!name) continue;
  bakedTiers[hash] = name;
}

const payload = {
  manifestVersion: version,
  generated: new Date().toISOString().slice(0, 10),
  note:
    'Generated by scripts/build-armory.mjs. Do not edit by hand. The game is ' +
    'frozen at 9.7.0.4, so this file only changes if the bake rules do.',
  meta: {
    iconPrefix: ICON_PREFIX,
    itemFields: ITEM_FIELDS,
    plugFields: ['name', 'icon', 'description', 'category'],
    bucketFields: ['name', 'category', 'order', 'capacity'],
    damageFields: ['name', 'icon', 'enum']
  },
  buckets: bakedBuckets,
  damage: bakedDamage,
  stats: bakedStats,
  tiers: bakedTiers,
  items: bakedItems
};

// The plug table is bigger than everything else combined, because a perk
// carries its description and there are nearly ten thousand of them. Nothing
// on the grid needs it: names and descriptions are only read when a detail
// panel opens. So it ships as a second file and is fetched the first time a
// visitor clicks an item, which keeps the grid's cost to the items table.
const plugPayload = {
  manifestVersion: version,
  generated: payload.generated,
  note: payload.note,
  meta: { iconPrefix: ICON_PREFIX, plugFields: payload.meta.plugFields },
  plugs: bakedPlugs
};

// ASCII only, repository wide, so the CI gate stays honest. Item names carry
// accents and typographic quotes straight out of the manifest, and escaping
// them as \uXXXX keeps the file byte identical in meaning while remaining
// greppable ASCII. JSON.parse turns them back into the real characters, so
// nothing downstream needs to know this happened.
const text = asciiJsonCompact(payload);
const plugText = asciiJsonCompact(plugPayload);
writeFileSync(OUT, text);
writeFileSync(OUT_PLUGS, plugText);

const report = (label, path, count, body) =>
  label.padEnd(8) +
  String(count).padStart(6) +
  '  ' +
  String(body.length).padStart(9) +
  ' bytes  ' +
  String(gzipSync(Buffer.from(body), { level: 9 }).length).padStart(8) +
  ' gzipped  ' +
  path +
  '\n';

process.stderr.write(
  report('items', OUT, Object.keys(bakedItems).length, text) +
    report('plugs', OUT_PLUGS, Object.keys(bakedPlugs).length, plugText) +
    'buckets ' + Object.keys(bakedBuckets).length + '\n'
);
