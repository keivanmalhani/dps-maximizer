// The curated damage dataset. Researched against the sources named on every
// entry, frozen deliberately: Destiny 2 stopped receiving content updates on
// 9 June 2026 (Update 9.7.0; final hotfix 9.7.0.4 on 28 July 2026), so the
// meta this file describes is the meta forever. A static curated list is not
// a compromise here, it is the correct architecture.
//
// HONESTY RULES, and they are the whole point of the site:
//
// - No invented numbers. The Aegis spreadsheet's numeric ranking tabs are
//   hidden mid-rebuild as of this writing, so no trustworthy public per-weapon
//   DPS figures exist. Items are ranked by TIER with the sheet's own quoted
//   reasoning. Where a percentage appears anywhere in this repo it is marked
//   verified with its source; everything else says pending.
// - `quote` is the Aegis equipment-tab annotation, verbatim, when the sheet
//   has one. Entries the sheet tiers without annotating get `quote: null` and
//   an honest note instead. No quotes were written for it.
// - Every entry carries `source`.
//
// Slots, frames, class locks and icons are NOT stated here: they are manifest
// facts, resolved at build time by scripts/build-data.mjs into
// src/data/items.json, so nobody's memory of which slot a gun sits in can
// quietly recommend the wrong loadout.

import type { Activity, GuardianClass, Tier } from '../types';

export const DATA_STAMP =
  'Data current as of Update 9.7.0.4, 28 July 2026. The game no longer receives balance patches, so this does not go stale.';

/** The tier list's own provenance, shown wherever tiers are shown. */
export const TIER_SOURCE = 'Aegis boss damage sheet, equipment tab, 2026-07';

export interface WantedRoll {
  /**
   * Perk columns. An instance has the roll when every column matches at least
   * one of its plugs. Names resolve to plug hashes (base and enhanced) at
   * build time.
   */
  columns: string[][];
  note: string;
  source: string;
}

export interface Pairing {
  withId: string;
  note: string;
  source: string;
}

export interface CuratedItem {
  /** Stable slug. Keys items.json, ownership and the tests. */
  id: string;
  /** Exact display name, ASCII-folded the way the whole repo is. */
  name: string;
  kind: 'weapon' | 'armor';
  exotic: boolean;
  /** null = not on the tier sheet; `tierLabel` says where it came from. */
  tier: Tier | null;
  tierLabel: string;
  /** The Aegis annotation, verbatim, or null when the sheet has none. */
  quote: string | null;
  /** Plain words on why this entry is here. Always present. */
  note: string;
  source: string;
  /** Activities this entry is recommended for. Never 'pvp'. */
  roles: Activity[];
  /**
   * True for entries whose value is what they do for the fireteam rather
   * than for your own damage slot: debuffs and ally buffs. The engine
   * surfaces these as a fireteam note, not as your weapon pick.
   */
  supportOnly?: boolean;
  /** Armor only. Also baked from the manifest; kept here for the tests. */
  classType?: GuardianClass;
  wantedRoll?: WantedRoll;
  /** The catalyst changes how the weapon earns its tier. */
  catalystMatters?: boolean;
  pairing?: Pairing;
  /** Where it comes from, in words a player can act on. */
  acquisition: string;
  /** Buyable at the Monument to Lost Lights for an Exotic Cipher. */
  monument?: boolean;
}

const AEGIS = TIER_SOURCE;
const AEGIS_FAQ = 'Aegis FAQ';
const DEV_0604 = 'Bungie dev insight 2026-06-04';

export const CURATED: CuratedItem[] = [
  // ------------------------------------------------------------------ tier 1
  {
    id: 'hezen-vengeance',
    name: 'Hezen Vengeance',
    kind: 'weapon',
    exotic: false,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Best general burst damage.',
    note:
      'The rocket every burst rotation is built around. It is a legendary, so the exotic slot stays free for Still Hunt, Izanagi or Witherhoard.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    wantedRoll: {
      columns: [
        ['Overflow', 'Envious Assassin'],
        ['Bait and Switch', 'Cluster Bomb', 'Elemental Honing']
      ],
      note: 'Overflow or Envious Assassin in the first column, Bait and Switch or Cluster Bomb or Elemental Honing in the second.',
      source: AEGIS
    },
    pairing: {
      withId: 'gjallarhorn',
      note: 'One Gjallarhorn in the fireteam adds Wolfpack Rounds, roughly 25 to 30 percent on base rocket damage (verified).',
      source: AEGIS_FAQ
    },
    acquisition:
      'Drops in the Vault of Glass raid; the Timelost version comes from Master challenges. A legendary cannot be pulled from Collections with a roll, so this one needs a drop.'
  },
  {
    id: 'cuirass-of-the-falling-star',
    name: 'Cuirass of the Falling Star',
    kind: 'armor',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Zero effort for best damage super in the game',
    note: 'Doubles Thundercrash damage. Fly in, hit the boss, walk away.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'],
    classType: 0,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on chest days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'celestial-nighthawk',
    name: 'Celestial Nighthawk',
    kind: 'armor',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Solid damage super with great ranged burst',
    note:
      'Turns Golden Gun into one enormous shot, and refunds super energy on the kill. Pairs with Still Hunt, which carries its own miniature Golden Gun.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'],
    classType: 1,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on helmet days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'ergo-sum',
    name: 'Ergo Sum',
    kind: 'weapon',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Best sword damage when Transcendent',
    note:
      'The Perfect Fifth roll is the one the tier is about. A special-ammo sword in the kinetic slot, so it costs no heavy and no exotic armor synergy.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    wantedRoll: {
      columns: [['The Perfect Fifth']],
      note: 'The tier is for the Perfect Fifth roll specifically; the manifest spells the perk "The Perfect Fifth".',
      source: AEGIS
    },
    acquisition:
      'The Final Shape: finish Destined Heroes, then repeatable rolls drop from Excision and dungeon chests. Rolls are random, so the Perfect Fifth version needs drops.'
  },
  {
    id: 'sanguine-alchemy',
    name: 'Sanguine Alchemy',
    kind: 'armor',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Best damage armor exotic, free 10% for doing nothing.',
    note: 'Stand near your rift, shoot the boss, take the ten percent. The number is the sheet\'s, not ours.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions'],
    classType: 2,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on chest days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'tractor-cannon',
    name: 'Tractor Cannon',
    kind: 'weapon',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Easiest long-term 30% debuff source',
    note:
      'The 30 percent weaken is verified and multiplies with everyone\'s buffs. One player runs this so five players hit harder; it is a fireteam job, not a personal damage slot.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'master-champions'],
    supportOnly: true,
    acquisition: 'World exotic: exotic engrams or Rahool focusing. Pullable from Collections once unlocked.'
  },
  {
    id: 'gjallarhorn',
    name: 'Gjallarhorn',
    kind: 'weapon',
    exotic: true,
    tier: 1,
    tierLabel: 'Tier 1',
    quote: 'Exists to augment Hezen users.',
    note:
      'Wolfpack Rounds buff every other rocket in the fireteam, roughly 25 to 30 percent on base rocket damage (verified). One per fireteam; everyone else brings Hezen.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    pairing: {
      withId: 'hezen-vengeance',
      note: 'The pairing runs both ways: Gjallarhorn is tier 1 because of what it does for the Hezen users around it.',
      source: AEGIS_FAQ
    },
    acquisition: 'Grasp of Avarice dungeon quest (And Out Fly the Wolves), from the 30th Anniversary pack.'
  },

  // ------------------------------------------------------------------ tier 2
  {
    id: 'edge-transit',
    name: 'Edge Transit',
    kind: 'weapon',
    exotic: false,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'Highest legendary burst DPS in the game (with stickies)',
    note:
      'A heavy grenade launcher with sticky grenades. The sheet tiers the weapon; it does not quote a roll for it, so roll guidance here would be invented and is not offered.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition:
      'Onslaught\'s BRAVE arsenal reissue, or the world legendary pool. A legendary cannot be pulled from Collections with a roll.'
  },
  {
    id: 'praedyths-revenge',
    name: "Praedyth's Revenge",
    kind: 'weapon',
    exotic: false,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'Best legendary sniper... pairs great with Tractor/Gjallarhorn',
    note: 'A kinetic-slot legendary sniper, so it stacks with an exotic special and whatever the fireteam is debuffing with.',
    source: AEGIS,
    roles: ['boss-sustained', 'boss-burst', 'master-champions'],
    acquisition:
      'Drops in the Vault of Glass raid; Timelost from Master challenges. Needs a drop; Collections will not give a legendary its roll back.'
  },
  {
    id: 'the-queenbreaker',
    name: 'The Queenbreaker',
    kind: 'weapon',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'Great damage profile and ease of use',
    note: 'Point the linear fusion at the crit spot and hold. One of the least demanding sustained options that is still tiered.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'thunderlord',
    name: 'Thunderlord',
    kind: 'weapon',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'buffed into relevance',
    note: 'A machine gun you can feed for a whole damage phase without reloading your brain. Also clears adds while it waits.',
    source: AEGIS,
    roles: ['boss-sustained', 'add-clear', 'master-champions'],
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'still-hunt',
    name: 'Still Hunt',
    kind: 'weapon',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'Still solid burst post-nerf',
    note:
      'A sniper that charges its own Golden Gun. On a Hunter wearing Celestial Nighthawk the weapon\'s super shot inherits the one-shot treatment, which is the pairing the tier is about.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition: 'The Final Shape campaign, then the Wild Card quest from the Spirit of Riven.'
  },
  {
    id: 'izanagis-burden',
    name: "Izanagi's Burden",
    kind: 'weapon',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: null,
    note:
      'Tier 2 on the sheet, no annotation quoted. Honed Edge folds the magazine into one oversized shot, which is why it anchors swap rotations. The catalyst matters to that job.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'master-champions'],
    catalystMatters: true,
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'lumina',
    name: 'Lumina',
    kind: 'weapon',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: '35% damage buff',
    note:
      'The 35 percent is verified. Noble Rounds buff one ally, and the buff is an empowering buff: it does not stack with Well or Radiant, it replaces them as the highest. One support player runs this.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'master-champions'],
    supportOnly: true,
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'no-hesitation',
    name: 'No Hesitation',
    kind: 'weapon',
    // The manifest says Legendary, whatever anyone assumes about a weapon
    // this good; the build-time bake is what caught this.
    exotic: false,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: '10% universally stackable buff',
    note:
      'The 10 percent is verified, and it is the one buff in the game that stacks with everything, including Well and Lumina. Heal a teammate, they hit harder. A support slot, not a damage slot.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'master-champions'],
    supportOnly: true,
    acquisition:
      'A Final Shape legendary support auto rifle: drops in the Pale Heart and from world sources. A legendary cannot be pulled from Collections with a roll.'
  },
  {
    id: 'lunafaction-boots',
    name: 'Lunafaction Boots',
    kind: 'armor',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: null,
    note:
      'Tier 2 on the sheet, no annotation quoted. Your rift reloads the fireteam\'s weapons where they stand, which turns every rotation on this page into a faster one.',
    source: AEGIS,
    roles: ['boss-burst', 'boss-sustained', 'master-champions'],
    classType: 2,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on leg days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'synthoceps',
    name: 'Synthoceps',
    kind: 'armor',
    exotic: true,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: null,
    note:
      'Tier 2 on the sheet, no annotation quoted. Biotic Enhancements buff melee and super damage when surrounded, which is most of what a boss room is.',
    source: AEGIS,
    roles: ['boss-burst', 'add-clear', 'master-champions'],
    classType: 0,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on arm days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'vs-chill-inhibitor',
    name: 'VS Chill Inhibitor',
    kind: 'weapon',
    exotic: false,
    tier: 2,
    tierLabel: 'Tier 2',
    quote: 'Worse off thanks to HGL nerf',
    note:
      'Still tiered, but the sheet\'s own annotation is a warning: the heavy grenade launcher nerf took the shine off. Edge Transit is the legendary GL to chase first.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition:
      'Drops in the Vesper\'s Host dungeon. A legendary cannot be pulled from Collections with a roll.'
  },

  // ------------------------------------------------------------------ tier 3
  {
    id: 'divinity',
    name: 'Divinity',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: 'still useful in high-pressure environments for Thunderlord/Queenbreaker',
    note:
      'Makes a crit bubble anyone can hit and weakens the target. WARNING, hard-coded on purpose: since hotfix 9.7.0.3 Divinity deals zero damage to Insurrection Prime and its cage does not damage him; it works everywhere else. The page repeats this wherever Divinity is recommended.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    supportOnly: true,
    acquisition: 'Garden of Salvation raid. The in-game Journey tab shows the current path.'
  },
  {
    id: 'anarchy',
    name: 'Anarchy',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: null,
    note:
      'Tier 3 on the sheet, no annotation quoted. Stick two traps on the boss and swap away; the damage ticks while you do something else.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'apex-predator',
    name: 'Apex Predator',
    kind: 'weapon',
    exotic: false,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: null,
    note:
      'Tier 3 on the sheet, no annotation quoted. The legendary rocket you run when Hezen Vengeance has not dropped yet.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition:
      'Drops in the Last Wish raid. A legendary cannot be pulled from Collections with a roll.'
  },
  {
    id: 'witherhoard',
    name: 'Witherhoard',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: 'Great long-term DoT for Envious rotations',
    note:
      'Fire one shot at the boss, swap away, and the blight keeps ticking. The classic filler shot for keeping Envious weapons overflowed.',
    source: AEGIS,
    roles: ['boss-sustained', 'boss-burst', 'add-clear', 'master-champions'],
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'outbreak-perfected',
    name: 'Outbreak Perfected',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: 'Best fireteam-wide sustained primary damage',
    note:
      'Nanite swarms scale with how many people are shooting the same target, so it gets better the more of the fireteam runs it. Costs no special or heavy ammo.',
    source: AEGIS,
    roles: ['boss-sustained', 'add-clear', 'master-champions'],
    catalystMatters: true,
    acquisition: 'Zero Hour exotic mission, from the Into the Light reprise.'
  },
  {
    id: 'winterbite',
    name: 'Winterbite',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: null,
    note:
      'Tier 3 on the sheet, no annotation quoted. A heavy glaive, so the damage happens at melee range; bring it where standing next to the boss is survivable.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition:
      'Exotic quest gear from the Lightfall year. The in-game Journey tab or Monument shows its current source; this one has moved before.'
  },
  {
    id: 'briarbinds',
    name: 'Briarbinds',
    kind: 'armor',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: 'Best ability-based debuff extension in the game',
    note:
      'Void souls last longer and can be picked back up, which keeps a weaken on the boss without spending a weapon slot on it.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    supportOnly: true,
    classType: 2,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on arm days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'cloudstrike',
    name: 'Cloudstrike',
    kind: 'weapon',
    exotic: true,
    tier: 3,
    tierLabel: 'Tier 3',
    quote: null,
    note:
      'Tier 3 on the sheet, no annotation quoted. Precision hits summon lightning, which makes one good sniper into splash damage.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    acquisition: 'Empire Hunts on Europa (Beyond Light), as a random drop.'
  },

  // ------------------------------------------------------------------ tier 4
  {
    id: 'one-thousand-voices',
    name: 'One Thousand Voices',
    kind: 'weapon',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: 'Probably the easiest high damage exotic to use in the game',
    note: 'Hold the trigger, paint the boss with fire. If a rotation sounds like homework, start here.',
    source: AEGIS,
    roles: ['boss-burst', 'add-clear', 'master-champions'],
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'whisper-of-the-worm',
    name: 'Whisper of the Worm',
    kind: 'weapon',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: 'Overshadowed by Queenbreaker',
    note:
      'White Nail refunds the magazine on perfect crits, so it is still the infinite-ammo sniper; the sheet just ranks The Queenbreaker above it for the same job.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    catalystMatters: true,
    acquisition: 'The Whisper exotic mission, from the Into the Light reprise.'
  },
  {
    id: 'grand-overture',
    name: 'Grand Overture',
    kind: 'weapon',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: null,
    note:
      'Tier 4 on the sheet, no annotation quoted. Charge the volley, dump the missiles, repeat.',
    source: AEGIS,
    roles: ['boss-sustained', 'master-champions'],
    catalystMatters: true,
    acquisition: 'Monument to Lost Lights (Tower), for an Exotic Cipher plus materials.',
    monument: true
  },
  {
    id: 'lucky-pants',
    name: 'Lucky Pants',
    kind: 'armor',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: null,
    note:
      'Tier 4 on the sheet, no annotation quoted. Ramps hand cannon damage on every ready; a whole build in one pair of trousers, but a build this dataset does not carry the hand cannons for.',
    source: AEGIS,
    roles: ['boss-sustained'],
    classType: 1,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on leg days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'star-eater-scales',
    name: 'Star-Eater Scales',
    kind: 'armor',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: null,
    note:
      'Tier 4 on the sheet, no annotation quoted. Feast on orbs, cash the overcharged super. On a Hunter the sheet still points at Celestial Nighthawk first.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    classType: 1,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on leg days, or focus exotic engrams at Rahool.'
  },
  {
    id: 'finalitys-auger',
    name: "Finality's Auger",
    kind: 'weapon',
    exotic: true,
    tier: 4,
    tierLabel: 'Tier 4',
    quote: null,
    note: 'Tier 4 on the sheet, no annotation quoted.',
    source: AEGIS,
    roles: ['boss-burst', 'master-champions'],
    acquisition: 'Drops in The Desert Perpetual raid, from The Edge of Fate.'
  },

  // -------------------------------------------------- untiered, class notes
  {
    id: 'shards-of-galanor',
    name: 'Shards of Galanor',
    kind: 'armor',
    exotic: true,
    tier: null,
    tierLabel: 'Reworked in 9.7.0',
    quote: null,
    note:
      'Not on the tier sheet. Bungie\'s final dev insight reworked it so a 5-of-7-knife Blade Barrage lands in the same neighbourhood as Cuirass Thundercrash for Solar burst. Offered here as the Hunter fallback when Celestial Nighthawk is missing.',
    source: DEV_0604,
    roles: ['boss-burst', 'master-champions'],
    classType: 1,
    acquisition:
      'Exotic armor: solo Legend or Master Lost Sectors on arm days, or focus exotic engrams at Rahool.'
  }
];

export const CURATED_BY_ID: ReadonlyMap<string, CuratedItem> = new Map(
  CURATED.map((item) => [item.id, item])
);

/** Perk names the roll checks need, resolved to plug hashes at build time. */
export const WANTED_PERK_NAMES: string[] = [
  ...new Set(CURATED.flatMap((item) => item.wantedRoll?.columns.flat() ?? []))
];

/**
 * Exotics whose catalyst state the page reports. Read from instance sockets
 * where possible; anything else is reported as unknown rather than guessed.
 */
export const CATALYST_IDS: string[] = CURATED.filter((i) => i.catalystMatters).map((i) => i.id);
