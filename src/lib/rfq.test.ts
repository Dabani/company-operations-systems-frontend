import { describe, expect, it } from 'vitest';
import { inviteesOk, overLowestPercent, quoteTotal, rfqReasonOk } from './rfq';

describe('rfq helpers', () => {
  it('checks reasons', () => { expect(rfqReasonOk('short')).toBe(false); expect(rfqReasonOk(' only licensed dealer ')).toBe(true); });
  it('checks invitees', () => { expect(inviteesOk(3, 3, '')).toBe(true); expect(inviteesOk(1, 3, '')).toBe(false); expect(inviteesOk(1, 3, 'sole distributor in region')).toBe(true); expect(inviteesOk(0, 0, 'long enough reason')).toBe(false); });
  it('totals a quote and flags incomplete ones', () => {
    const lines = [{ id: 'a', quantity: 2 }, { id: 'b', quantity: '1.5' }];
    expect(quoteTotal(lines, { a: 10.5, b: 2 })).toEqual({ cents: 2400, priced: 2, complete: true });
    expect(quoteTotal(lines, { a: 10.5 })).toEqual({ cents: 2100, priced: 1, complete: false });
    expect(quoteTotal([], {}).complete).toBe(false);
  });
  it('compares to the lowest', () => { expect(overLowestPercent(10500, 10000)).toBe(5); expect(overLowestPercent(10000, 10000)).toBe(0); expect(overLowestPercent(5, 0)).toBe(0); });
});
