/**
 * Payroll screen logic. The SERVER is the authority for the lifecycle and for separation of duties; this only avoids offering a step that cannot work at the run's current stage.
 * The rules below mirror App\Services\Hr\Payroll\PayRunFlow.
 */

export const RUN_STAGES = ['draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid', 'declared'] as const;
export const RUN_COLOR: Record<string, string> = { draft: 'gray', calculated: 'blue', reviewed: 'cyan', approved: 'green', locked: 'violet', paid: 'teal', declared: 'teal', cancelled: 'red' };
export const SLIP_COLOR: Record<string, string> = { calculated: 'green', blocked: 'red', excluded: 'gray' };
export const FLAG_COLOR: Record<string, string> = { blocker: 'red', warning: 'orange', info: 'blue' };
export const VERIFY_COLOR: Record<string, string> = { verified: 'green', unverified: 'orange' };

export interface RunView { status: string; kind: string; md_required: boolean; finance_done: boolean }
export type Can = (permission: string) => boolean;

export type RunAction = 'calculate' | 'review' | 'approve_finance' | 'approve_md' | 'return' | 'lock' | 'pay' | 'declare' | 'cancel' | 'adjust' | 'exports';

/** Stage index for a stepper (cancelled = -1). */
export function stageIndex(status: string): number { return (RUN_STAGES as readonly string[]).indexOf(status); }

export const isFrozen = (status: string): boolean => status === 'locked' || status === 'paid' || status === 'declared';
export const isEditable = (status: string): boolean => status === 'draft' || status === 'calculated';

/** The buttons to show for a run, for the signed-in user's permissions. */
export function runActions(r: RunView, can: Can): RunAction[] {
  const s = r.status;
  const out: RunAction[] = [];
  if ((s === 'draft' || s === 'calculated') && can('hr.payroll.prepare')) out.push('calculate');
  if (s === 'calculated' && can('hr.payroll.review')) out.push('review');
  if (s === 'reviewed' && !r.finance_done && can('hr.payroll.approve')) out.push('approve_finance');
  if (s === 'reviewed' && r.finance_done && r.md_required && can('hr.payroll.approve_md')) out.push('approve_md');
  if ((s === 'reviewed' || s === 'approved') && (can('hr.payroll.review') || can('hr.payroll.approve') || can('hr.payroll.approve_md'))) out.push('return');
  if (s === 'approved' && can('hr.payroll.lock')) out.push('lock');
  if (s === 'locked' && can('hr.payroll.pay')) out.push('pay');
  if (s === 'paid' && can('hr.payroll.declare')) out.push('declare');
  if ((s === 'draft' || s === 'calculated' || s === 'reviewed') && can('hr.payroll.prepare')) out.push('cancel');
  if (isFrozen(s) && r.kind === 'regular' && can('hr.payroll.prepare')) out.push('adjust');
  if (isFrozen(s) && (can('hr.payroll.export') || can('hr.payroll.export.configure'))) out.push('exports');
  return out;
}

export interface BandRow { lower: string | number; upper: string | number | null | ''; rate: string | number }

/** Mirror of BracketValidator: the bands must follow each other exactly, starting at 0, the last one open. Returns an error code or null. */
export function bandsError(rows: BandRow[]): string | null {
  if (rows.length === 0) return 'empty';
  const sorted = [...rows].sort((a, b) => Number(a.lower) - Number(b.lower));
  let expected = 0;
  for (let i = 0; i < sorted.length; i++) {
    const lower = Number(sorted[i].lower);
    const rate = Number(sorted[i].rate);
    const open = sorted[i].upper === null || sorted[i].upper === '' || sorted[i].upper === undefined;
    const upper = open ? null : Number(sorted[i].upper);
    if (!Number.isFinite(lower) || lower < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100 || (upper !== null && !Number.isFinite(upper))) return 'bad_value';
    if (i === 0 && lower !== 0) return 'first_not_zero';
    if (lower !== expected) return 'gap_or_overlap';
    if (upper === null) return i === sorted.length - 1 ? null : 'open_band_not_last';
    if (upper <= lower) return 'bad_bounds';
    expected = upper;
  }
  return 'last_not_open';
}

export function fmt(amount: string | null | undefined, currency: string, locale?: string): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(n); } catch { return `${n.toFixed(2)} ${currency}`; }
}

/** Does a payslip line of this kind belong to the employee's deductions block (employee contributions and deductions) rather than earnings or the employer block? */
export const isDeductionKind = (kind: string): boolean => kind === 'scheme_employee' || kind === 'deduction';

/** Layout columns of the export builder that need a scheme / a component (mirror of ExportFields). */
export const SCHEME_SOURCES = ['scheme_base', 'scheme_employee_amount', 'scheme_employer_amount'];
export const COMPONENT_SOURCES = ['component_amount'];
