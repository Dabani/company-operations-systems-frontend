import { describe, expect, it } from 'vitest';
import b23 from './bundle23';

const langs = ['en', 'fr', 'rw', 'sw'] as const;
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

describe('bundle23 translations', () => {
  it('has the same keys in all four languages', () => {
    const base = Object.keys(b23.en).sort();
    for (const l of langs) expect(Object.keys(b23[l]).sort(), l).toEqual(base);
  });
  it('has no empty text', () => {
    for (const l of langs) for (const [k, v] of Object.entries(b23[l])) expect(v.trim(), `${l}:${k}`).not.toBe('');
  });
  it('uses the same {{placeholders}} in every language', () => {
    for (const [k, v] of Object.entries(b23.en)) for (const l of langs) expect(placeholders(b23[l][k]), `${l}:${k}`).toBe(placeholders(v));
  });
  it('covers every status, kind, action and error code the screens can show', () => {
    const family = (prefix: string, codes: string[]) => codes.forEach((c) => expect(b23.en[`${prefix}.${c}`], `${prefix}.${c}`).toBeTruthy());
    family('pay.status', ['draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid', 'declared', 'cancelled']);
    family('pay.slip', ['calculated', 'blocked', 'excluded']);
    family('pay.runkind', ['regular', 'adjustment']);
    family('pay.action', ['calculate', 'review', 'approve_finance', 'approve_md', 'return', 'lock', 'pay', 'declare', 'cancel', 'adjust', 'exports', 'exclude', 'input']);
    family('pay.stagelog', ['calculated', 'reviewed', 'finance', 'md', 'locked', 'paid', 'declared']);
    family('pay.kind', ['earning', 'deduction', 'scheme_employee', 'scheme_employer']);
    family('pay.verification', ['verified', 'unverified']);
    family('pay.severity', ['blocker', 'warning', 'info']);
    family('pay.exportkind', ['bank_transfer', 'declaration', 'journal']);
    family('pay.layouttype', ['delimited', 'fixed_width']);
    family('pay.band_error', ['empty', 'first_not_zero', 'gap_or_overlap', 'open_band_not_last', 'bad_bounds', 'last_not_open', 'bad_value']);
  });
});
