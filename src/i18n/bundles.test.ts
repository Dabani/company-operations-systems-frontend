import { describe, expect, it } from 'vitest';
import b14 from './bundle14';
import b15 from './bundle15';
import b16 from './bundle16';

const langs = ['en', 'fr', 'rw', 'sw'] as const;
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

describe.each([['bundle14', b14], ['bundle15', b15], ['bundle16', b16]])('%s translations', (_name, bundle) => {
  it('has the same keys in all four languages', () => {
    const base = Object.keys(bundle.en).sort();
    for (const l of langs) expect(Object.keys(bundle[l]).sort(), l).toEqual(base);
  });

  it('has no empty text', () => {
    for (const l of langs) for (const [k, v] of Object.entries(bundle[l])) expect(v.trim(), `${l}:${k}`).not.toBe('');
  });

  it('uses the same {{placeholders}} in every language', () => {
    for (const [k, v] of Object.entries(bundle.en)) for (const l of langs) expect(placeholders(bundle[l][k]), `${l}:${k}`).toBe(placeholders(v));
  });
});
