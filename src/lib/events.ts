export const EVENT_COLOR: Record<string, string> = { draft: 'gray', open: 'green', closed: 'orange', in_progress: 'blue', completed: 'teal', cancelled: 'red' };
export const REG_COLOR: Record<string, string> = { registered: 'green', waitlisted: 'orange', cancelled: 'gray' };
export const EXPENSE_COLOR: Record<string, string> = { draft: 'gray', pending_approval: 'orange', approved: 'green', rejected: 'red' };

/** The address a ticket QR code carries: the personal ticket page (the organizer's scanner also accepts the bare code). */
export function ticketUrl(origin: string, ticket: string): string {
  return `${origin.replace(/\/+$/, '')}/event-ticket/${ticket}`;
}

/** Share of the budget used (0 to 100+), or null when no budget was set. */
export function budgetUsage(spent: number, budget: number | null | undefined): number | null {
  if (!budget || budget <= 0) return null;
  return Math.round((spent / budget) * 100);
}

export function fmtMoney(amount: number | string | null | undefined, currency: string | null | undefined, lang: string): string {
  const n = Number(amount ?? 0);
  const cur = currency || '';
  try {
    return new Intl.NumberFormat(lang, cur ? { style: 'currency', currency: cur, maximumFractionDigits: 2 } : { maximumFractionDigits: 2 }).format(n);
  } catch { return `${n.toFixed(2)} ${cur}`.trim(); }
}

/** Cancelling an event needs a written reason of at least 3 characters (the server enforces it too). */
export function cancelNoteOk(to: string, note: string): boolean {
  return to !== 'cancelled' || note.trim().length >= 3;
}

/** Seat line shown to people: "12 of 40 seats taken" needs the capacity, otherwise just the count. */
export function seatsText(registered: number, capacity: number | null | undefined): { kind: 'of' | 'count'; registered: number; capacity: number } {
  return capacity ? { kind: 'of', registered, capacity } : { kind: 'count', registered, capacity: 0 };
}
