export const SUPPLIER_COLOR: Record<string, string> = { draft: 'gray', under_review: 'orange', approved: 'green', suspended: 'yellow', blocked: 'red', archived: 'gray' };
export const REQ_COLOR: Record<string, string> = { draft: 'gray', pending_approval: 'orange', approved: 'green', rejected: 'red', cancelled: 'gray' };
export const BANK_COLOR: Record<string, string> = { pending_verification: 'orange', verified: 'green', replaced: 'gray', rejected: 'red' };

export const toCents = (v: string | number | null | undefined): number => Math.round((Number(v) || 0) * 100);

/** Same arithmetic as the server: quantity in thousandths times the unit price in cents. */
export function lineCents(quantity: string | number | null | undefined, unitPrice: string | number | null | undefined): number {
  return Math.round((Math.round((Number(quantity) || 0) * 1000) * toCents(unitPrice)) / 1000);
}

export function totalCents(lines: { quantity: string | number | null; unit_price: string | number | null }[]): number {
  return lines.reduce((s, l) => s + lineCents(l.quantity, l.unit_price), 0);
}

export function fmtCents(cents: number, currency: string | null | undefined, lang: string): string {
  const n = cents / 100;
  try { return new Intl.NumberFormat(lang, currency ? { style: 'currency', currency } : { minimumFractionDigits: 2 }).format(n); } catch { return `${n.toFixed(2)} ${currency ?? ''}`.trim(); }
}

/** A reason is needed to suspend, block or cancel (3 characters), and an over-budget exception needs 10. */
export const reasonOk = (s: string, min = 3): boolean => s.trim().length >= min;

export const SUPPLIER_REASON_MOVES = ['suspended', 'blocked'];
