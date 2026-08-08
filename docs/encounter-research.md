# Encounter database research brief, compiled 2026-08-08

Source-tagged research for the encounter-aware build. Confidence codes:
V = verified this session against the cited source. L = likely, long-stable
community knowledge consistent with cited sources. C = contested or sources
silent. NOTHING marked C or absent here may be stated as fact on the site.

Manifest version at compile: 244213.26.06.29.2000-1-bnet.65583.
Final sandbox: locked at 9.7.0.3 (2026-07-07); 9.7.0.4 (2026-07-28) changed
nothing in PvE.

## THE PLAYABLE CATALOG (corrected; the mode-field derivation was wrong)

RAIDS (10): Vault of Glass, King's Fall, Last Wish, Garden of Salvation,
Deep Stone Crypt, Vow of the Disciple, Root of Nightmares, Crota's End,
Salvation's Edge, The Desert Perpetual (plus The Desert Perpetual (Epic) as
a distinct harder version). [manifest milestones, V]

DUNGEONS (11): The Shattered Throne, Pit of Heresy, Prophecy, Grasp of
Avarice, Duality, Spire of the Watcher, Ghosts of the Deep, Warlord's Ruin,
Vesper's Host, Sundered Doctrine, Equilibrium. [manifest + live featured
rotation, V]

PANTHEON 2.0, permanent (Monument of Triumph): Calus Resplendent (Argos ->
Gahlran -> Calus), Morgeth Surpassing (Warpriest -> Consecrated Mind ->
Morgeth), Insurrection Prime Revolutionary (all six + Insurrection Prime),
plus two weekly Featured single-boss farm activities. Difficulty: Adventure /
Standard / Custom with graded Feats. No numeric scoring found (C). [manifest
+ epiccarry + gamingpromax, V]

NOT PLAYABLE, legacy manifest rows only: Leviathan, Eater of Worlds, Spire
of Stars, Scourge of the Past, Crown of Sorrow, and the four 2024 Pantheon
rows. Their surviving bosses live inside Pantheon 2.0 (Calus, Argos,
Gahlran, Insurrection Prime). Val Ca'uor did not survive anywhere. [manifest
forensics: LL 640-750 rows, no difficultyTierCollectionHash, no milestone;
LFCarry 2026 catalog; V]

Derivation root cause, for any future manifest work: Bungie stopped
populating activityModeHashes/activityModeTypes on new rows from late 2024.
Vesper's Host, Sundered Doctrine, both Desert Perpetuals and Pantheon 2.0
rows have NO mode fields. Derive from milestones + difficultyTier fields,
never from modes. [manifest, V]

Farming model: no official checkpoint system; community checkpoint bots
continue post-freeze. Weekly featured rotation (2 raids + 2 dungeons) makes
every encounter drop repeatedly that week. Desert Perpetual sits outside the
rotation with its own lockouts (single source, C-lean). Dungeon single
encounters exist as Portal "Customize" rows for: Nightmare of Gahlran
(Duality), Beneath the Necropolis (Pit), Locus of Wailing Grief and Hefnd's
Vengeance (Warlord's). [kyberscorner live rotation + lfcarry + manifest, V]

Dungeon difficulty tiers [manifest, V]: Ghosts/Spire/Prophecy: Explorer,
Explorer (Matchmade), Standard, Eternity, Ultimatum. Vesper's/Sundered:
Normal + Master. Duality/Grasp/Warlord's/Pit: Standard + Master. Shattered
Throne: single. Equilibrium: Standard + Contest, NO Master row.

## DAMAGE-PROFILE FIELDS PER BOSS ENCOUNTER

Window seconds are from the Aegis Bosses tab (V). Movement column is
community knowledge (L) unless flagged. Encounters with no DPS check are
listed as puzzle/traversal and need no loadout page.

### Vault of Glass
1 Waking Ruins: no DPS. 2 Confluxes: no DPS. 3 Oracles: no DPS.
4 TEMPLAR: single boss. 15s raised windows, extendable by teleport-block.
  close-mid. light movement (detain bubbles must be shot; they suppress).
  Special V: takes reduced explosive damage OUTSIDE its raised state
  (Ritual of Negation) - non-explosive precision is the safe default.
  Special V: Cluster Bombs: all 8 clusters can hit (~22.15% over base
  rocket; cluster part not multiplied by Pack Hunter).
5 Gorgons: no DPS. 6 Gatekeepers: sustained miniboss clear, no burst check.
7 ATHEON: 30s (Time's Vengeance). close, center pool. light movement,
  supplicants force hops. head crit.
  Special, sheet claim flagged C: currently takes 5x damage (also "normally
  3x grenade damage"). One-phases trivially if true. Single source.

### King's Fall
1 Portal: no DPS. 2 Totems: no DPS.
3 WARPRIEST: 45s brand, extendable via Brand Claimer steals. close. head.
4 GOLGOROTH: 20s per gaze bubble, chained x6. close-mid from pool.
  stomach crit only while gazed; Unstable Light bomb deals 13,501 (V).
5 DAUGHTERS: two bosses, one per phase. mid. lethal raised platform (V).
6 ORYX: 24.8s per stagger + final stand. FAR range. chest crit.
  Special V: SETPIECE boss - projectile tracking and tethering DO NOT WORK.
  Exclude tracking heavies and tether from recommendations here.

### Last Wish
1 KALLI: ~30s. close. head hitbox takes 2x impact damage (V).
2 SHURO CHI: 12.9s per break, x6. close-mid. head 2x impact (V).
  Note: canonical DPS-testing target; her 2x head inflates naive comparisons.
3 MORGETH: 30s. close. awkward ogre crit.
  Special V: 40% DR vs Sleeper, 45% vs snipers, 55% vs shotguns.
4 The Vault: no DPS.
5 RIVEN: cheese remains the standard approach in 2026 (V for guide teaching
  it; L for post-9.7 functionality, no explicit retest published). Legit
  basis 14.95s bottom floor. mouth volley = stationary close burst.
  Same sniper/shotgun/Sleeper DR as Morgeth (V). Face shows 2x visually.
6 Queenswalk: no DPS.

### Garden of Salvation
1 Evade: no DPS. 2 Summon: no DPS.
3 CONSECRATED MIND: 20.7s. close-mid. HEAVY movement: boss retreats
  backwards with projectile-avoidance behaviour (V). 12 eyes then core.
4 SANCTIFIED MIND: 17.4s. FAR. tether chain gates DPS. shoot bottom half of
  crit for consistency; ground-vs-air hitbox differs; Divinity bubble forms
  under its feet (V). Swords not viable (far, moving).

### Deep Stone Crypt
1 CRYPT SECURITY: damage objective, 6 fuses. close.
  Special V: PROXY target - base damage only, no crits, surges and most
  debuffs/perks do nothing. Flat burst wins.
2 ATRAKS-1: 2.3s per clone window (V) - the purest short-burst check in the
  game. close. PROXY boss - no crit, surges/debuffs dead (V).
3 Rapture/Descent: no boss DPS check.
4 TANIKS: 14s per boop window, ~3 per cycle. mid. floating chassis, no crit
  (V-adjacent). Drifts; sword-unfriendly (L). Moderate movement.

### Vow of the Disciple
1 Acquisition: no DPS.
2 CARETAKER: ~7.5s effective per plate stint, 3 floors, long total uptime.
  close from plate. Special V: takes 2x damage while you stand on the plate.
  Special V: the past-threshold 25% boost is display-only, fake.
3 Exhibition: no DPS.
4 RHULK: 36s. mid, boss ROAMS, beams force repositioning (V). 4 crit spots;
  exploding crits are purely visual (V). Channeled stationary supers risky.

### Root of Nightmares
1 Cataclysm: no boss DPS. 2 Scission: no boss DPS.
3 ZO'AURC: 10s per plate, two alternating plates, post-threshold timer (V).
  close-mid. wrong plate zeroes your damage (L). plate-to-plate movement.
4 NEZAREC: 30s. close. teleports; node rotation. Special V: suppressing
  melee - cancels active supers/channels. Keep distance when he lunges.

### Crota's End
1 Abyss: no DPS. 2 Bridge: no boss DPS.
3 IR YUT: 45s liturgy window. close-mid. wizard crit.
4 CROTA: 30s cycles. gun-stagger then SWORD RELIC finisher.
  Special V: takes 35% MORE damage from swords. The sword encounter.
  Oversoul burst checks punish channeled supers mid-phase (L).

### Salvation's Edge
1 Substratum: no DPS.
2 HERALD OF FINALITY: 30s. close-mid. Taken adds flood at close range
  during damage (V) - survivability matters.
3 Repository: no DPS. 4 Verity: no boss DPS.
5 THE WITNESS: 45s. FAR. moderate movement, dynamic wave attacks (V).
  Special V: SETPIECE - tracking and tether do not work. Manual-aim
  long-range (snipers, LFRs, Still Hunt + Nighthawk) is the fit.

### The Desert Perpetual (nonlinear: three wings any order, then Koregos)
Exotic: Whirling Ovation rocket (Koregos). Epic = separate harder activity,
reworked mechanics, bigger health pools (Koregos 1,232,501 Epic vs 840,649
base, V). Base contest weapon bans were contest-only, not live rules.
A IATROS (Wyvern): 45.65s base, extendable via chronon hoops. close-mid.
  crit ROTATES position by ring colour: white Mid->Bottom->Top, blue
  Bottom->Top->Mid, red Top->Mid->Bottom (V).
  Special V: 35% damage resistance vs ALL non-super damage. Super rotations
  are the answer here. (Epic row omits the note - C whether it persists.)
B EPOPTES (Hydra): 90.9s sustained with eye-sequence extensions. close-mid.
  light-cone positioning. shield eyes then body.
C AGRAIOS (Hobgoblin): 91.5s sustained, up to two extensions per phase.
  varying range. teleports, accelerator rings, laser detain. heavy movement.
D KOREGOS (Harpy): 80s sustained with mandatory ring-dunk extensions. you
  BOARD the boss (close). final stand has vertically shifting crit spots,
  active repositioning (V).
  Special V: not a construct; Surrounded-style perks activate by jumping
  slightly while riding it.
Longest windows in the game: sustained weapons (MGs, LFRs, heavy snipers)
outperform one-shot burst across this raid (loadout-table V, class L).

### Dungeons, bosses only (non-boss = no DPS check)
Shattered Throne: VORGETH 30s close after petitioner cleanse, wipe timer.
  DUL INCARU 45s close after crystal knights. Special V: takes ELITE (not
  boss) damage scaling - Wardcliff-class overperforms.
Pit of Heresy: ZULMAK 50s close after dunk-empowered crystals.
Prophecy: PHALANX ECHO 50s close, small arena, knockback. KELL ECHO 105s
  sustained FAR, moving safe corridor. Special V: the wipe screen reports
  2x the damage actually dealt. Far = no swords/shotguns.
Grasp: PHRY'ZHIA 30s close ogre. AVAROKK 28s mid after engram deposits.
Duality: NIGHTMARE OF GAHLRAN 60s close; Unstable Essence = +50% damage (V).
  NIGHTMARE OF CAIATL 12s per bell, ~3 bells; Special V: 90% DR unless
  Waking Resonance active; 1.5x crit-multiplier modifier. Heavy bell-to-bell
  movement.
Spire: AKELOUS 27.8s after 12 eyes; retreats backwards, airborne,
  sword-unfriendly. PERSYS 23s close-mid.
Ghosts of the Deep: ECTHAR 40s close-mid; shield (~10,800 HP, separate from
  180,621 body) breaks only via Piercing Light mechanic (abilities/
  finishers) (V shield note). SIMMUMAH 45s FAR; same shield rule (V).
Warlord's Ruin: RATHIL 20s close. LOCUS OF WAILING GRIEF 15s per flame x4.
  HEFND'S VENGEANCE 20s windows x3 floors.
Vesper's Host: RANEIKS UNIFIED ~65% global DR (V); splits into multiple
  servitors (split bodies, crits/debuffs still work); 15s close;
  splash/AoE favoured (L). CORRUPTED PUPPETEER 95s sustained mid-far with
  teleports (V); 45s Sector Purge room-ignition cadence. Ice Breaker drops
  here.
Sundered Doctrine: ZOETIC LOCKSET 81.6s sustained FAR. Special V: PROXY
  (no crit, surges/debuffs dead), randomly opening split body. Flat
  sustained damage. KERREV 45.2s close-mid; drowning dark zones. Finality's
  Auger drops here.
Equilibrium (3-player, Renegades): HARVESTER opening: no boss DPS check.
  HARROW 33.2s close windows, hard cap of three full phases (fuse
  depletion) plus weakened wall-cut final window (V). DREDGEN SERE 37.45s
  close-mid; Compel-vs-kill choice mechanic; Arc-inversion arena attack (V).
  Community loadout (Shacknews V): Well, Parasite, burst rockets. Exotic:
  Heirloom bow.

### Pantheon 2.0 boss profiles (phase lengths unpublished, C)
Argos: detain diamond, mid, few adds. Warpriest: short setup, many adds,
mid. Gahlran: stun arms, close adds, mid (differs from 2019 Crown loop; old
guides non-transferable). Consecrated Mind: backwards-moving, mid-far.
Calus: four plates, Force of Will, close adds, mid. Morgeth: long setup,
many close adds, close-mid. INSURRECTION PRIME: Brig, phase synergy,
mid-far, few adds.
Special V (9.7.0.3): Divinity deals ZERO damage to Insurrection Prime and
its cage does not damage it; Fallen Tech specifically blocks the weapon.
Scope is that one encounter; Divinity works everywhere else. Whether the
zero-damage cage still forms for teammates: C, unspecified.

## CROSS-CUTTING RULES TO KEY THE ENGINE ON (all V unless noted)
1 PROXY targets (no crit, surges and most debuffs dead): Crypt Security,
  Atraks-1, Zoetic Lockset. Deprioritize crit-dependent picks (snipers) and
  debuff-dependent strategies; flat burst and sustained flat damage win.
2 SETPIECE bosses (tracking and tether do not function): Oryx, The Witness.
  Exclude tracking rockets (Truth-class) and tether there.
3 DR overrides: Morgeth and Riven (anti-Sleeper 40% / sniper 45% / shotgun
  55%), Raneiks (~65% global), Caiatl (90% without Waking Resonance),
  Iatros (35% vs non-super), Templar (explosive DR outside raised state).
4 Damage bonuses: Crota +35% swords; Caretaker 2x on plate; Kalli and Shuro
  Chi 2x head impact; Duality Gahlran +50% Unstable Essence; Atheon 5x (C).
5 Sword/point-blank unfriendly by range or behaviour: Kell Echo, Simmumah,
  Witness, Oryx, Zoetic Lockset, Akelous, Consecrated Mind, Taniks.
6 Channeled-super punishers: Nezarec suppressing melee (V), Templar detain
  (L), Crota Oversoul checks (L), Rhulk roaming (V for roaming).
7 Divinity: normal everywhere except zero vs Insurrection Prime.
8 Generic 2026 meta where no encounter consensus exists (GameRant 2026-06-26
  V): 1K Voices post-catalyst, heavy snipers, rockets + Gjallarhorn
  wolfpack (Apex/Cold Comfort/Hezen), Still Hunt + Nighthawk, Anarchy,
  Finality's Auger. Archetype order: snipers, rockets, LFRs, GLs.

## GAPS - the site must say "unknown" rather than fill these
Pantheon 2.0 phase durations and scoring. Divinity teammate-cage detail on
Insurrection Prime. Official names for Ghosts enc 1 and Vesper's enc 1.
Epic Desert Perpetual full mechanics; whether Iatros DR persists in Epic.
Featured-boss subtitle semantics. Rushdown encounter pools. Movement column
mostly L. Per-encounter loadout consensus for most pre-2025 bosses: none
published post-Monument; the honest value is "generic boss DPS applies".
Desert Perpetual outside the featured rotation: single source.
