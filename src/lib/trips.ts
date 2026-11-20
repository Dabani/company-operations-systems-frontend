/** Helpers shared by the trip screens. Money is a decimal string from the API; sums are done in integer minor units so the screen never shows a float error. */

export const TRIP_COLOR: Record<string, string> = { pending_approval: 'orange', approved: 'green', rejected: 'red', cancelled: 'gray', report_submitted: 'blue', settled: 'teal' };
export const EXPENSE_COLOR: Record<string, string> = { draft: 'gray', submitted: 'orange', accepted: 'green', rejected: 'red' };
export const ADVANCE_COLOR: Record<string, string> = { requested: 'orange', paid: 'blue', retired: 'green' };

export interface TripExpense { id: string; employee_id: string; employee: string | null; category: string; expense_date: string; description: string; amount: string; status: string; is_generated: boolean; review_note: string | null; needs_receipt: boolean }

function cents(v: string | number): bigint {
  const s = String(v).trim();
  const neg = s.startsWith('-');
  const [i, f = ''] = s.replace('-', '').split('.');
  const c = BigInt(i || '0') * 100n + BigInt((f + '00').slice(0, 2));
  return neg ? -c : c;
}

function fromCents(c: bigint): string {
  const neg = c < 0n;
  const a = neg ? -c : c;
  return `${neg ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`;
}

export function sumMoney(values: (string | number)[]): string { return fromCents(values.reduce<bigint>((s, v) => s + cents(v), 0n)); }
export function subMoney(a: string, b: string): string { return fromCents(cents(a) - cents(b)); }
export function overBudget(total: string, budget: string): boolean { return cents(total) > cents(budget); }

export function fmtMoney(amount: string | null | undefined, currency: string, locale?: string): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(n); } catch { return `${n.toFixed(2)} ${currency}`; }
}

export type Direction = 'pay_employee' | 'employee_owes' | 'even';
export function settlementDirection(balance: string): Direction { const c = cents(balance); return c > 0n ? 'pay_employee' : c < 0n ? 'employee_owes' : 'even'; }

/** What the screen offers. The server enforces the same rule, this only avoids offering a choice that will be refused. */
export function allowedResolutions(d: Direction): string[] {
  return d === 'pay_employee' ? ['paid_to_employee'] : d === 'even' ? ['closed_even'] : ['refunded_by_employee', 'payroll_deduction', 'waived'];
}

export function expenseTotals(expenses: Pick<TripExpense, 'status' | 'amount'>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of ['draft', 'submitted', 'accepted', 'rejected']) out[s] = sumMoney(expenses.filter((e) => e.status === s).map((e) => e.amount));
  return out;
}

export function tripDays(from: string, to: string): number {
  if (to < from) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Expenses can be added while the trip is approved and the report is not in yet. */
export const canRecordExpenses = (status: string): boolean => status === 'approved';
export const canCancelTrip = (status: string): boolean => status === 'pending_approval' || status === 'approved';
