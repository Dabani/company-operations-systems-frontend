import { describe, expect, it } from 'vitest';
import { allowedResolutions, canCancelTrip, canRecordExpenses, expenseTotals, fmtMoney, overBudget, settlementDirection, subMoney, sumMoney, tripDays } from './trips';

describe('exact money', () => {
  it('sums without float errors', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');                      // 0.1 + 0.2 !== 0.3 in floating point
    expect(sumMoney(['150000.00', '40000.50', 10])).toBe('190010.50');
    expect(sumMoney([])).toBe('0.00');
    expect(sumMoney(['-5.25', '5.25'])).toBe('0.00');
    expect(sumMoney(['9999999999999.99', '0.01'])).toBe('10000000000000.00');
  });

  it('subtracts and keeps the sign', () => {
    expect(subMoney('150000.00', '200000.00')).toBe('-50000.00');
    expect(subMoney('10', '0.01')).toBe('9.99');
    expect(subMoney('1.5', '1.5')).toBe('0.00');
  });

  it('compares to a budget', () => {
    expect(overBudget('500000.01', '500000.00')).toBe(true);
    expect(overBudget('500000.00', '500000.00')).toBe(false);
  });

  it('formats and survives an unknown currency', () => {
    expect(fmtMoney('1234.5', 'USD', 'en')).toContain('1,234.50');
    expect(fmtMoney('10', 'ZZZ-bad', 'en')).toBe('10.00 ZZZ-bad');
    expect(fmtMoney(null, 'RWF')).toBe('—');
  });
});

describe('settlement and expenses', () => {
  it('reads the direction from the balance', () => {
    expect(settlementDirection('20000.00')).toBe('pay_employee');
    expect(settlementDirection('-0.01')).toBe('employee_owes');
    expect(settlementDirection('0.00')).toBe('even');
  });

  it('offers only the resolutions the server accepts for each direction', () => {
    expect(allowedResolutions('pay_employee')).toEqual(['paid_to_employee']);
    expect(allowedResolutions('even')).toEqual(['closed_even']);
    expect(allowedResolutions('employee_owes')).toEqual(['refunded_by_employee', 'payroll_deduction', 'waived']);
  });

  it('totals expenses by status', () => {
    const t = expenseTotals([{ status: 'accepted', amount: '100.10' }, { status: 'accepted', amount: '0.20' }, { status: 'rejected', amount: '5.00' }, { status: 'draft', amount: '1.00' }]);
    expect(t).toEqual({ draft: '1.00', submitted: '0.00', accepted: '100.30', rejected: '5.00' });
  });

  it('counts trip days with both ends included', () => {
    expect(tripDays('2026-12-02', '2026-12-05')).toBe(4);
    expect(tripDays('2026-12-05', '2026-12-05')).toBe(1);
    expect(tripDays('2026-12-06', '2026-12-05')).toBe(0);
    expect(tripDays('2026-12-30', '2027-01-02')).toBe(4);
  });

  it('knows which trip states allow actions', () => {
    expect(canRecordExpenses('approved')).toBe(true);
    expect(canRecordExpenses('report_submitted')).toBe(false);
    expect(canCancelTrip('pending_approval')).toBe(true);
    expect(canCancelTrip('settled')).toBe(false);
  });
});
