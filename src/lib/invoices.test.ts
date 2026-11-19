import { describe, expect, it } from 'vitest';
import { exceptionNoteOk, invoiceSubtotal, invoiceable, numberKey, priceWithinTolerance } from './invoices';

describe('invoice helpers', () => {
  it('needs a real note', () => { expect(exceptionNoteOk('too short')).toBe(false); expect(exceptionNoteOk('  agreed with the buyer ')).toBe(true); });
  it('limits quantity to accepted minus invoiced', () => { expect(invoiceable('10', '4')).toBe(6000); expect(invoiceable(5, 7)).toBe(0); });
  it('applies the price tolerance', () => { expect(priceWithinTolerance('100', '101', 0)).toBe(false); expect(priceWithinTolerance('100', '105', 5)).toBe(true); expect(priceWithinTolerance('100', '99')).toBe(true); });
  it('adds up lines', () => { expect(invoiceSubtotal([{ quantity: 2, unit_price: 10.5 }, { quantity: '1.5', unit_price: '2' }])).toBe(2400); });
  it('normalises numbers', () => { expect(numberKey('INV-001/A')).toBe(numberKey('inv 001 a')); });
});
