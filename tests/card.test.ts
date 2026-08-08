// The share card: model building and drawing against a recording context,
// so the OG image cannot silently diverge from the page.

import { describe, expect, it } from 'vitest';
import { buildDemoProfile, DEMO_FLAG_LINE } from '../fixtures/demo';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  cardModelFromVerdict,
  drawCard,
  wrapText,
  type DrawingContext
} from '../src/card';
import { parseProfile } from '../src/ownership';
import { recommend } from '../src/recommend';

function recordingContext(): { ctx: DrawingContext; texts: string[]; rects: number } {
  const texts: string[] = [];
  let rects = 0;
  const ctx: DrawingContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textBaseline: 'alphabetic',
    fillRect: () => {
      rects += 1;
    },
    strokeRect: () => undefined,
    fillText: (text: string) => {
      texts.push(text);
    },
    measureText: (text: string) => ({ width: text.length * 12 })
  };
  return { ctx, texts, rects: rects };
}

const data = parseProfile(buildDemoProfile());
const verdict = recommend(data, 0, 'boss-burst');
const model = cardModelFromVerdict(verdict, 0, DEMO_FLAG_LINE);

describe('the card model', () => {
  it('is 1200 by 630, the size everything expects', () => {
    expect(CARD_WIDTH).toBe(1200);
    expect(CARD_HEIGHT).toBe(630);
  });

  it('carries the weapon rows and the armor row', () => {
    expect(model.rows.length).toBe(4);
    expect(model.rows.map((r) => r.slot)).toContain('Exotic armor');
  });

  it('marks unowned rows so the card shows the gap too', () => {
    const armor = model.rows.find((r) => r.slot === 'Exotic armor')!;
    expect(armor.owned).toBe(true);
    // The demo lacks nothing in its picks except via ideal notes; force a
    // missing row through an empty account instead.
    const bare = cardModelFromVerdict(
      recommend(parseProfile({}), 0, 'boss-burst'),
      0,
      DEMO_FLAG_LINE
    );
    expect(bare.rows.some((r) => !r.owned)).toBe(true);
  });

  it('names the next unlock and the super', () => {
    expect(model.unlockLine).toContain('Hezen Vengeance');
    expect(model.superLine).toContain('Thundercrash');
  });

  it('carries the stamp and the site', () => {
    expect(model.stamp).toContain('Update 9.7.0.4');
    expect(model.site).toBe('keivanmalhani.github.io/dps-maximizer');
  });

  it('flags the demo in the eyebrow', () => {
    expect(model.eyebrow).toContain('invented account');
  });
});

describe('wrapText', () => {
  it('wraps greedily at the width', () => {
    const { ctx } = recordingContext();
    const lines = wrapText(ctx, 'one two three four', '400 10px x', 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four');
  });

  it('never drops a word even when one word overflows', () => {
    const { ctx } = recordingContext();
    const lines = wrapText(ctx, 'supercalifragilistic', '400 10px x', 10);
    expect(lines).toEqual(['supercalifragilistic']);
  });
});

describe('drawCard', () => {
  it('draws every row name, the stamp and the wordmark', () => {
    const recorder = recordingContext();
    drawCard(recorder.ctx, model);
    const drawn = recorder.texts.join('\n');
    expect(drawn).toContain('DPS MAXIMIZER');
    for (const row of model.rows) expect(drawn).toContain(row.name);
    expect(drawn).toContain(model.stamp);
    expect(drawn).toContain(model.site);
  });

  it('writes MISSING beside rows the player cannot build', () => {
    const bare = cardModelFromVerdict(
      recommend(parseProfile({}), 0, 'boss-burst'),
      0,
      DEMO_FLAG_LINE
    );
    const recorder = recordingContext();
    drawCard(recorder.ctx, bare);
    expect(recorder.texts).toContain('MISSING');
  });
});
