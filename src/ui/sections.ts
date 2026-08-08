// The page, top to bottom. Every function here returns markup for one
// section; none of them fetch anything. The order on the page is the order
// of the product: the answer first, then what it asks of you, then what to
// go unlock, then the knowledge that replaces tribal knowledge.

import { ARMOR_STATS_SOURCE, POWERHOUSE_NOTE, STAT_EFFECTS } from '../data/armor-stats';
import { BUCKETS, BUFFS_SOURCE, MYTHS, ODDITIES, PENDING_NOTE } from '../data/buffs';
import {
  ACTIVITIES,
  PROFILE_CONFIDENCE_NOTE,
  RESEARCH_SOURCE,
  ruleLine,
  type ActivityKind
} from '../data/encounters';
import { iconUrl, MANIFEST_VERSION, BAKED_ITEMS } from '../data/items';
import { DATA_STAMP, TIER_SOURCE } from '../data/tiers';
import { escapeText, clampStat } from '../format';
import type { EncounterVerdict } from '../encounter';
import type { LoadoutAlternative, Pick, SlotAnswer, Verdict } from '../recommend';
import type {
  ArsenalFilters,
  RankedArsenal,
  RankedArsenalRow
} from '../arsenal';
import type { SignInView } from '../signin';
import type { RunTarget } from '../url-state';
import { DEFAULT_TARGET } from '../url-state';
import type { Activity, CharacterInfo, GuardianClass } from '../types';
import { ACTIVITY_LABELS, CLASS_NAMES } from '../types';

export interface PageModel {
  source: 'demo' | 'live';
  playerName: string;
  flagLine: string;
  classType: GuardianClass;
  activity: Activity;
  availableClasses: GuardianClass[];
  character: CharacterInfo | null;
  /** The run target; older callers without one mean the default mode. */
  target?: RunTarget;
}

/** Everything the encounter-aware page adds around the core verdict. */
export interface PageExtras {
  encounter?: EncounterVerdict;
  alternatives?: LoadoutAlternative[];
  /** True to auto-load the arsenal table (encounter pages do). */
  arsenalAuto?: boolean;
}

function section(eyebrow: string, title: string, body: string, rule = true): string {
  return (
    `<section class="section${rule ? ' section--rule' : ''}">` +
    `<div class="eyebrow">${escapeText(eyebrow)}</div>` +
    `<h2 class="section__title">${escapeText(title)}</h2>` +
    body +
    `</section>`
  );
}

// ------------------------------------------------------------------- runbar

/**
 * The bar that sits above the answer: whose vault is on screen, and the one
 * way in. There is no name-lookup half here because a vault is only readable
 * by its owner; the demo is the signed-out experience instead.
 */
export function runbar(model: PageModel, account: SignInView): string {
  const isDemo = model.source === 'demo';

  const flag = isDemo
    ? `<span class="flag">Demo data</span>` +
      `<p class="runbar__note">${escapeText(model.flagLine)}</p>`
    : `<span class="flag flag--live">Your account</span>` +
      `<p class="runbar__note">${escapeText(
        model.playerName + ', read from the Bungie API just now. Nothing was stored or sent anywhere else.'
      )}</p>`;

  // Never both. Signed in there is nothing left to sign in to; signed out
  // there is no vault to read.
  const accountButtons = account.showSignIn
    ? `<button class="btn btn--primary" type="button" id="signin">Sign in with Bungie</button>`
    : `<button class="btn btn--primary" type="button" id="mine">Read my vault</button>` +
      `<button class="btn btn--ghost" type="button" id="signout">Sign out</button>`;

  const demoButton = isDemo
    ? ''
    : `<button class="btn btn--ghost" type="button" id="demo">Back to the demo</button>`;

  return (
    `<section class="runbar" id="runbar">` +
    `<div class="runbar__account">` +
    flag +
    `</div>` +
    `<div class="runbar__signin">` +
    `<div class="runbar__actions">${accountButtons}${demoButton}</div>` +
    `<p class="runbar__session" id="session">${escapeText(account.note)}</p>` +
    `</div>` +
    `<div id="runbar-status"></div>` +
    `</section>`
  );
}

// ------------------------------------------------------------------- picker

const KIND_GROUP_LABELS: Record<ActivityKind, string> = {
  raid: 'Raids',
  dungeon: 'Dungeons',
  pantheon: 'Pantheon'
};

function activitySelect(target: RunTarget): string {
  const selected = target.kind === 'encounter' ? target.activityId : '';
  const groups = (['raid', 'dungeon', 'pantheon'] as ActivityKind[])
    .map((kind) => {
      const options = ACTIVITIES.filter((a) => a.kind === kind)
        .map(
          (a) =>
            `<option value="${escapeText(a.id)}"${a.id === selected ? ' selected' : ''}>` +
            `${escapeText(a.name)}</option>`
        )
        .join('');
      return `<optgroup label="${escapeText(KIND_GROUP_LABELS[kind])}">${options}</optgroup>`;
    })
    .join('');
  return (
    `<select id="activity-select" class="picker__select" aria-label="Pick a raid, dungeon or Pantheon gauntlet">` +
    `<option value=""${selected === '' ? ' selected' : ''}>Pick a raid or dungeon...</option>` +
    groups +
    `</select>`
  );
}

function encounterStrip(target: RunTarget): string {
  if (target.kind !== 'encounter') return '';
  const activity = ACTIVITIES.find((a) => a.id === target.activityId);
  if (!activity) return '';
  const chips = activity.encounters
    .map((encounter) => {
      const on = encounter.id === target.encounterId ? ' chip--on' : '';
      const dim = encounter.type === 'none' ? ' chip--dim' : '';
      return (
        `<button class="chip${on}${dim}" type="button" data-encounter="${escapeText(encounter.id)}"` +
        ` title="${encounter.type === 'none' ? 'No damage check here' : escapeText(encounter.name)}">` +
        `${escapeText(encounter.name)}</button>`
      );
    })
    .join('');
  return `<div class="picker__group picker__group--strip"><span class="picker__label">Encounter</span>${chips}</div>`;
}

export function pickerSection(model: PageModel): string {
  const target = model.target ?? DEFAULT_TARGET;
  const classButtons = model.availableClasses
    .map(
      (classType) =>
        `<button class="chip${classType === model.classType ? ' chip--on' : ''}" type="button" ` +
        `data-class="${classType}">${escapeText(CLASS_NAMES[classType])}</button>`
    )
    .join('');

  const activities: Activity[] = ['boss-burst', 'boss-sustained', 'add-clear', 'master-champions', 'pvp'];
  const activityButtons = activities
    .map(
      (activity) =>
        `<button class="chip${target.kind === 'mode' && activity === model.activity ? ' chip--on' : ''}" type="button" ` +
        `data-activity="${activity}">${escapeText(ACTIVITY_LABELS[activity])}</button>`
    )
    .join('');

  return (
    `<section class="picker" id="picker">` +
    `<div class="picker__group"><span class="picker__label">Class</span>${classButtons}</div>` +
    `<div class="picker__group"><span class="picker__label">Doing what</span>${activityButtons}${activitySelect(target)}</div>` +
    encounterStrip(target) +
    `</section>`
  );
}

// ------------------------------------------------------------------- answer

function tierChip(label: string): string {
  const tone = label === 'Tier 1' ? ' tier--one' : '';
  return `<span class="tier${tone}">${escapeText(label)}</span>`;
}

function reasonLine(pick: Pick): string {
  const text = pick.reasonIsQuote ? '&quot;' + escapeText(pick.reason) + '&quot;' : escapeText(pick.reason);
  return `<p class="pick__reason">${text} <span class="src">${escapeText(pick.source)}</span></p>`;
}

function lightggLink(pick: Pick): string {
  const baked = BAKED_ITEMS[pick.id];
  if (!baked) return escapeText(pick.name);
  return (
    `<a href="https://www.light.gg/db/items/${baked.primaryHash}" rel="noreferrer noopener" ` +
    `target="_blank">${escapeText(pick.name)}</a>`
  );
}

function pickCard(pick: Pick, slotTitle: string): string {
  const ownedClass = pick.buildableNow ? ' pick--owned' : ' pick--missing';
  const icon = pick.icon
    ? `<img class="pick__icon" src="${escapeText(iconUrl(pick.icon))}" alt="" width="48" height="48" loading="lazy" />`
    : '';
  const lines: string[] = [];
  lines.push(`<p class="pick__own">${escapeText(pick.ownershipLine)}</p>`);
  if (pick.rollLine) lines.push(`<p class="pick__detail">${escapeText(pick.rollLine)}</p>`);
  if (pick.catalystLine) lines.push(`<p class="pick__detail">${escapeText(pick.catalystLine)}</p>`);
  if (pick.champion) lines.push(`<p class="pick__detail pick__champion">${escapeText(pick.champion.label)}</p>`);
  return (
    `<div class="pick${ownedClass}">` +
    `<div class="pick__slot">${escapeText(slotTitle)}</div>` +
    `<div class="pick__head">${icon}<div>` +
    `<div class="pick__name">${lightggLink(pick)}</div>` +
    `<div class="pick__meta">${escapeText(pick.typeLabel)} ${tierChip(pick.tierLabel)}</div>` +
    `</div></div>` +
    reasonLine(pick) +
    lines.join('') +
    `</div>`
  );
}

function emptySlotCard(slot: SlotAnswer): string {
  // Two honest ways for a slot to be empty: the sourced data has nothing
  // (emptyReason), or the slot's best weapon is an exotic the one-exotic
  // rule spent elsewhere (exclusivityNote).
  const reason = slot.emptyReason
    ? `<p class="pick__reason">${escapeText(slot.emptyReason)}</p>`
    : '';
  const exclusive = slot.exclusivityNote
    ? `<p class="pick__reason pick__exclusive">${escapeText(slot.exclusivityNote)}</p>`
    : '';
  return (
    `<div class="pick pick--empty">` +
    `<div class="pick__slot">${escapeText(slot.slot.charAt(0).toUpperCase() + slot.slot.slice(1))}</div>` +
    reason +
    exclusive +
    `</div>`
  );
}

export function answerSection(verdict: Verdict, encounter?: EncounterVerdict): string {
  if (verdict.outOfScope) {
    return (
      `<section class="section answer" id="answer">` +
      `<div class="eyebrow">${escapeText(verdict.outOfScope.title)}</div>` +
      `<h1 class="answer__headline">${escapeText(verdict.headline)}</h1>` +
      `<p class="prose">${escapeText(verdict.outOfScope.body)}</p>` +
      `</section>`
    );
  }

  const slotCards = verdict.slots
    .map((slot) => {
      const encounterNote = slot.encounterNote
        ? `<p class="pick__ideal pick__encounter">${escapeText(slot.encounterNote)}</p>`
        : '';
      if (!slot.pick) return emptySlotCard(slot) + encounterNote;
      const exclusive = slot.exclusivityNote
        ? `<p class="pick__ideal pick__exclusive">${escapeText(slot.exclusivityNote)}</p>`
        : '';
      const ideal = slot.idealNote
        ? `<p class="pick__ideal">${escapeText(slot.idealNote)}</p>`
        : '';
      return pickCard(slot.pick, slot.pick.slotName) + encounterNote + exclusive + ideal;
    })
    .map((html) => `<div class="answer__cell">${html}</div>`)
    .join('');

  const armor = verdict.armor
    ? `<div class="answer__cell">${pickCard(verdict.armor, 'Exotic armor')}` +
      (verdict.armorIdealNote ? `<p class="pick__ideal">${escapeText(verdict.armorIdealNote)}</p>` : '') +
      `</div>`
    : verdict.armorEmptyReason
      ? `<div class="answer__cell"><div class="pick pick--empty"><div class="pick__slot">Exotic armor</div>` +
        `<p class="pick__reason">${escapeText(verdict.armorEmptyReason)}</p></div></div>`
      : '';

  const superCard = verdict.superRec
    ? `<div class="answer__cell"><div class="pick pick--super">` +
      `<div class="pick__slot">Super</div>` +
      `<div class="pick__name">${escapeText(verdict.superRec.superName)}</div>` +
      `<p class="pick__reason">${escapeText(verdict.superRec.why)} ` +
      `<span class="src">${escapeText(verdict.superRec.source)}</span></p>` +
      (verdict.superRec.fallbackNote
        ? `<p class="pick__detail">${escapeText(verdict.superRec.fallbackNote)}</p>`
        : '') +
      `</div></div>`
    : '';

  const fireteam = encounter?.fireteamOverride
    ? `<div class="fireteam"><div class="fireteam__title">Fireteam jobs, not your slots</div>` +
      `<p class="fireteam__why">${escapeText(encounter.fireteamOverride)}</p></div>`
    : verdict.fireteamNotes.length > 0
      ? `<div class="fireteam"><div class="fireteam__title">Fireteam jobs, not your slots</div>` +
        `<p class="fireteam__why">Debuffs and ally buffs multiply with everything above, but somebody else can carry them. One each is enough; two of the same is wasted.</p>` +
        verdict.fireteamNotes
          .map(
            (note) =>
              `<div class="fireteam__item"><b>${lightggLink(note)}</b> ${tierChip(note.tierLabel)} ` +
              (note.reasonIsQuote
                ? `&quot;${escapeText(note.reason)}&quot;`
                : escapeText(note.reason)) +
              ` <span class="src">${escapeText(note.source)}</span>` +
              `<span class="fireteam__own">${escapeText(note.ownershipLine)}</span></div>`
          )
          .join('') +
        `</div>`
      : '';

  const champions = verdict.championSummary
    ? `<div class="champions"><div class="fireteam__title">Champions</div>` +
      verdict.championSummary.map((line) => `<p class="champions__line">${escapeText(line)}</p>`).join('') +
      `</div>`
    : '';

  const warningCards = verdict.warnings
    .map(
      (warning) =>
        `<div class="warning" data-warning="${escapeText(warning.id)}">` +
        `<div class="warning__title">${escapeText(warning.title)}</div>` +
        `<p class="warning__body">${escapeText(warning.body)} <span class="src">${escapeText(
          warning.source
        )}</span></p></div>`
    )
    .join('');

  // Encounter rule cards: the DR overrides, bonuses and mechanics that make
  // this page different from the generic one, each tied to its rule id.
  const encounterCards = (encounter?.cards ?? [])
    .map(
      (card) =>
        `<div class="warning ecard ecard--${card.tone}" data-ecard="${escapeText(card.ruleId)}">` +
        `<div class="warning__title">${escapeText(card.title)}</div>` +
        `<p class="warning__body">${escapeText(card.body)} <span class="src">${escapeText(card.source)}</span></p>` +
        `</div>`
    )
    .join('');

  const superCaution = encounter?.superCaution
    ? `<div class="warning ecard ecard--warning" data-ecard="super-caution">` +
      `<div class="warning__title">Watch your super here</div>` +
      `<p class="warning__body">${escapeText(encounter.superCaution)}</p></div>`
    : '';

  const trackingNote = encounter?.trackingNote
    ? `<p class="prose answer__tracking">${escapeText(encounter.trackingNote)}</p>`
    : '';

  return (
    `<section class="section answer" id="answer">` +
    `<div class="eyebrow">The answer</div>` +
    `<h1 class="answer__headline">${escapeText(verdict.headline)}</h1>` +
    `<p class="answer__subline">${escapeText(verdict.subline)}</p>` +
    `<div class="answer__grid">${slotCards}${armor}${superCard}</div>` +
    fireteam +
    champions +
    encounterCards +
    superCaution +
    warningCards +
    trackingNote +
    `</section>`
  );
}

// ----------------------------------------------------------------- rotation

export function rotationSection(verdict: Verdict): string {
  if (verdict.outOfScope) return '';
  if (!verdict.rotation) return '';
  const steps = verdict.rotation.steps
    .map((step, index) => `<li><span class="num rotation__n">${index + 1}</span>${escapeText(step)}</li>`)
    .join('');
  const caveats = verdict.rotation.caveats
    .map((caveat) => `<p class="rotation__caveat">${escapeText(caveat)}</p>`)
    .join('');
  const body =
    `<p class="prose">What this loadout requires of you, in order. Source: ${escapeText(
      verdict.rotation.source
    )}.</p>` +
    `<ol class="rotation">${steps}</ol>` +
    caveats;
  return section('The rotation', verdict.rotation.title, body);
}

// -------------------------------------------------------------- next unlock

export function nextUnlockSection(verdict: Verdict): string {
  if (verdict.outOfScope) return '';
  const unlock = verdict.nextUnlock;
  const cipher = verdict.cipherLine
    ? `<p class="unlock__cipher">${escapeText(verdict.cipherLine)}</p>`
    : '';
  if (!unlock) {
    const body =
      `<p class="prose">Nothing. You own every item this dataset tiers for your class, which means the next ` +
      `upgrade is practice, not shopping.</p>` + cipher;
    return section('Next unlock', 'There is no next unlock', body);
  }
  const reason = unlock.reasonIsQuote
    ? `&quot;${escapeText(unlock.reason)}&quot;`
    : escapeText(unlock.reason);
  const body =
    `<div class="unlock">` +
    `<div class="unlock__name">${escapeText(unlock.name)} ${tierChip(unlock.tierLabel)}</div>` +
    `<p class="unlock__reason">${reason} <span class="src">${escapeText(unlock.source)}</span></p>` +
    `<p class="unlock__how">${escapeText(unlock.acquisition)}</p>` +
    (unlock.cipherLine ? `<p class="unlock__cipher">${escapeText(unlock.cipherLine)}</p>` : '') +
    `</div>` +
    `<p class="prose">One item on purpose. A shopping list is how a site stops being an answer.</p>` +
    cipher;
  return section('Next unlock', 'The single best thing to go get', body);
}

// -------------------------------------------------------------- armor stats

export function statsSection(model: PageModel): string {
  const character = model.character;
  if (!character) return '';
  const rows = STAT_EFFECTS.map((effect) => {
    const value = clampStat(character.stats[effect.stat] ?? 0);
    const width = ((value / 200) * 100).toFixed(1);
    return (
      `<div class="stat${effect.damageStat ? ' stat--damage' : ''}">` +
      `<div class="stat__head"><span class="stat__name">${escapeText(effect.stat)}</span>` +
      `<span class="num stat__value">${value}<span class="stat__of">/200</span></span></div>` +
      `<div class="stat__track"><div class="stat__fill" style="width:${width}%"></div></div>` +
      `<div class="stat__effect">${escapeText(effect.effect)}</div>` +
      `</div>`
    );
  }).join('');
  const body =
    `<p class="prose">Armor 3.0 stats on your ${escapeText(CLASS_NAMES[model.classType])}` +
    `${model.source === 'demo' ? ' (demo numbers)' : ''}, scale 1 to 200. ` +
    `The ceilings are published; the curve between floor and ceiling is Bungie&#39;s, so this shows ` +
    `where you stand rather than pretending to know the exact percent at every point. ` +
    `Source: ${escapeText(ARMOR_STATS_SOURCE)}.</p>` +
    `<div class="stats">${rows}</div>` +
    `<p class="prose">${escapeText(POWERHOUSE_NOTE)}</p>`;
  return section('Your stats', 'What your armor is doing for your damage', body);
}

// -------------------------------------------------------- buffs cheat sheet

export function buffsSection(): string {
  const buckets = BUCKETS.map(
    (bucket) =>
      `<div class="bucket"><div class="bucket__title">${escapeText(bucket.title)}</div>` +
      `<div class="bucket__rule">${escapeText(bucket.rule)}</div>` +
      `<p class="bucket__detail">${escapeText(bucket.detail)}</p>` +
      bucket.examples.map((example) => `<p class="bucket__example">${escapeText(example)}</p>`).join('') +
      `</div>`
  ).join('');
  // data-card, not data-warning: these live in the cheat sheet always,
  // while data-warning marks the answer card's conditional warnings, whose
  // exact presence the tests pin down.
  const cards = [...ODDITIES, ...MYTHS]
    .map(
      (card) =>
        `<div class="warning" data-card="${escapeText(card.id)}">` +
        `<div class="warning__title">${escapeText(card.title)}</div>` +
        `<p class="warning__body">${escapeText(card.body)} <span class="src">${escapeText(card.source)}</span></p>` +
        `</div>`
    )
    .join('');
  const body =
    `<p class="prose">Four multiplicative buckets. Know which bucket a thing is in and you know whether it stacks; ` +
    `this is the whole of the arithmetic. Source: ${escapeText(BUFFS_SOURCE)}. ${escapeText(PENDING_NOTE)}</p>` +
    `<div class="buckets">${buckets}</div>` +
    cards;
  return section('The arithmetic', 'What stacks, what does not, and the myths', body);
}

// -------------------------------------------------------- encounter surfaces

/** The facts panel: window, range, movement, crit, and every sourced rule. */
export function encounterFactsSection(ev: EncounterVerdict): string {
  const encounter = ev.encounter;
  const window = encounter.window;
  const facts: Array<[string, string]> = [
    [
      'Damage window',
      window
        ? (window.seconds !== null ? window.seconds + 's' : 'seconds unpublished') +
          (window.note ? ' - ' + window.note : '')
        : 'No damage check'
    ],
    ['Window style', window?.style ?? 'unknown'],
    ['Range', encounter.range ?? 'unrecorded'],
    ['Movement', encounter.movement ?? 'unrecorded'],
    ['Crit', encounter.crit ?? 'unrecorded']
  ];
  const factRows = facts
    .map(
      ([label, value]) =>
        `<div class="fact"><span class="fact__label">${escapeText(label)}</span>` +
        `<span class="fact__value">${escapeText(value)}</span></div>`
    )
    .join('');

  const rules = [...encounter.specialRules, ...ev.activity.notes];
  const ruleItems =
    rules.length > 0
      ? rules
          .map(
            (r) =>
              `<li data-rule="${escapeText(r.id)}">${escapeText(ruleLine(r))} ` +
              `<span class="src">${escapeText(r.source)} [confidence ${escapeText(r.confidence)}]</span></li>`
          )
          .join('')
      : `<li>No special rules are recorded for this encounter.</li>`;

  const consensus = ev.consensusLine
    ? `<p class="prose facts__gap">${escapeText(ev.consensusLine)}</p>`
    : '';

  const body =
    `<div class="facts">${factRows}</div>` +
    `<p class="prose facts__confidence">${escapeText(PROFILE_CONFIDENCE_NOTE)} Source: ${escapeText(
      window?.source ?? RESEARCH_SOURCE
    )}.</p>` +
    `<ul class="notes facts__rules">${ruleItems}</ul>` +
    consensus;
  return section(
    'This encounter, sourced',
    encounter.name + ': the rules the loadout is bent around',
    body
  );
}

/** The honest page for an encounter with nothing to maximize. */
export function noDpsSection(ev: EncounterVerdict): string {
  const note = ev.noDps!;
  const rules =
    ev.cards.length > 0
      ? `<ul class="notes">${ev.cards
          .map((card) => `<li>${escapeText(card.body)} <span class="src">${escapeText(card.source)}</span></li>`)
          .join('')}</ul>`
      : '';
  return (
    `<section class="section answer" id="answer">` +
    `<div class="eyebrow">${escapeText(ev.activity.name)}</div>` +
    `<h1 class="answer__headline">${escapeText(ev.encounter.name)}: ${escapeText(note.title.toLowerCase())}</h1>` +
    `<p class="prose">${escapeText(note.body)}</p>` +
    rules +
    `</section>`
  );
}

/** Options B and C: the next-best legal ways to spend the exotic seat. */
export function alternativesSection(alternatives: LoadoutAlternative[]): string {
  if (alternatives.length === 0) return '';
  const letters = ['B', 'C', 'D'];
  const blocks = alternatives
    .map((alt, index) => {
      const label = alt.equippedExoticId
        ? 'spends the exotic seat on ' +
          (alt.slots.find((s) => s.item?.id === alt.equippedExoticId)?.item?.name ?? alt.equippedExoticId)
        : 'runs no exotic weapon at all';
      const rows = alt.slots
        .map((slot) => {
          if (!slot.item) {
            return `<div class="alt__row"><span class="alt__slot">${escapeText(slot.slot)}</span>` +
              `<span class="alt__name alt__name--empty">nothing tiered fits this seat</span></div>`;
          }
          const exotic = BAKED_ITEMS[slot.item.id]?.tierType === 6 ? ' <span class="alt__exotic">exotic</span>' : '';
          const owned = slot.buildable ? '' : ' <span class="alt__missing">not owned</span>';
          return (
            `<div class="alt__row"><span class="alt__slot">${escapeText(slot.slot)}</span>` +
            `<span class="alt__name">${escapeText(slot.item.name)}</span> ${tierChip(slot.item.tierLabel)}${exotic}${owned}</div>`
          );
        })
        .join('');
      return (
        `<div class="alt" data-alt="${letters[index] ?? index}">` +
        `<div class="alt__title">Option ${letters[index] ?? index + 1}: ${escapeText(label)}</div>` +
        rows +
        `</div>`
      );
    })
    .join('');
  const body =
    `<p class="prose">The answer above is the best legal combination this engine can defend. These are the next-best ` +
    `LEGAL builds that are meaningfully different - a different exotic seat or none - not a one-slot reshuffle. ` +
    `Every one obeys the one-exotic rule by construction.</p>` +
    blocks;
  return section('Other legal builds', 'If the answer does not suit you', body);
}

// ----------------------------------------------------------------- arsenal

const ARSENAL_TITLE = 'Everything you own that fits';

/** The empty shell; the app fills it after the lazy chunk arrives. */
export function arsenalShellSection(autoLoad: boolean): string {
  const body = autoLoad
    ? `<p class="prose" id="arsenal-status">Reading your full arsenal (loads separately so the page stays fast)...</p>` +
      `<div id="arsenal-table"></div>`
    : `<p class="prose">The full arsenal table (all 900+ weapons, your rolls against the damage-perk list) loads on demand ` +
      `so the first paint stays light.</p>` +
      `<button class="btn btn--ghost" type="button" id="arsenal-load">Load the arsenal table</button>` +
      `<div id="arsenal-table"></div>`;
  return (
    `<section class="section section--rule" id="arsenal">` +
    `<div class="eyebrow">The deep inventory</div>` +
    `<h2 class="section__title">${escapeText(ARSENAL_TITLE)}</h2>` +
    body +
    `</section>`
  );
}

function rollLineFor(row: RankedArsenalRow): string {
  if (row.weapon.tierType === 6) {
    return 'Exotic: perks are fixed, so the damage-roll layer does not apply.';
  }
  if (row.rollPerks === null) {
    return 'Sockets not readable for your copies; the roll is reported unknown, not guessed.';
  }
  if (row.rollPerks.length > 0) {
    return 'Your roll: ' + row.rollPerks.join(' + ') + '.';
  }
  if (row.wishlist.length > 0) {
    return 'Your copy lacks a damage roll; wishlist: ' + row.wishlist.join(', ') + '.';
  }
  return 'No curated damage perk can roll on this weapon.';
}

/** The ranked, filterable owned-arsenal table. Pure string in, string out. */
export function arsenalTableHtml(
  ranked: RankedArsenal,
  filters: ArsenalFilters,
  iconPrefix: string,
  contextLabel: string
): string {
  const filtered = ranked.rows.filter((row) => {
    if (filters.slot !== 'all' && row.weapon.slot !== filters.slot) return false;
    if (filters.archetype !== 'all' && row.weapon.archetype !== filters.archetype) return false;
    if (filters.damageRollOnly && !(row.rollPerks && row.rollPerks.length > 0)) return false;
    return true;
  });

  const slotChips = (['all', 'kinetic', 'energy', 'power'] as const)
    .map(
      (slot) =>
        `<button class="chip${filters.slot === slot ? ' chip--on' : ''}" type="button" data-arsslot="${slot}">` +
        `${slot === 'all' ? 'All slots' : slot.charAt(0).toUpperCase() + slot.slice(1)}</button>`
    )
    .join('');
  const archetypes = [...new Set(ranked.rows.map((r) => r.weapon.archetype))].sort();
  const archetypeOptions =
    `<option value="all"${filters.archetype === 'all' ? ' selected' : ''}>All archetypes</option>` +
    archetypes
      .map(
        (a) =>
          `<option value="${escapeText(a)}"${filters.archetype === a ? ' selected' : ''}>${escapeText(a)}</option>`
      )
      .join('');
  const rollChip =
    `<button class="chip${filters.damageRollOnly ? ' chip--on' : ''}" type="button" data-arsroll="toggle">` +
    `Has damage roll</button>`;

  const rows = filtered
    .map((row) => {
      const icon = row.weapon.icon
        ? `<img class="ars__icon" src="${escapeText(iconUrl(iconPrefix + row.weapon.icon))}" alt="" width="36" height="36" loading="lazy" />`
        : '';
      const tier = row.tierLabel
        ? ` ${tierChip(row.tierLabel)}`
        : '';
      const flags = row.flags
        .map((flag) => `<span class="ars__flag" data-flag="${escapeText(flag.ruleId)}">${escapeText(flag.text)}</span>`)
        .join('');
      const unsourced = row.archetypeSourced
        ? ''
        : `<span class="ars__unsourced" title="This archetype sits outside the sourced order and is listed, not ranked.">unranked tail</span>`;
      return (
        `<div class="ars__row" data-hash="${row.weapon.hash}">` +
        icon +
        `<div class="ars__main"><span class="ars__name">${escapeText(row.weapon.name)}</span>${tier}` +
        `<span class="ars__meta">${escapeText(row.weapon.slot)} - ${escapeText(row.weapon.itemTypeDisplayName)}` +
        `${row.weapon.frame ? ' - ' + escapeText(row.weapon.frame) : ''}` +
        `${row.instanceCount > 1 ? ' - x' + row.instanceCount : ''}</span>` +
        `<span class="ars__roll">${escapeText(rollLineFor(row))}</span>` +
        flags +
        unsourced +
        `</div></div>`
      );
    })
    .join('');

  const excluded =
    ranked.excluded.length > 0
      ? `<div class="ars__excluded"><b>Excluded here (${ranked.excluded.length}):</b> ` +
        ranked.excluded
          .map(
            (x) =>
              `<span class="ars__exname" data-flag="${escapeText(x.flag.ruleId)}">${escapeText(
                x.row.weapon.name
              )}</span>`
          )
          .join(', ') +
        `<p class="ars__exwhy">${escapeText(ranked.excluded[0].flag.text)}</p></div>`
      : '';

  return (
    `<p class="prose">Owned weapons only, ranked for ${escapeText(contextLabel)}. ${escapeText(ranked.orderNote)}</p>` +
    `<div class="ars__filters" id="arsenal-filters">${slotChips}` +
    `<select id="ars-archetype" class="picker__select" aria-label="Filter by archetype">${archetypeOptions}</select>` +
    rollChip +
    `</div>` +
    `<div class="ars">${rows || '<p class="prose">Nothing owned matches these filters.</p>'}</div>` +
    excluded
  );
}

// ------------------------------------------------------------------- extras

export function classNotesSection(verdict: Verdict): string {
  if (verdict.classNotes.length === 0) return '';
  const items = verdict.classNotes
    .map(
      (note) =>
        `<li>${escapeText(note.note)} <span class="src">${escapeText(note.source)}</span></li>`
    )
    .join('');
  const body = `<ul class="notes">${items}</ul>`;
  return section('Class notes', 'The ' + CLASS_NAMES[verdict.classType] + ' fine print', body);
}

export function footerSection(): string {
  return (
    `<footer class="foot">` +
    `<span class="foot__stamp">${escapeText(DATA_STAMP)}</span>` +
    `<span>Tiers: ${escapeText(TIER_SOURCE)} &middot; manifest ${escapeText(MANIFEST_VERSION)}</span>` +
    `<span><a href="https://github.com/keivanmalhani/dps-maximizer">Source on GitHub</a>` +
    ` &middot; <a href="https://www.bungie.net/7/en/User/Account/Privacy">your Bungie privacy settings</a>` +
    ` &middot; not affiliated with Bungie</span>` +
    `</footer>`
  );
}

/** Everything below the masthead, assembled. */
export function resultPage(
  model: PageModel,
  verdict: Verdict,
  account: SignInView,
  extras: PageExtras = {}
): string {
  const ev = extras.encounter;
  if (ev && ev.noDps) {
    return (
      `<div class="shell">` +
      runbar(model, account) +
      pickerSection(model) +
      noDpsSection(ev) +
      buffsSection() +
      footerSection() +
      `</div>`
    );
  }
  const alternatives = extras.alternatives ?? ev?.alternatives ?? [];
  const showArsenal = !verdict.outOfScope;
  return (
    `<div class="shell">` +
    runbar(model, account) +
    pickerSection(model) +
    answerSection(verdict, ev) +
    (ev ? encounterFactsSection(ev) : '') +
    (verdict.outOfScope ? '' : alternativesSection(alternatives)) +
    rotationSection(verdict) +
    (showArsenal ? arsenalShellSection(extras.arsenalAuto ?? false) : '') +
    nextUnlockSection(verdict) +
    (verdict.outOfScope ? '' : statsSection(model)) +
    buffsSection() +
    classNotesSection(verdict) +
    footerSection() +
    `</div>`
  );
}
