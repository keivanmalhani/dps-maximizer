// Drawing the armoury. Strings in, strings out, no DOM and no fetching.
//
// The layout is a matrix, because that is what the thing being described
// actually is: slots down the side, characters and the vault across the top.
// DIM settled on this shape years ago and it is not an accident. A player
// asks "what is in my power slot" far more often than "what is on my Titan",
// and a row per slot answers the first question by looking along a line.
//
// Everything here is a pure function so the whole layout is testable without
// a browser. The controller in armory-panel.ts owns events and is the only
// place a write can start.

import { escapeText } from '../format';
import {
  ARMOR_BUCKETS,
  BUCKET_LABELS,
  EQUIP_BUCKETS,
  WEAPON_BUCKETS,
  iconUrl,
  isExotic,
  itemName,
  matchesArmoryQuery,
  parseArmoryQuery,
  type Armory,
  type ArmoryCharacter,
  type ArmoryData,
  type ArmoryItem,
  type PlugData
} from '../armory';
import type { ApplyPlan, Loadout } from '../loadouts';

/** How many carried or vaulted items a cell shows before it offers the rest. */
export const CELL_PREVIEW = 9;

export interface ArmoryViewModel {
  armory: Armory;
  data: ArmoryData;
  query: string;
  /** Instance id of the open detail panel, or null. */
  selected: string | null;
  /** Session-level arming. Nothing can be written while this is false. */
  liveChanges: boolean;
  loadouts: Loadout[];
  /** Free text under the bar: progress, results, refusals. */
  status: string;
  /** Vault cells expand one at a time, keyed by bucket. */
  expandedBucket: number | null;
}

// ------------------------------------------------------------------- tiles

function tierClass(item: ArmoryItem): string {
  if (!item.def) return 'tile--unknown';
  if (item.def[3] === 6) return 'tile--exotic';
  if (item.def[3] === 5) return 'tile--legendary';
  return 'tile--common';
}

/**
 * One item. A button, not a div, because the whole grid has to be reachable
 * from a keyboard and every one of these is an action.
 *
 * The title attribute carries the same words the detail panel shows. That is
 * not decoration: a grid of icons is unusable for anyone who cannot tell two
 * hand cannons apart at 42 pixels, and the accessible name has to say what
 * the picture says.
 */
export function tile(item: ArmoryItem, data: ArmoryData, selected: boolean): string {
  const name = itemName(item);
  const icon = item.def ? iconUrl(data, item.def[1]) : '';
  const type = item.def ? item.def[8] : 'Unknown';
  const power = item.power === null ? '' : String(item.power);
  const badges: string[] = [];
  if (item.equipped) badges.push('<span class="tile__badge tile__badge--on" title="Equipped">E</span>');
  if (item.locked) badges.push('<span class="tile__badge" title="Locked">L</span>');
  if (item.masterworked) badges.push('<span class="tile__badge tile__badge--mw" title="Masterworked">M</span>');
  if (item.crafted) badges.push('<span class="tile__badge" title="Crafted">C</span>');

  const label = name + ', ' + type + (power ? ', power ' + power : '') + (item.equipped ? ', equipped' : '');

  return (
    `<button type="button" class="tile ${tierClass(item)}${item.equipped ? ' tile--equipped' : ''}` +
    `${selected ? ' tile--selected' : ''}" data-instance="${escapeText(item.instanceId ?? '')}" ` +
    `title="${escapeText(label)}" aria-label="${escapeText(label)}">` +
    (icon
      ? `<img class="tile__img" src="${escapeText(icon)}" alt="" loading="lazy" decoding="async" width="48" height="48" />`
      : `<span class="tile__img tile__img--none" aria-hidden="true"></span>`) +
    (power ? `<span class="tile__power">${escapeText(power)}</span>` : '') +
    (badges.length ? `<span class="tile__badges">${badges.join('')}</span>` : '') +
    `</button>`
  );
}

function cell(
  items: ArmoryItem[],
  equipped: ArmoryItem | null,
  model: ArmoryViewModel,
  bucket: number,
  expandable: boolean
): string {
  const query = parseArmoryQuery(model.query);
  const filtered = items.filter((item) => matchesArmoryQuery(item, query));
  const expanded = model.expandedBucket === bucket;
  const shown = expanded ? filtered : filtered.slice(0, CELL_PREVIEW);
  const hidden = filtered.length - shown.length;

  const head =
    equipped && matchesArmoryQuery(equipped, query)
      ? `<div class="cell__equipped">${tile(equipped, model.data, model.selected === equipped.instanceId)}</div>`
      : '';

  const rest = shown
    .map((item) => tile(item, model.data, model.selected === item.instanceId))
    .join('');

  const more =
    hidden > 0 && expandable
      ? `<button type="button" class="cell__more" data-expand="${bucket}">+${hidden} more</button>`
      : hidden > 0
        ? `<span class="cell__more cell__more--flat">+${hidden}</span>`
        : expanded
          ? `<button type="button" class="cell__more" data-expand="0">show less</button>`
          : '';

  if (!head && shown.length === 0) {
    return `<div class="cell cell--empty"><span class="cell__none">nothing here</span></div>`;
  }
  return `<div class="cell">${head}<div class="cell__grid">${rest}</div>${more}</div>`;
}

// ----------------------------------------------------------------- the grid

function characterHead(character: ArmoryCharacter): string {
  const emblem = character.emblemPath ? 'https://www.bungie.net' + character.emblemPath : '';
  return (
    `<div class="charcard"${emblem ? ` style="background-image:linear-gradient(90deg,rgba(16,18,23,.92),rgba(16,18,23,.55)),url('${escapeText(emblem)}')"` : ''}>` +
    `<div class="charcard__class">${escapeText(character.className)}</div>` +
    `<div class="charcard__power">${character.light}</div>` +
    `<button type="button" class="charcard__save" data-snapshot="${escapeText(character.characterId)}">Save what is on</button>` +
    `</div>`
  );
}

export function grid(model: ArmoryViewModel): string {
  const { armory } = model;
  const columns = armory.characters.length + 1;
  const heads =
    `<div class="armoury__corner"></div>` +
    armory.characters.map(characterHead).join('') +
    `<div class="charcard charcard--vault"><div class="charcard__class">Vault</div>` +
    `<div class="charcard__power">everything not carried</div></div>`;

  const section = (label: string, buckets: readonly number[]): string =>
    `<div class="armoury__band">${escapeText(label)}</div>` +
    buckets
      .map((bucket) => {
        const cells = armory.characters
          .map((character) =>
            cell(
              character.carried.get(bucket) ?? [],
              character.equipped.get(bucket) ?? null,
              model,
              bucket,
              false
            )
          )
          .join('');
        const vaultCell = cell(armory.vault.get(bucket) ?? [], null, model, bucket, true);
        return (
          `<div class="armoury__slot">${escapeText(BUCKET_LABELS[bucket] ?? String(bucket))}</div>` +
          cells +
          vaultCell
        );
      })
      .join('');

  return (
    `<div class="armoury__grid" style="--cols:${columns}">` +
    heads +
    section('Weapons', WEAPON_BUCKETS) +
    section('Armour', ARMOR_BUCKETS) +
    `</div>`
  );
}

// -------------------------------------------------------------- the details

function statLine(data: ArmoryData, statHash: number, value: number): string {
  const name = data.stats[String(statHash)] ?? 'Stat ' + statHash;
  const width = Math.max(0, Math.min(100, Math.round((value / 100) * 100)));
  return (
    `<div class="detail__stat"><span class="detail__statname">${escapeText(name)}</span>` +
    `<span class="detail__bar"><span style="width:${width}%"></span></span>` +
    `<span class="detail__statval num">${value}</span></div>`
  );
}

/**
 * The detail panel. Perk names come from the lazily loaded plug table, and
 * while that is still in flight the panel says so instead of rendering a
 * list of hashes, which is the version of this that looks broken.
 */
export function detail(
  item: ArmoryItem,
  model: ArmoryViewModel,
  plugs: PlugData | null,
  owners: ArmoryCharacter[]
): string {
  const name = itemName(item);
  const icon = item.def ? iconUrl(model.data, item.def[1]) : '';
  const type = item.def ? item.def[8] : '';
  const where = item.owner
    ? (owners.find((c) => c.characterId === item.owner)?.className ?? 'a character') +
      (item.equipped ? ', equipped' : ', carried')
    : 'the vault';

  const perkHtml = plugs
    ? item.plugs
        .map((hash) => plugs.plugs[String(hash)])
        .filter((row): row is [string, string, string, string] => !!row)
        .map(
          (row) =>
            `<li class="detail__perk"><span class="detail__perkname">${escapeText(row[0])}</span>` +
            (row[2] ? `<span class="detail__perkbody">${escapeText(row[2])}</span>` : '') +
            `</li>`
        )
        .join('')
    : '';

  const perks = plugs
    ? perkHtml
      ? `<ul class="detail__perks">${perkHtml}</ul>`
      : `<p class="detail__none">This copy has no perks the bake recognises.</p>`
    : `<p class="detail__none">Reading the perk table, which loads separately so the grid stays fast...</p>`;

  const stats = Object.entries(item.stats)
    .map(([statHash, value]) => statLine(model.data, Number(statHash), value))
    .join('');

  const actions: string[] = [];
  if (!model.liveChanges) {
    actions.push(
      `<p class="detail__armnote">Changes are switched off. Turn on live changes at the top to equip or move anything.</p>`
    );
  } else if (item.instanceId) {
    for (const owner of owners) {
      if (item.owner === owner.characterId && item.equipped) continue;
      if (item.def && item.def[6] !== 3 && item.def[6] !== owner.classType) continue;
      const same = item.owner === owner.characterId;
      actions.push(
        `<button type="button" class="btn btn--small" data-equipon="${escapeText(owner.characterId)}" ` +
          `data-instance="${escapeText(item.instanceId)}">` +
          (same ? 'Equip here' : 'Move to ' + escapeText(owner.className) + ' and equip') +
          `</button>`
      );
    }
    if (item.owner !== null && !item.equipped) {
      actions.push(
        `<button type="button" class="btn btn--small btn--quiet" data-tovault="${escapeText(item.instanceId)}">Send to vault</button>`
      );
    }
    actions.push(
      `<button type="button" class="btn btn--small btn--quiet" data-lock="${escapeText(item.instanceId)}">` +
        (item.locked ? 'Unlock' : 'Lock') +
        `</button>`
    );
  }

  return (
    `<aside class="detail" id="detail" role="dialog" aria-label="${escapeText(name)}">` +
    `<button type="button" class="detail__close" data-close="1" aria-label="Close">x</button>` +
    `<div class="detail__head">` +
    (icon ? `<img class="detail__icon" src="${escapeText(icon)}" alt="" width="72" height="72" />` : '') +
    `<div><h3 class="detail__name${isExotic(item) ? ' detail__name--exotic' : ''}">${escapeText(name)}</h3>` +
    `<div class="detail__type">${escapeText(type)}${item.power !== null ? ' &middot; ' + item.power : ''}</div>` +
    `<div class="detail__where">In ${escapeText(where)}</div></div></div>` +
    (stats ? `<div class="detail__stats">${stats}</div>` : '') +
    `<h4 class="detail__sub">Perks on this copy</h4>` +
    perks +
    `<div class="detail__actions">${actions.join('')}</div>` +
    `</aside>`
  );
}

// ------------------------------------------------------------- the loadouts

export function loadoutList(model: ArmoryViewModel): string {
  if (model.loadouts.length === 0) {
    return (
      `<p class="loadouts__empty">No saved loadouts yet. "Save what is on" under any character ` +
      `captures what that Guardian is wearing right now, which is the cheapest safety net there is ` +
      `before you start experimenting.</p>`
    );
  }
  const rows = model.loadouts
    .map(
      (loadout) =>
        `<li class="loadouts__row"><span class="loadouts__name">${escapeText(loadout.name)}</span>` +
        `<span class="loadouts__meta">${loadout.items.length} items &middot; saved ${escapeText(loadout.saved)}</span>` +
        `<span class="loadouts__acts">` +
        model.armory.characters
          .map(
            (character) =>
              `<button type="button" class="btn btn--small" data-apply="${escapeText(loadout.id)}" ` +
              `data-onchar="${escapeText(character.characterId)}">Apply to ${escapeText(character.className)}</button>`
          )
          .join('') +
        `<button type="button" class="btn btn--small btn--quiet" data-forget="${escapeText(loadout.id)}">Delete</button>` +
        `</span></li>`
    )
    .join('');
  return `<ul class="loadouts__list">${rows}</ul>`;
}

/**
 * The plan, written out for a human before anything moves. This is the
 * sentence write.ts demands a confirmation for, and it is generated from the
 * same structure that will execute, so it cannot drift from what happens.
 */
export function planDialog(plan: ApplyPlan, loadoutName: string): string {
  const steps = plan.steps.map((step) => `<li>${escapeText(step.why)}</li>`).join('');
  const blockers = plan.blockers
    .map(
      (blocker) =>
        `<li><strong>${escapeText(blocker.itemName)}</strong>: ${escapeText(blocker.reason)}` +
        (blocker.fix ? ' ' + escapeText(blocker.fix) : '') +
        `</li>`
    )
    .join('');
  return (
    `<div class="plan" id="plan" role="dialog" aria-label="Apply ${escapeText(loadoutName)}">` +
    `<h3 class="plan__title">${escapeText(plan.summary)}</h3>` +
    (steps ? `<h4 class="plan__sub">What will happen, in order</h4><ol class="plan__steps">${steps}</ol>` : '') +
    (blockers ? `<h4 class="plan__sub plan__sub--warn">What cannot be done</h4><ul class="plan__blockers">${blockers}</ul>` : '') +
    (plan.alreadyOn.length
      ? `<p class="plan__already">Already on: ${escapeText(plan.alreadyOn.join(', '))}.</p>`
      : '') +
    `<div class="plan__acts">` +
    (plan.steps.length
      ? `<button type="button" class="btn btn--primary" data-planrun="1">Do it</button>`
      : '') +
    `<button type="button" class="btn btn--quiet" data-plancancel="1">Cancel</button>` +
    `</div></div>`
  );
}

// ------------------------------------------------------------------ the bar

export function bar(model: ArmoryViewModel): string {
  const query = parseArmoryQuery(model.query);
  const unknown = query.unknown.length
    ? `<span class="armoury__hint">No filter called is:${escapeText(query.unknown[0])}. ` +
      `The ones that exist are ${escapeText(['exotic', 'legendary', 'masterwork', 'crafted', 'locked', 'equipped', 'vault', 'weapon', 'armor'].join(', is:'))}.</span>`
    : '';
  const total = model.armory.byInstance.size;
  return (
    `<div class="armoury__bar">` +
    `<input id="armoury-q" class="armoury__q" type="search" placeholder="sunshot, or is:exotic is:vault" ` +
    `value="${escapeText(model.query)}" aria-label="Filter the armoury" />` +
    `<label class="armoury__live"><input type="checkbox" id="armoury-live"${model.liveChanges ? ' checked' : ''} /> ` +
    `Live changes</label>` +
    `<span class="armoury__count num">${total} items read</span>` +
    unknown +
    `</div>` +
    `<div class="armoury__status" id="armoury-status">${model.status ? escapeText(model.status) : ''}</div>`
  );
}

export function armoryPage(model: ArmoryViewModel): string {
  return (
    `<section class="armoury" id="armoury-panel">` +
    bar(model) +
    grid(model) +
    `<section class="loadouts"><h3 class="loadouts__title">Loadouts</h3>` +
    loadoutList(model) +
    `</section>` +
    `<div id="armoury-overlay"></div>` +
    `</section>`
  );
}

/** The slots the grid draws, exported so a test can assert nothing is missed. */
export const GRID_BUCKETS = EQUIP_BUCKETS;
