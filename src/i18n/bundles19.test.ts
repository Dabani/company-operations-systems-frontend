import { describe, expect, it } from 'vitest';
import b17 from './bundle17';
import b18 from './bundle18';

const langs = ['en', 'fr', 'rw', 'sw'] as const;
const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort().join(',');

describe.each([['bundle17', b17], ['bundle18', b18]])('%s translations', (_name, bundle) => {
  it('has the same keys in all four languages', () => {
    const base = Object.keys(bundle.en).sort();
    for (const l of langs) expect(Object.keys(bundle[l]).sort(), l).toEqual(base);
  });

  it('has no empty text', () => {
    for (const l of langs) for (const [k, v] of Object.entries(bundle[l])) expect(v.trim(), `${l}:${k}`).not.toBe('');
  });

  it('uses the same {{placeholders}} in every language', () => {
    for (const [k, v] of Object.entries(bundle.en)) for (const l of langs) expect(placeholders(bundle[l][k]), `${l}:${k}`).toBe(placeholders(v));
  });
});

describe('dynamic key families are complete', () => {
  const all = { ...b17.en, ...b18.en };
  const family = (prefix: string, codes: string[]) => codes.forEach((c) => expect(all[`${prefix}.${c}`], `${prefix}.${c}`).toBeTruthy());
  it('covers every status, bound, flag and policy key the screens can show', () => {
    family('leave.status', ['pending_approval', 'approved', 'rejected', 'cancelled']);
    family('leave.bound', ['floor', 'ceiling']);
    family('leave.verification', ['verified', 'unverified']);
    family('leave.source_kind', ['company', 'statutory', 'none']);
    family('leave.violation', ['below_floor', 'above_ceiling']);
    family('leave.flag', ['uses_balance', 'accrues', 'is_paid', 'requires_document', 'allow_retroactive', 'ignores_blackout', 'allow_half_days', 'is_requestable', 'is_active']);
    family('leave.policykey', ['entitlement_days', 'service_increment_days', 'service_increment_years', 'entitlement_cap_days', 'full_time_weekly_hours', 'min_service_months_to_take', 'notice_days',
      'min_days_per_request', 'max_days_per_request', 'max_days_per_year', 'min_annual_block_days', 'carry_over_max_days', 'carry_over_expiry_months', 'max_simultaneous_absences',
      'allow_negative_balance', 'requires_document_after_days']);
    family('trips.status', ['pending_approval', 'approved', 'rejected', 'cancelled', 'report_submitted', 'settled']);
    family('trips.advance', ['requested', 'paid', 'retired']);
    family('trips.expense', ['draft', 'submitted', 'accepted', 'rejected']);
    family('trips.direction', ['pay_employee', 'employee_owes', 'even']);
  });
});
