/** Helpers shared by the leave screens. Dates are calendar dates written YYYY-MM-DD (no timezone involved); day counts are decimal strings from the API. */

export const LEAVE_STATUS_COLOR: Record<string, string> = { pending_approval: 'orange', approved: 'green', rejected: 'red', cancelled: 'gray' };
export const LEDGER_COLOR: Record<string, string> = { opening: 'gray', accrual: 'green', usage: 'blue', reversal: 'orange', adjustment: 'orange', carry_forfeit: 'red', carry_expiry: 'red' };

export interface LeaveReq {
  id: string; code: string; employee_id: string; employee: string | null; leave_type: string; leave_type_id: string; start_date: string; end_date: string;
  start_half: boolean; end_half: boolean; days: string; status: string; reason: string | null; mine: boolean; approval_request_id: string | null;
}

export interface LeavePreview {
  days: string; dates: Record<string, string>; blockers: { code: string; message: string }[]; warnings: { code: string; message: string }[];
  balance: string | null; available: string | null; balance_after: string | null; missing_profile: string[]; type: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11" -> every date of the month. */
export function monthDays(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

export function monthRange(ym: string): { from: string; to: string } {
  const d = monthDays(ym);
  return { from: d[0], to: d[d.length - 1] };
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

export function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

/** The leave a person has on a date (approved wins over pending), or undefined. */
export function leaveOnDate<T extends { employee_id: string; start_date: string; end_date: string; status: string }>(reqs: T[], employeeId: string, date: string): T | undefined {
  const hits = reqs.filter((r) => r.employee_id === employeeId && r.start_date <= date && r.end_date >= date && (r.status === 'approved' || r.status === 'pending_approval'));
  return hits.find((r) => r.status === 'approved') ?? hits[0];
}

/** "3.00" -> "3", "2.50" -> "2.5". */
export function formatDays(d: string | null | undefined): string {
  if (d === null || d === undefined || d === '') return '—';
  const n = Number(d);
  return Number.isFinite(n) ? String(Number(n.toFixed(2))) : d;
}

export function balanceColor(available: string | null | undefined): string {
  const n = Number(available);
  return !Number.isFinite(n) ? 'gray' : n < 0 ? 'red' : n === 0 ? 'gray' : 'green';
}

/** The request may be sent: the server said no blocker and at least one day counts. */
export function isSubmittable(p: LeavePreview | undefined | null): boolean {
  return !!p && p.blockers.length === 0 && Number(p.days) > 0;
}

/** The requester can withdraw a pending request any time, and an approved one only before its first day (HR can always: the server decides). */
export function canCancelOwn(r: Pick<LeaveReq, 'status' | 'start_date' | 'mine'>, today: string): boolean {
  return r.mine && (r.status === 'pending_approval' || (r.status === 'approved' && r.start_date > today));
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
