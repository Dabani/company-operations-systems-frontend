import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleOrder, sliceLanguage, type LangCode } from './slice';

const langs: LangCode[] = ['en', 'fr', 'rw', 'sw'];
const mods = import.meta.glob<Record<LangCode, Record<string, string>>>('./{bundle,patch}[0-9]*.ts', { eager: true, import: 'default' });
const files = Object.keys(mods);

describe('translation slicing (one chunk per language)', () => {
  it('finds the bundle and patch files', () => expect(files.length).toBeGreaterThanOrEqual(9));

  it.each(files)('%s: every language slice equals the bundle\'s own object', (file) => {
    const src = readFileSync(path.join(__dirname, file), 'utf8');
    for (const l of langs) {
      const slice = sliceLanguage(src, l);
      expect(slice, `${file}:${l}`).not.toBeNull();
      expect(new Function(`return (${slice});`)(), `${file}:${l}`).toEqual(mods[file][l]);
    }
  });

  it('orders bundles so that later ones override earlier ones as before', () => {
    const order = bundleOrder(['bundle15.ts', 'bundle7.ts', 'bundle12b.ts', 'patch07a.ts', 'bundle08.ts', 'bundle12.ts', 'bundle10.ts', 'bundle13.ts']);
    expect(order).toEqual(['bundle7.ts', 'patch07a.ts', 'bundle08.ts', 'bundle10.ts', 'bundle12.ts', 'bundle12b.ts', 'bundle13.ts', 'bundle15.ts']);
  });
});
