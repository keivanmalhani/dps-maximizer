// Pure helpers for scripts/build-arsenal.mjs, split out so vitest can hold
// them to account without running the bake. No I/O in this file, on purpose.
//
// toAscii, scanEntries and the ascii JSON escaping follow
// scripts/build-data.mjs (which in turn follows
// weapon-report/scripts/build-weapon-pool.mjs). They are duplicated rather
// than imported from build-data.mjs because that script runs its bake at
// module load; importing it would fetch the manifest as a side effect.

/** Icon paths in the manifest all share this prefix; arsenal.json strips it. */
export const ICON_PREFIX = '/common/destiny2_content/icons/';

/**
 * The placeholder plug some Edge of Fate era definitions carry in a trait
 * socket instead of a plug set. It names no perk, so pools never include it.
 */
export const RANDOMIZED_PERKS_PLACEHOLDER = 'Randomized Perks';

/**
 * Power caps at or above this are the manifest's "no cap" sentinels
 * (999940..999990 in the final manifest). Anything below would mean sunset.
 */
export const UNCAPPED_THRESHOLD = 900000;

// The repository is ASCII only, and manifest names use U+2019 apostrophes.
// Fold what can be folded; return null for anything still outside ASCII so
// the caller can decide instead of smuggling a byte.
export function toAscii(name) {
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

/** Compact JSON with every non-ASCII code unit escaped, for the ASCII gate. */
export function asciiJsonCompact(value) {
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, (c) => {
    return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  });
}

// Streaming top-level scan of a huge JSON object, one entry at a time, so the
// ~190MB item table never has to be parsed whole. Verbatim from
// scripts/build-data.mjs.
export function scanEntries(text, onEntry) {
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

/** Strip the shared icon prefix; paths outside it pass through untouched. */
export function shortenIcon(path) {
  const p = String(path || '');
  return p.startsWith(ICON_PREFIX) ? p.slice(ICON_PREFIX.length) : p;
}

/**
 * The damage-relevant archetype for a weapon, or null when a legendary of
 * this shape does not belong in the arsenal.
 *
 * - Grenade launchers split on ammo: 3 (heavy) is 'heavy-gl', anything else
 *   (special breech loaders, and Fighting Lion's primary ammo) is 'breech-gl'.
 * - Rocket sidearms have no marker of their own in the manifest; their
 *   intrinsic is literally named "Micro-Missile Frame" (there is no
 *   "Rocket-Assisted Frame" item), so the frame name is the test.
 * - Exotics are always in: an exotic outside the damage archetypes gets
 *   'exotic-other' (catalyst-relevant primaries like Outbreak live there).
 */
export function classifyArchetype(typeName, ammoType, frameName, tierType) {
  const table = {
    'Rocket Launcher': 'rocket',
    'Linear Fusion Rifle': 'linear-fusion',
    'Machine Gun': 'machine-gun',
    'Sword': 'sword',
    'Sniper Rifle': 'sniper',
    'Fusion Rifle': 'fusion',
    'Trace Rifle': 'trace',
    'Glaive': 'glaive'
  };
  let key = table[typeName] ?? null;
  if (typeName === 'Grenade Launcher') key = ammoType === 3 ? 'heavy-gl' : 'breech-gl';
  if (typeName === 'Sidearm') key = frameName === 'Micro-Missile Frame' ? 'rocket-sidearm' : null;
  if (key === null && tierType === 6) key = 'exotic-other';
  return key;
}

/** Every archetype key classifyArchetype can produce. */
export const ARCHETYPES = [
  'rocket',
  'heavy-gl',
  'breech-gl',
  'linear-fusion',
  'machine-gun',
  'sword',
  'sniper',
  'fusion',
  'trace',
  'glaive',
  'rocket-sidearm',
  'exotic-other'
];

/**
 * The highest power cap any version of the item reaches, or null when the
 * definition carries no quality.versions at all.
 */
export function maxPowerCap(def, capByHash) {
  const versions = (def.quality && def.quality.versions) || [];
  let max = null;
  for (const v of versions) {
    const cap = capByHash.get(v.powerCapHash);
    if (typeof cap === 'number' && (max === null || cap > max)) max = cap;
  }
  return max;
}

/**
 * Sunset means every version is stuck below the uncapped sentinel. A missing
 * quality block counts as not sunset: no cap recorded means no cap.
 */
export function isSunset(def, capByHash) {
  const max = maxPowerCap(def, capByHash);
  return max !== null && max < UNCAPPED_THRESHOLD;
}

/**
 * The intrinsic frame, same rule as build-data.mjs: the socket whose initial
 * plug sits in the 'intrinsics' plug category, preferring one named
 * "* Frame". A randomized intrinsic (Ergo Sum rolls its frame) yields null
 * with randomized=true so the caller can say so instead of guessing.
 */
export function pickFrame(socketEntries, plugCatByHash, nameByHash) {
  const intrinsics = (socketEntries || []).filter(
    (e) => plugCatByHash.get(e.singleInitialItemHash) === 'intrinsics'
  );
  const preferred =
    intrinsics.find((e) => /\sFrame$/.test(nameByHash.get(e.singleInitialItemHash) || '')) ||
    intrinsics[0];
  if (!preferred) return { frame: null, randomized: false };
  if (preferred.randomizedPlugSetHash) return { frame: null, randomized: true };
  return { frame: nameByHash.get(preferred.singleInitialItemHash) ?? null, randomized: false };
}

/**
 * The perk columns worth baking: trait columns (plug category 'frames') and
 * the origin trait column (plug category 'origins'). Barrels, magazines,
 * cosmetics, masterworks and crafting sockets never classify and are skipped.
 *
 * For each socket entry the pool is, in order of preference: the randomized
 * plug set, the reusable plug set, the entry's inline reusablePlugItems, and
 * finally the single initial plug (fixed-roll weapons have real traits there).
 * The "Randomized Perks" placeholder plug is display chrome, not a perk, and
 * is dropped; a column whose pool comes out empty is not emitted.
 *
 * Returns [{ i, kind, perks }] with i the socket index, kind 'trait' or
 * 'origin', perks sorted ascending.
 */
export function extractColumns(socketEntries, plugCatByHash, nameByHash, plugsOfSet) {
  const out = [];
  (socketEntries || []).forEach((entry, i) => {
    const setHash = entry.randomizedPlugSetHash || entry.reusablePlugSetHash;
    let pool = setHash ? plugsOfSet(setHash) || [] : [];
    if (pool.length === 0 && Array.isArray(entry.reusablePlugItems) && entry.reusablePlugItems.length > 0) {
      pool = entry.reusablePlugItems.map((p) => p.plugItemHash);
    }
    if (pool.length === 0 && entry.singleInitialItemHash) {
      pool = [entry.singleInitialItemHash];
    }
    let kind = null;
    const seen = new Set();
    const perks = [];
    for (const hash of pool) {
      const cat = plugCatByHash.get(hash);
      if (cat !== 'frames' && cat !== 'origins') continue;
      if (nameByHash.get(hash) === RANDOMIZED_PERKS_PLACEHOLDER) continue;
      if (seen.has(hash)) continue;
      seen.add(hash);
      perks.push(hash);
      if (cat === 'origins') kind = 'origin';
      else if (kind === null) kind = 'trait';
    }
    if (kind === null || perks.length === 0) return;
    perks.sort((a, b) => a - b);
    out.push({ i, kind, perks });
  });
  return out;
}
