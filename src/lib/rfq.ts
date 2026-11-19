import { toCents } from '@/lib/procurement';

export const RFQ_COLOR: Record<string, string> = { draft: 'gray', open: 'blue', closed: 'orange', awarded: 'green', cancelled: 'red' };
export const QUOTE_COLOR: Record<string, string> = { invited: 'gray', received: 'blue', declined: 'red' };

/** Same wording rule as the server: a written reason needs at least 10 characters. */
export const rfqReasonOk = (s: string | null | undefined): boolean => (s ?? '').trim().length >= 10;

/** Whether opening is allowed: at least one invitee, and a reason when fewer than the minimum are invited. */
export const inviteesOk = (count: number, min: number, reason: string | null | undefined): boolean => count >= 1 && (count >= min || rfqReasonOk(reason));

/** Total in cents of a quote for the requisition lines, counting only lines that have a price. Returns null priced count to flag incomplete quotes. */
export function quoteTotal(lines: { id: string; quantity: string | number }[], prices: Record<string, string | number | null | undefined>): { cents: number; priced: number; complete: boolean } {
  let cents = 0;
  let priced = 0;
  for (const l of lines) {
    const p = prices[l.id];
    if (p === undefined || p === null || p === '') continue;
    priced += 1;
    cents += Math.round((Number(l.quantity) || 0) * toCents(p));
  }
  return { cents, priced, complete: lines.length > 0 && priced === lines.length };
}

/** Difference of a quote total to the cheapest eligible total, in percent (0 for the cheapest). */
export function overLowestPercent(totalCents: number, lowestCents: number): number {
  return lowestCents > 0 ? Math.round(((totalCents - lowestCents) / lowestCents) * 1000) / 10 : 0;
}
