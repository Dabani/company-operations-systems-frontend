import { describe, expect, it } from 'vitest';
import { fmtCents, lineCents, reasonOk, toCents, totalCents } from './procurement';

describe('procurement helpers', () => {
  it('computes line totals like the server', () => {
    expect(lineCents('2.5', '10.00')).toBe(2500);
    expect(lineCents(3, '11.11')).toBe(3333);
    expect(lineCents('0.333', '0.10')).toBe(3);
    expect(lineCents('', 'x')).toBe(0);
  });
  it('adds the lines', () => {
    expect(totalCents([{ quantity: 2, unit_price: 10 }, { quantity: 1, unit_price: '35.00' }])).toBe(5500);
    expect(totalCents([])).toBe(0);
    expect(toCents('10.50')).toBe(1050);
  });
  it('formats cents and survives an unknown currency', () => {
    expect(fmtCents(150000, 'USD', 'en')).toContain('1,500');
    expect(fmtCents(500, 'ZZZ9', 'en')).toContain('5');
  });
  it('checks reasons', () => {
    expect(reasonOk(' ab ')).toBe(false);
    expect(reasonOk('abc')).toBe(true);
    expect(reasonOk('too short', 10)).toBe(false);
  });
});
