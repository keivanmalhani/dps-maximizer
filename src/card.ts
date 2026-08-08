// The 1200x630 Open Graph card, drawn by the site's own code so the image
// scripts/render-og.mjs produces cannot drift from what the page says.
//
// Pure layout and drawing over a minimal context interface: the browser's
// CanvasRenderingContext2D satisfies it, and so does @napi-rs/canvas in the
// render script. No DOM, no fetch, so the layout is testable.

import type { Verdict } from './recommend';
import { DATA_STAMP } from './data/tiers';
import { CLASS_NAMES } from './types';
import type { GuardianClass } from './types';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface DrawingContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
}

export interface CardRow {
  slot: string;
  name: string;
  tier: string;
  owned: boolean;
}

export interface CardModel {
  eyebrow: string;
  headline: string;
  rows: CardRow[];
  superLine: string;
  unlockLine: string;
  stamp: string;
  site: string;
}

/** The card is the demo verdict, reduced to what fits at a glance. */
export function cardModelFromVerdict(
  verdict: Verdict,
  classType: GuardianClass,
  flagLine: string
): CardModel {
  const rows: CardRow[] = verdict.slots
    .filter((slot) => slot.pick !== null)
    .map((slot) => ({
      slot: slot.pick!.slotName,
      name: slot.pick!.name,
      tier: slot.pick!.tierLabel,
      owned: slot.pick!.buildableNow
    }));
  if (verdict.armor) {
    rows.push({
      slot: 'Exotic armor',
      name: verdict.armor.name,
      tier: verdict.armor.tierLabel,
      owned: verdict.armor.buildableNow
    });
  }
  return {
    eyebrow: flagLine,
    headline:
      'The best ' + CLASS_NAMES[classType] + ' boss damage you can build from what you own.',
    rows,
    superLine: verdict.superRec ? 'Super: ' + verdict.superRec.superName : '',
    unlockLine: verdict.nextUnlock
      ? 'Next unlock: ' + verdict.nextUnlock.name + ' (' + verdict.nextUnlock.tierLabel + ')'
      : '',
    stamp: DATA_STAMP,
    site: 'keivanmalhani.github.io/dps-maximizer'
  };
}

const INK = '#0a0b0e';
const PANEL = '#101217';
const LINE = '#1c2028';
const TEXT = '#e9e6df';
const MUTED = '#8b909b';
const FAINT = '#5a606c';
const ACCENT = '#e2593c';

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Only the hundred weights: @napi-rs/canvas's shorthand parser chokes on
 * in-between values like 650 and falls back by treating the weight as a
 * size, which renders six-hundred-pixel glyphs. Found the fun way.
 */
function font(size: number, weight: 400 | 600 | 700 = 400): string {
  return weight + ' ' + size + 'px ' + FONT;
}

/** Word-wrap a line to a width, greedy, for the headline. */
export function wrapText(
  ctx: DrawingContext,
  text: string,
  fontSpec: string,
  maxWidth: number
): string[] {
  ctx.font = fontSpec;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const attempt = current === '' ? word : current + ' ' + word;
    if (ctx.measureText(attempt).width <= maxWidth || current === '') {
      current = attempt;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

export function drawCard(ctx: DrawingContext, model: CardModel): void {
  ctx.textBaseline = 'alphabetic';

  // Ground.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // The mark: three rising bars, the tall one lit.
  const barX = 64;
  const barBase = 108;
  ctx.fillStyle = FAINT;
  ctx.fillRect(barX, barBase - 22, 12, 22);
  ctx.fillRect(barX + 20, barBase - 38, 12, 38);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(barX + 40, barBase - 58, 12, 58);

  ctx.fillStyle = MUTED;
  ctx.font = font(24, 600);
  ctx.fillText('DPS MAXIMIZER', barX + 74, barBase - 8);

  ctx.fillStyle = FAINT;
  ctx.font = font(18, 400);
  ctx.fillText(model.eyebrow, barX, 152);

  // Headline, at most two lines.
  const headlineLines = wrapText(ctx, model.headline, font(46, 700), 1072);
  ctx.fillStyle = TEXT;
  ctx.font = font(46, 700);
  let y = 214;
  for (const line of headlineLines.slice(0, 2)) {
    ctx.fillText(line, barX, y);
    y += 56;
  }

  // The loadout rows.
  const rowTop = y - 24;
  const rowHeight = 48;
  const boxHeight = rowHeight * model.rows.length + 12;
  ctx.fillStyle = PANEL;
  ctx.fillRect(barX, rowTop, 1072, boxHeight);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, rowTop, 1072, boxHeight);

  model.rows.forEach((row, index) => {
    const rowY = rowTop + 38 + index * rowHeight;
    ctx.fillStyle = FAINT;
    ctx.font = font(16, 600);
    ctx.fillText(row.slot.toUpperCase(), barX + 28, rowY);
    ctx.fillStyle = row.owned ? TEXT : MUTED;
    ctx.font = font(26, 600);
    ctx.fillText(row.name, barX + 230, rowY);
    const tierX = barX + 250 + ctx.measureText(row.name).width;
    ctx.fillStyle = row.tier === 'Tier 1' ? ACCENT : FAINT;
    ctx.font = font(16, 700);
    ctx.fillText(row.tier.toUpperCase(), tierX, rowY - 2);
    if (!row.owned) {
      ctx.fillStyle = ACCENT;
      ctx.font = font(15, 600);
      ctx.fillText('MISSING', barX + 975, rowY - 2);
    }
  });

  const below = rowTop + boxHeight + 40;
  ctx.fillStyle = MUTED;
  ctx.font = font(21, 600);
  const superWidth = model.superLine ? ctx.measureText(model.superLine).width : 0;
  if (model.superLine) ctx.fillText(model.superLine, barX, below);
  if (model.unlockLine) {
    ctx.fillStyle = ACCENT;
    ctx.font = font(21, 600);
    ctx.fillText(model.unlockLine, barX + superWidth + (model.superLine ? 44 : 0), below);
  }

  // The stamp, always.
  ctx.fillStyle = MUTED;
  ctx.font = font(16, 600);
  ctx.fillText(model.site, barX, CARD_HEIGHT - 56);
  ctx.fillStyle = FAINT;
  ctx.font = font(15, 400);
  ctx.fillText(model.stamp, barX, CARD_HEIGHT - 28);
}
