import { describe, expect, it } from 'vitest';
import { deliveredPercent, receiptLineValid, remaining, withinTolerance } from './orders';

describe('order helpers', () => {
  it('computes what is still to come', () => {
    expect(remaining('10', '6')).toBe(4000);
    expect(remaining(10, 12)).toBe(0);
  });
  it('validates receipt lines like the server', () => {
    expect(receiptLineValid(4, 4, 4000)).toBe(true);
    expect(receiptLineValid(4, 3, 4000)).toBe(true);
    expect(receiptLineValid('1.5', 0, 4000)).toBe(true);
    expect(receiptLineValid(5, 5, 4000)).toBe(false);
    expect(receiptLineValid(4, 5, 4000)).toBe(false);
    expect(receiptLineValid(0, 0, 4000)).toBe(false);
  });
  it('applies the tolerance', () => {
    expect(withinTolerance(100000, 100000, 0)).toBe(true);
    expect(withinTolerance(100001, 100000, 0)).toBe(false);
    expect(withinTolerance(105000, 100000, 5)).toBe(true);
    expect(withinTolerance(50000, 100000, 0)).toBe(true);
  });
  it('reports delivery progress', () => {
    expect(deliveredPercent([{ quantity: 10, accepted_quantity: 5 }, { quantity: 10, accepted_quantity: 10 }])).toBe(75);
    expect(deliveredPercent([])).toBe(0);
  });
});
