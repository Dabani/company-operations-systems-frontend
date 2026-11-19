import { thousandths } from '@/lib/orders';
import { toCents } from '@/lib/procurement';

export const INVOICE_COLOR: Record<string, string> = { received: 'gray', on_hold: 'orange', matched: 'blue', approved: 'cyan', paid: 'green', rejected: 'red', cancelled: 'gray' };

export const ISSUE_CODES = ['not_received', 'qty_over', 'price_over', 'currency', 'tax_mismatch'] as const;

/** An exception or rejection note must be long enough to be meaningful (same minimum as the server). */
export const exceptionNoteOk = (s: string): boolean => s.trim().length >= 10;

/** Most that can still be invoiced on a line: accepted minus what other live invoices already cover, in thousandths. */
export const invoiceable = (accepted: string | number, alreadyInvoiced: string | number): number => Math.max(0, thousandths(accepted) - thousandths(alreadyInvoiced));

/** Client-side preview of the price check; the server decides. Tolerance in percent, price in cents. */
export function priceWithinTolerance(orderPrice: string | number, invoicePrice: string | number, tolerancePercent = 0): boolean {
  const o = toCents(orderPrice);
  return toCents(invoicePrice) <= Math.floor((o * (100 + Math.max(0, tolerancePercent))) / 100);
}

/** Subtotal of the entered lines in cents. */
export function invoiceSubtotal(lines: { quantity: string | number; unit_price: string | number }[]): number {
  return lines.reduce((s, l) => s + Math.round((Number(l.quantity) || 0) * toCents(l.unit_price)), 0);
}

/** Normalised number used for duplicate detection: letters and digits only, lower case. */
export const numberKey = (n: string): string => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
