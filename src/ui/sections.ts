// The page, top to bottom. Every function here returns markup for one
// section; none of them fetch anything. The order on the page is the order
// of the product: the answer first, then what it asks of you, then what to
// go unlock, then the knowledge that replaces tribal knowledge.

import { ARMOR_STATS_SOURCE, POWERHOUSE_NOTE, STAT_EFFECTS } from '../data/armor-stats';
import { BUCKETS, BUFFS_SOURCE, MYTHS, ODDITIES, PENDING_NOTE } from '../data/buffs';
import { iconUrl, MANIFEST_VERSION, BAKED_ITEMS } from '../data/items';
import { DATA_STAMP, TIER_SOURCE } from '../data/tiers';
import { escapeText, clampStat } from '../format';
import type { Pick, SlotAnswer, Verdict } from '../recommend';
import type { SignInView } from '../signin';
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

export function pickerSection(model: PageModel): string {
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
        `<button class="chip${activity === model.activity ? ' chip--on' : ''}" type="button" ` +
        `data-activity="${activity}">${escapeText(ACTIVITY_LABELS[activity])}</button>`
    )
    .join('');

  return (
    `<section class="picker" id="picker">` +
    `<div class="picker__group"><span class="picker__label">Class</span>${classButtons}</div>` +
    `<div class="picker__group"><span class="picker__label">Doing what</span>${activityButtons}</div>` +
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

export function answerSection(verdict: Verdict): string {
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
      if (!slot.pick) return emptySlotCard(slot);
      const exclusive = slot.exclusivityNote
        ? `<p class="pick__ideal pick__exclusive">${escapeText(slot.exclusivityNote)}</p>`
        : '';
      const ideal = slot.idealNote
        ? `<p class="pick__ideal">${escapeText(slot.idealNote)}</p>`
        : '';
      return pickCard(slot.pick, slot.pick.slotName) + exclusive + ideal;
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

  const fireteam =
    verdict.fireteamNotes.length > 0
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

  return (
    `<section class="section answer" id="answer">` +
    `<div class="eyebrow">The answer</div>` +
    `<h1 class="answer__headline">${escapeText(verdict.headline)}</h1>` +
    `<p class="answer__subline">${escapeText(verdict.subline)}</p>` +
    `<div class="answer__grid">${slotCards}${armor}${superCard}</div>` +
    fireteam +
    champions +
    warningCards +
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
export function resultPage(model: PageModel, verdict: Verdict, account: SignInView): string {
  return (
    `<div class="shell">` +
    runbar(model, account) +
    pickerSection(model) +
    answerSection(verdict) +
    rotationSection(verdict) +
    nextUnlockSection(verdict) +
    (verdict.outOfScope ? '' : statsSection(model)) +
    buffsSection() +
    classNotesSection(verdict) +
    footerSection() +
    `</div>`
  );
}
