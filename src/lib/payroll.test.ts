import { describe, expect, it } from 'vitest';
import { bandsError, isEditable, isFrozen, runActions, stageIndex, type Can, type RunView } from './payroll';

const all: Can = () => true;
const none: Can = () => false;
const only = (...perms: string[]): Can => (p) => perms.includes(p);
const run = (o: Partial<RunView> = {}): RunView => ({ status: 'draft', kind: 'regular', md_required: true, finance_done: false, ...o });

describe('stages', () => {
  it('orders the lifecycle and treats cancelled as outside it', () => {
    expect(stageIndex('draft')).toBe(0);
    expect(stageIndex('declared')).toBe(6);
    expect(stageIndex('cancelled')).toBe(-1);
    expect(stageIndex('locked')).toBeGreaterThan(stageIndex('approved'));
  });
  it('knows what is frozen and what can still be edited', () => {
    for (const s of ['locked', 'paid', 'declared']) { expect(isFrozen(s)).toBe(true); expect(isEditable(s)).toBe(false); }
    for (const s of ['draft', 'calculated']) { expect(isEditable(s)).toBe(true); expect(isFrozen(s)).toBe(false); }
    expect(isEditable('reviewed')).toBe(false);
    expect(isFrozen('approved')).toBe(false);
  });
});

describe('which buttons a run offers', () => {
  it('offers nothing without permissions', () => {
    for (const s of ['draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid', 'declared']) expect(runActions(run({ status: s }), none)).toEqual([]);
  });

  it('follows the lifecycle one step at a time', () => {
    expect(runActions(run({ status: 'draft' }), all)).toEqual(['calculate', 'cancel']);                                     // nothing is reviewed before it is calculated
    expect(runActions(run({ status: 'calculated' }), all)).toEqual(['calculate', 'review', 'cancel']);
    expect(runActions(run({ status: 'reviewed' }), all)).toEqual(['approve_finance', 'return', 'cancel']);                  // finance first
    expect(runActions(run({ status: 'reviewed', finance_done: true }), all)).toEqual(['approve_md', 'return', 'cancel']);
    expect(runActions(run({ status: 'approved', finance_done: true }), all)).toEqual(['return', 'lock']);
    expect(runActions(run({ status: 'locked' }), all)).toEqual(['pay', 'adjust', 'exports']);
    expect(runActions(run({ status: 'paid' }), all)).toEqual(['declare', 'adjust', 'exports']);
    expect(runActions(run({ status: 'declared' }), all)).toEqual(['adjust', 'exports']);
  });

  it('never offers return or cancel once locked, and never calculation after review', () => {
    for (const s of ['locked', 'paid', 'declared']) {
      expect(runActions(run({ status: s }), all)).not.toContain('return');
      expect(runActions(run({ status: s }), all)).not.toContain('cancel');
      expect(runActions(run({ status: s }), all)).not.toContain('calculate');
    }
    expect(runActions(run({ status: 'reviewed' }), all)).not.toContain('calculate');
    expect(runActions(run({ status: 'approved' }), all)).not.toContain('cancel');
  });

  it('asks for the managing director only when the run requires it', () => {
    expect(runActions(run({ status: 'reviewed', finance_done: true, md_required: false }), all)).not.toContain('approve_md');
    expect(runActions(run({ status: 'reviewed', finance_done: false }), only('hr.payroll.approve_md'))).not.toContain('approve_md');   // finance has not approved yet
  });

  it('offers each step only to the permission that allows it', () => {
    expect(runActions(run({ status: 'calculated' }), only('hr.payroll.review'))).toEqual(['review']);
    expect(runActions(run({ status: 'reviewed' }), only('hr.payroll.approve'))).toEqual(['approve_finance', 'return']);
    expect(runActions(run({ status: 'approved' }), only('hr.payroll.lock'))).toEqual(['lock']);
    expect(runActions(run({ status: 'locked' }), only('hr.payroll.pay'))).toEqual(['pay']);
    expect(runActions(run({ status: 'locked' }), only('hr.payroll.export'))).toEqual(['exports']);
    expect(runActions(run({ status: 'paid' }), only('hr.payroll.declare'))).toEqual(['declare']);
  });

  it('an adjustment run cannot itself be adjusted', () => {
    expect(runActions(run({ status: 'locked', kind: 'adjustment' }), all)).not.toContain('adjust');
    expect(runActions(run({ status: 'draft', kind: 'adjustment' }), all)).toEqual(['calculate', 'cancel']);
  });
});

describe('band validation mirrors the server', () => {
  const b = (rows: [number, number | null, number][]) => rows.map(([lower, upper, rate]) => ({ lower, upper, rate }));
  it('accepts exact, contiguous bands in any order', () => {
    expect(bandsError(b([[0, 100000, 0], [100000, 200000, 10], [200000, null, 25]]))).toBeNull();
    expect(bandsError(b([[100000, null, 20], [0, 100000, 0]]))).toBeNull();
    expect(bandsError(b([[0, null, 30]]))).toBeNull();
  });
  it('refuses gaps, overlaps, wrong starts and ends', () => {
    expect(bandsError([])).toBe('empty');
    expect(bandsError(b([[50000, null, 10]]))).toBe('first_not_zero');
    expect(bandsError(b([[0, 100000, 0], [120000, null, 10]]))).toBe('gap_or_overlap');
    expect(bandsError(b([[0, 100000, 0], [90000, null, 10]]))).toBe('gap_or_overlap');
    expect(bandsError(b([[0, 100000, 0], [100000, 200000, 10]]))).toBe('last_not_open');
    expect(bandsError(b([[0, null, 0], [100000, null, 10]]))).toBe('open_band_not_last');
    expect(bandsError(b([[0, 0, 5], [0, null, 5]]))).toBe('bad_bounds');
    expect(bandsError(b([[0, null, 101]]))).toBe('bad_value');
    expect(bandsError([{ lower: 'x', upper: null, rate: 5 }])).toBe('bad_value');
  });
  it('treats an empty upper limit as open', () => {
    expect(bandsError([{ lower: 0, upper: '', rate: 5 }])).toBeNull();
  });
});
