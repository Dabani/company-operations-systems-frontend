import { describe, expect, it } from 'vitest';
import { budgetUsage, cancelNoteOk, fmtMoney, seatsText, ticketUrl } from './events';

describe('event helpers', () => {
  it('builds the ticket address without doubled slashes', () => {
    expect(ticketUrl('https://app.example.org/', 'abc')).toBe('https://app.example.org/event-ticket/abc');
  });
  it('computes budget usage and ignores a missing budget', () => {
    expect(budgetUsage(50, 200)).toBe(25);
    expect(budgetUsage(250, 200)).toBe(125);
    expect(budgetUsage(10, null)).toBeNull();
    expect(budgetUsage(10, 0)).toBeNull();
  });
  it('requires a reason only to cancel', () => {
    expect(cancelNoteOk('cancelled', ' a ')).toBe(false);
    expect(cancelNoteOk('cancelled', 'Venue unavailable')).toBe(true);
    expect(cancelNoteOk('closed', '')).toBe(true);
  });
  it('formats money and survives an unknown currency', () => {
    expect(fmtMoney(1500, 'USD', 'en')).toContain('1,500');
    expect(fmtMoney(5, 'ZZZ9', 'en')).toContain('5');
    expect(fmtMoney(null, null, 'en')).toBe('0');
  });
  it('describes seats', () => {
    expect(seatsText(3, 10)).toEqual({ kind: 'of', registered: 3, capacity: 10 });
    expect(seatsText(3, null).kind).toBe('count');
  });
});
