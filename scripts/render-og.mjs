/**
 * Renders the demo verdict's card to public/og.png at exactly 1200x630, for
 * the site's Open Graph / Twitter card meta tags.
 *
 * Deliberately not wired into the build. It needs a native canvas, and making
 * that a real devDependency would mean every clone of this repo downloads a
 * platform binary to produce one file that changes about once a year:
 *
 *   npm install --no-save @napi-rs/canvas
 *   node scripts/render-og.mjs
 *
 * (It already happens to be present here as an actual devDependency so the
 * one-command path works out of the box. The install line above is still the
 * right thing to write down: a clone that prunes devDependencies before
 * installing should not be stuck.)
 *
 * This mirrors weapon-report/scripts/render-og.mjs, including its bundler
 * note: this repo is on Vite 8, the Rolldown-powered build, so there is no
 * esbuild binary anywhere in node_modules, only rolldown, which is what Vite
 * itself bundles with here. Rolldown's CLI takes the same --format /
 * --platform / --file shape esbuild's --bundle does (it always bundles, so
 * there is no separate flag for that), so bundling the card's TypeScript
 * modules is a one-line exec, not a new tool.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const { createCanvas, GlobalFonts } = await import('@napi-rs/canvas').catch(() => {
  console.error('Missing canvas. Run: npm install --no-save @napi-rs/canvas');
  process.exit(1);
});

// The card modules are TypeScript, so bundle them with the bundler Vite
// already brings along rather than adding another tool.
const scratch = mkdtempSync(join(tmpdir(), 'dps-maximizer-og-'));
const entry = join(scratch, 'entry.ts');
const bundle = join(scratch, 'bundle.mjs');

writeFileSync(
  entry,
  `
import { buildDemoProfile, DEMO_FLAG_LINE } from ${JSON.stringify(join(root, 'fixtures/demo.ts'))};
import { parseProfile } from ${JSON.stringify(join(root, 'src/ownership.ts'))};
import { recommend } from ${JSON.stringify(join(root, 'src/recommend.ts'))};
import { cardModelFromVerdict, drawCard, CARD_WIDTH, CARD_HEIGHT } from ${JSON.stringify(join(root, 'src/card.ts'))};

export function makeCard() {
  const player = parseProfile(buildDemoProfile());
  const verdict = recommend(player, 0, 'boss-burst');
  return { verdict, model: cardModelFromVerdict(verdict, 0, DEMO_FLAG_LINE) };
}
export { drawCard, CARD_WIDTH, CARD_HEIGHT };
`
);

execFileSync(
  join(root, 'node_modules/.bin/rolldown'),
  [entry, '--format', 'esm', '--platform', 'node', '--file', bundle],
  { stdio: 'inherit' }
);

const { makeCard, drawCard, CARD_WIDTH, CARD_HEIGHT } = await import(`file://${bundle}`);

// Without this, glyphs like the apostrophe in "Praedyth's Revenge" can come
// out as tofu on a machine with no fonts preinstalled where napi-rs's own
// bundled fallback does not cover them.
if (GlobalFonts.loadSystemFonts) GlobalFonts.loadSystemFonts();

const { verdict, model } = makeCard();
const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
drawCard(canvas.getContext('2d'), model);

const out = join(root, 'public/og.png');
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(out, canvas.toBuffer('image/png'));
rmSync(scratch, { recursive: true, force: true });

console.log(`wrote ${out}`);
console.log(`headline: ${model.headline}`);
console.log(`rows: ${model.rows.map((r) => r.name).join(', ')}`);
console.log(`next unlock: ${verdict.nextUnlock ? verdict.nextUnlock.name : 'none'}`);
