import { describe, expect, it } from 'vitest';
import { balanceColor, canCancelOwn, formatDays, isSubmittable, isWeekend, leaveOnDate, monthDays, monthRange, shiftMonth, type LeavePreview } from './leave';

describe('leave calendar helpers', () => {
  it('lists the dates of a month, including leap February', () => {
    expect(monthDays('2026-11')).toHaveLength(30);
    expect(monthDays('2026-12')[30]).toBe('2026-12-31');
    expect(monthDays('2028-02')).toHaveLength(29);
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('moves between months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-05', 0)).toBe('2026-05');
    expect(shiftMonth('2026-11', 14)).toBe('2028-01');
  });

  it('knows weekends', () => {
    expect(isWeekend('2026-11-14')).toBe(true);   // Saturday
    expect(isWeekend('2026-11-15')).toBe(true);   // Sunday
    expect(isWeekend('2026-11-16')).toBe(false);  // Monday
  });

  type R = { id: string; employee_id: string; start_date: string; end_date: string; status: string };
  const r = (o: Partial<R>): R => ({ id: '?', employee_id: 'e1', start_date: '2026-12-07', end_date: '2026-12-09', status: 'approved', ...o });
  it('finds a person\'s leave on a date, approved before pending, never rejected or cancelled', () => {
    const reqs = [r({ status: 'pending_approval', id: 'p' }), r({ id: 'a' }), r({ status: 'rejected', id: 'x' }), r({ employee_id: 'e2', id: 'o' })];
    expect(leaveOnDate(reqs, 'e1', '2026-12-08')?.id).toBe('a');
    expect(leaveOnDate(reqs, 'e1', '2026-12-10')).toBeUndefined();
    expect(leaveOnDate([r({ status: 'cancelled' })], 'e1', '2026-12-08')).toBeUndefined();
    expect(leaveOnDate([r({ status: 'pending_approval', id: 'p' })], 'e1', '2026-12-07')?.id).toBe('p');
  });
});

describe('leave display and rules', () => {
  it('formats day counts without noise', () => {
    expect(formatDays('3.00')).toBe('3');
    expect(formatDays('2.50')).toBe('2.5');
    expect(formatDays('-1.50')).toBe('-1.5');
    expect(formatDays(null)).toBe('—');
    expect(formatDays('')).toBe('—');
  });

  it('colours a balance', () => {
    expect(balanceColor('4.00')).toBe('green');
    expect(balanceColor('0.00')).toBe('gray');
    expect(balanceColor('-1.00')).toBe('red');
    expect(balanceColor(null)).toBe('gray');
  });

  const p = (o: Partial<LeavePreview>): LeavePreview => ({ days: '3.00', dates: {}, blockers: [], warnings: [], balance: null, available: null, balance_after: null, missing_profile: [], type: 'annual', ...o });
  it('allows submitting only without blockers and with days', () => {
    expect(isSubmittable(p({}))).toBe(true);
    expect(isSubmittable(p({ blockers: [{ code: 'overlap', message: 'x' }] }))).toBe(false);
    expect(isSubmittable(p({ days: '0.00' }))).toBe(false);
    expect(isSubmittable(p({ warnings: [{ code: 'team_conflict', message: 'x' }] }))).toBe(true);   // a warning never blocks
    expect(isSubmittable(undefined)).toBe(false);
  });

  it('lets a requester withdraw pending leave, and approved leave only before it starts', () => {
    const base = { mine: true, start_date: '2026-12-07' };
    expect(canCancelOwn({ ...base, status: 'pending_approval' }, '2026-12-20')).toBe(true);
    expect(canCancelOwn({ ...base, status: 'approved' }, '2026-12-06')).toBe(true);
    expect(canCancelOwn({ ...base, status: 'approved' }, '2026-12-07')).toBe(false);
    expect(canCancelOwn({ ...base, status: 'rejected' }, '2026-12-01')).toBe(false);
    expect(canCancelOwn({ ...base, mine: false, status: 'pending_approval' }, '2026-12-01')).toBe(false);
  });
});
