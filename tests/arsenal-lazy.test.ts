// The performance budget as a test: arsenal.json is roughly half a megabyte
// and the first paint must never pay for it. The only reference to it in
// shipped source is the dynamic import inside src/arsenal.ts, so Vite splits
// it into its own chunk that loads on demand.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../fixtures', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('arsenal.json stays out of the first paint', () => {
  const sources = [...walk(SRC), ...walk(FIXTURES)];

  it('no source file imports arsenal.json statically', () => {
    for (const path of sources) {
      const text = readFileSync(path, 'utf8');
      expect(
        /import[^;]*from\s+['"][^'"]*arsenal\.json['"]/.test(text),
        path + ' must not import arsenal.json statically'
      ).toBe(false);
    }
  });

  it('the one code reference is the dynamic import in src/arsenal.ts', () => {
    // Comments may talk about the file; code may not touch it. Strip
    // comments, then require the only surviving mention to be the dynamic
    // import inside src/arsenal.ts.
    const stripComments = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const referencing = sources.filter((path) =>
      stripComments(readFileSync(path, 'utf8')).includes('arsenal.json')
    );
    expect(referencing).toEqual([join(SRC, 'arsenal.ts')]);
    const text = readFileSync(join(SRC, 'arsenal.ts'), 'utf8');
    expect(text).toMatch(/import\(['"]\.\/data\/arsenal\.json['"]\)/);
  });

  it('the demo fixture carries literal hashes, not an arsenal import', () => {
    const text = readFileSync(join(FIXTURES, 'demo.ts'), 'utf8');
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '');
    expect(/import[^;]*arsenal/i.test(code)).toBe(false);
    expect(text).toContain('2738601016'); // Cataphract GL3, cross-checked elsewhere
  });
});
