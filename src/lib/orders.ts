export const PO_COLOR: Record<string, string> = { draft: 'gray', pending_approval: 'orange', approved: 'blue', issued: 'cyan', partially_received: 'yellow', received: 'green', closed: 'gray', cancelled: 'red' };

export const thousandths = (v: string | number | null | undefined): number => Math.round((Number(v) || 0) * 1000);

/** Still to be delivered on a line, in thousandths (never negative). Same arithmetic as the server. */
export const remaining = (ordered: string | number, accepted: string | number): number => Math.max(0, thousandths(ordered) - thousandths(accepted));

/** A receipt line is valid when received > 0, 0 <= accepted <= received and received does not exceed what is still to come. */
export function receiptLineValid(received: string | number, accepted: string | number, remainingThousandths: number): boolean {
  const r = thousandths(received);
  const a = thousandths(accepted);
  return r > 0 && a >= 0 && a <= r && r <= remainingThousandths;
}

/** The order total may exceed the requisition by at most the tolerance in percent. */
export function withinTolerance(orderCents: number, requisitionCents: number, tolerancePercent: number): boolean {
  return orderCents <= Math.floor((requisitionCents * (100 + Math.max(0, tolerancePercent))) / 100);
}

/** Share of the ordered quantity that was accepted, 0 to 100. */
export function deliveredPercent(lines: { quantity: string | number; accepted_quantity: string | number }[]): number {
  const total = lines.reduce((s, l) => s + thousandths(l.quantity), 0);
  if (total <= 0) return 0;
  const got = lines.reduce((s, l) => s + Math.min(thousandths(l.accepted_quantity), thousandths(l.quantity)), 0);
  return Math.round((got / total) * 100);
}
