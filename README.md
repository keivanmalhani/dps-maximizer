# dps-maximizer

[![CI](https://github.com/keivanmalhani/dps-maximizer/actions/workflows/ci.yml/badge.svg)](https://github.com/keivanmalhani/dps-maximizer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Live: https://keivanmalhani.github.io/dps-maximizer/

Sign in with Bungie, pick your class and what you are doing - a generic mode
or a specific raid, dungeon or Pantheon encounter - and get the
maximum-damage loadout you can build from what you actually own, the rotation
it requires of you, and the single best thing to go unlock next.

## What it is for

light.gg tells you a gun is a god roll. God roll for what? Weapon Report tells
you what you use, Fireteam Report tells you what to run; this one answers the
question that sits underneath every damage-phase argument: **given my actual
vault, what is the hardest-hitting thing I can put on right now, and what am I
supposed to do with it?**

The answer arrives as one card, before any table:

- weapons by slot, each with the tier list's own one-line reasoning, quoted
- the exotic armor and super for your class, with the same sourcing
- the fireteam jobs (Tractor, Lumina, Divinity) kept separate from your slots,
  because a debuff is a job somebody does, not a gun you personally DPS with
- the rotation as numbered steps in plain words: "hit once with each weapon,
  about 7 seconds between hits, the third hit arms a large bonus"
- the single best thing you do not own, with its concrete acquisition path and
  your Exotic Cipher count when the Monument to Lost Lights sells it
- your Armor 3.0 stats, read from your equipped character, against the
  published damage ceilings
- the buff arithmetic cheat sheet: the four buckets, what stacks, and the
  myths, so the tribal knowledge is on the page instead of in a Discord

Signed out, the whole page runs on a demo vault that is clearly flagged as
invented, so there is never an empty screen.

## Why the data cannot go stale

**Data current as of Update 9.7.0.4, 28 July 2026. The game no longer receives
balance patches, so this does not go stale.**

Destiny 2 stopped receiving content updates on 9 June 2026 (Update 9.7.0; the
final hotfix was 9.7.0.4 on 28 July 2026). The meta this site describes is the
meta permanently. That is why a curated, hand-sourced dataset is the correct
architecture here rather than a compromise: there is nothing left for it to
drift away from. The stamp above appears on the page itself, because a reader
deserves to know why a static tier list is trustworthy.

## Why tiers and not numbers

The community's authoritative DPS spreadsheet (the Aegis sheet) has its
numeric ranking tabs hidden mid-rebuild, which means **no trustworthy public
per-weapon DPS figures exist right now**. This site refuses to invent any.

So it ranks by TIER, with the sheet's own annotations quoted verbatim as the
reasoning, and every claim in the dataset carries a `source` field. The few
percentages that appear (Tractor's 30, Lumina's 35, No Hesitation's 10, the
Wolfpack 25 to 30 on base rocket damage, the ~4 percent cost of dropping a
third rotation weapon) are the ones verified current via Aegis; everywhere
else the page says "community testing pending" instead of filling the gap
with a decimal that looks authoritative and is not. The general buff
percentage table is pending Court's June-2026 transcription and is labelled
that way on the page.

Other honesty rules that shaped the code:

- Ownership is two different things and the page says which: an item in your
  vault or on a character is buildable now; an item that is only lit in
  Collections can be pulled if it is an exotic and cannot if it is a
  random-roll legendary.
- Catalysts are read from your item sockets where the profile exposes them;
  where it does not, the page says "catalyst state unknown" rather than
  guessing.
- Wanted rolls (Hezen Vengeance's Overflow or Envious Assassin plus Bait and
  Switch or Cluster Bomb or Elemental Honing; Ergo Sum's Perfect Fifth) are
  checked against your actual instances, base or enhanced perks.
- Champion stuns are derived from each weapon's intrinsic frame as resolved
  from the manifest, using the Anti-Champion 2.0 frame mapping from the
  2026-05-29 dev insight. Exotic intrinsics the mapping does not name are
  reported as pending, not guessed. Ergo Sum rolls its frame, so its champion
  effect is reported as unknown.
- Add clear is where the sourced sheet is thinnest, and the page says so; the
  energy slot in that mode is honestly empty rather than padded.
- PvP is out of scope, and picking it says so instead of half-answering.
- Whether Bait and Switch's activating shot itself benefits is contested in
  community testing, and the rotation card says exactly that.
- Divinity deals zero damage to Insurrection Prime since hotfix 9.7.0.3 (its
  cage does not damage him; Fallen Tech blocks the weapon there), and it
  works everywhere else - the 2026-08-08 encounter research corrected the
  earlier broader claim, and the site now states the corrected scope. Whether
  the cage still forms for teammates there is unconfirmed and said to be.
  Likewise the verified oddity that a Well of Radiance OVERRIDES Radiant for
  Golden Gun appears exactly when Golden Gun is the recommended super.

## Encounters: the same honesty, one level deeper

The activity picker now goes past the four generic modes: all 10 raids, all
11 dungeons and the three permanent Pantheon 2.0 gauntlets, encounter by
encounter, from `docs/encounter-research.md` (the sourced research brief that
is the ONLY origin of encounter facts on the site). Every encounter page
shows its damage profile - window seconds from the Aegis Bosses tab, range,
movement, crit - and every special rule with its source and confidence code.

Tiers-not-numbers still holds at encounter level, and matters more there. The
brief records RULES (the Templar resists explosives outside its raised state;
Atraks-1 is a proxy target where crits and debuffs are dead; Crota takes 35
percent more from swords; Morgeth resists snipers; Oryx and the Witness break
projectile tracking and tether), not per-encounter DPS figures - so the
engine bends the same tiered pools by those rules and says which rule id did
the bending on the card, instead of inventing encounter DPS numbers nobody
published. Where the brief marks a claim contested (Atheon's 5x) the page
renders "reported but unconfirmed"; where it lists a gap (Pantheon phase
lengths, Epic Desert Perpetual mechanics) the page says unknown; where no
per-encounter loadout consensus exists, the page says generic boss DPS
reasoning applies rather than dressing the generic answer up as
encounter-specific wisdom.

The answer also grew depth:

- Loadout A is the answer; Options B and C are the next-best LEGAL builds
  that are meaningfully different (a different exotic seat or none at all),
  out of the same one-exotic search, never a one-slot reshuffle.
- "Everything you own that fits": the full-arsenal table (924 weapons baked
  from the manifest into `src/data/arsenal.json`) filtered to what you own,
  ranked by the sourced archetype order for the encounter's window style,
  with your actual damage-perk rolls read from item sockets - "Your roll:
  Envious Assassin + Bait and Switch" or the honest wishlist when your copy
  lacks one. Archetypes past the sourced order are listed, not ranked, and
  say so. The arsenal JSON is ~505 KB, so it loads as its own lazy chunk on
  first use; a test fails the build if anything imports it statically.
- Deep links: `?activity=vault-of-glass&encounter=templar&class=titan`
  restores the exact page, so an encounter loadout is a URL you can hand to
  your fireteam.

## How it reads your account

One authenticated `GetProfile` call with components
`100,102,200,201,205,300,305,800,900`: profile, vault, characters, character
inventories, equipment, item instances, item sockets, collectibles, records.
The vault and Collections are authenticated components, which is why this
site is sign-in only; a Bungie Name lookup would silently see a fraction of
the truth and pretend it was the whole.

**Sign in with Bungie.** One button. It goes to bungie.net, comes back through
[d2-auth](https://github.com/keivanmalhani/d2-auth), and reads the account you
signed in as. Every site on `keivanmalhani.github.io` shares an origin and
therefore shares the session, so signing in on one signs you in on all of
them. Bungie issues no refresh token to a public client, which means the
session lasts an hour and cannot be extended, only replaced; the page says how
much of the hour is left and offers the button again when it runs out. The
four platform codes that mean the sign-in is over (99, 2111, 2123, 2124) are
never retried; the retry loop branches on the error code first and only lets
the HTTP status vote when there is no code at all, because Bungie returns
ordinary application errors as HTTP 500.

The site's own Bungie API key ships in the built JavaScript. That is not an
oversight: a browser has to send one with every request, so there is nowhere
to put it that a reader cannot reach, and every static Destiny tool works this
way. The only thing it protects is a rate limit.

## The baked manifest

The site does not ship or fetch the full item manifest client-side; the
English item table alone is about 190 MB of JSON. Because the game is frozen,
`scripts/build-data.mjs` fetches the manifest ONCE at build time (keyless
endpoint), resolves ONLY the curated list into `src/data/items.json` (about
19 KB), and the site ships that.

The script is paranoid on purpose. Every resolved hash's display name is
verified against the expected item name and the build FAILS LOUDLY on any
mismatch, absence or ambiguity, because a wrong hash means recommending the
wrong gun with a straight face. It also resolves, with the same verification:

- every manifest version of each item (owning any Edge Transit counts, and
  the Timelost Hezen and Praedyth's count for their base names)
- collectible hashes, for the Collections half of ownership
- weapon slots, armor buckets and class locks from `DestinyEquipmentSlotDefinition`
  and the item defs, so no slot is ever remembered wrong (the manifest says
  Ergo Sum is an energy weapon, whatever your memory says)
- intrinsic frames for the champion mapping
- the perk plug hashes for the wanted-roll checks, base and enhanced
- the catalyst plug hashes and the Empty Catalyst Socket plug
- the Exotic Cipher item hash and the six Armor 3.0 character stat hashes

`src/data/items.json` is committed, so `npm ci && npm test && npm run build`
needs no network beyond npm. Re-running `npm run data` re-verifies against the
live (frozen) manifest; the tests cross-check the JSON against the curated
list in `src/data/tiers.ts`, so the two cannot drift apart quietly.

## Development

```
npm ci
npm test          # vitest
npm run build     # typecheck then vite build
npm run dev       # local dev server
npm run data      # re-verify and regenerate src/data/items.json from the manifest
npm run ascii     # fail on any non-ascii byte in a text file
```

`src/auth.ts` is vendored verbatim from `d2-auth/src/client.ts` and should be
changed there rather than here. It is copied rather than depended on because
the only real contract between these sites is the name and shape of one
`sessionStorage` key, which is not worth a published package.

There are no runtime dependencies. The recommendation engine
(`src/recommend.ts`), the ownership parser (`src/ownership.ts`) and every
piece of copy logic are pure functions, tested against fixture inventories:
the chosen loadout, the rotation steps, the next-unlock pick, the tier
fallbacks when a player owns nothing, the champion annotations, and the exact
conditions under which the Well/Golden Gun warning appears.

The share card is rendered to `public/og.png` by `scripts/render-og.mjs`,
which is deliberately outside the build because it needs a native canvas:

```
npm install --no-save @napi-rs/canvas
node scripts/render-og.mjs
```

## Layout

```
src/
  data/tiers.ts        the curated tier dataset, quotes and sources (pure data)
  data/encounters.ts   the encounter database, transcribed from docs/encounter-research.md
  data/rotations.ts    rotation knowledge as data
  data/buffs.ts        the four buckets, oddities, myths
  data/champions.ts    Anti-Champion 2.0 frame mapping
  data/class-notes.ts  per-class super calls and fine print
  data/armor-stats.ts  Armor 3.0 damage stat ceilings
  data/items.json      baked manifest facts, generated, verified, committed
  data/items.ts        typed access to the bake
  data/arsenal.json    the full weapon arsenal bake, lazy-loaded, committed
  recommend.ts         the engine (pure), one-exotic search + encounter adjustments
  encounter.ts         encounter rules compiled into engine adjustments (pure)
  arsenal.ts           lazy arsenal door + roll detection + table ranking (pure)
  url-state.ts         deep-link (de)serialization (pure)
  ownership.ts         GetProfile response to ownership model (pure)
  card.ts              the 1200x630 share card drawing (pure)
  signin.ts            the session as UI state and error copy (pure)
  bungie.ts            platform client, code-first retry rule
  auth.ts              vendored from d2-auth, do not edit here
  format.ts            escaping and clamping
  ui/sections.ts       markup as pure string functions
  ui/app.ts            the shell
  main.ts              entry point
docs/encounter-research.md  the sourced encounter brief; the only origin of encounter facts
fixtures/demo.ts       the invented demo vault, fed through the real parser
scripts/build-data.mjs the manifest bake, loud on any mismatch
scripts/build-arsenal.mjs the arsenal bake
scripts/render-og.mjs  the OG card render
tests/                 vitest suite
```

## What it will not do

- **It will not give you a number.** No public per-weapon DPS figure is
  trustworthy right now, so there are none here. Tiers plus quoted reasoning
  is what the evidence supports.
- **It will not read someone else's vault.** Vault and Collections need the
  owner's token. There is no lookup box because it could only ever half-work.
- **It does not rank PvP.** Out of scope in v1, said on the page.
- **It does not know your artifact or your subclass configuration.** It reads
  gear, Collections, sockets and stats.
- **It has no accounts and stores nothing of its own.** Close the tab and the
  only trace is a session that dies with it if you signed in.
- **It is not affiliated with Bungie** or with the Aegis sheet; the sheet's
  annotations are quoted as the community record they are, with attribution.

## Security

See [SECURITY.md](SECURITY.md). Short version: report privately through the
Security tab, there is no server and no key of its own worth stealing, and the
most recent tagged release is what is supported.

## Licence

MIT. See [LICENSE](LICENSE).

Weapon names and icons come from the public Destiny manifest. Tier reasoning
is quoted from the Aegis boss damage sheet's equipment tab (2026-07) and the
final Bungie dev insights, as credited on every card.
