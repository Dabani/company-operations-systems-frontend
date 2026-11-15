import { describe, expect, it } from 'vitest';
import { currentMonth, fmtClock, fmtMinutes, fmtTime, shiftMonth, toApiDateTime, toInputValue, weekday } from './attendance';

describe('attendance helpers', () => {
  it('formats minutes as hours:minutes', () => {
    expect(fmtMinutes(0)).toBe('0:00');
    expect(fmtMinutes(537)).toBe('8:57');
    expect(fmtMinutes(600)).toBe('10:00');
  });

  it('shows instants in the organization timezone, not the browser one', () => {
    expect(fmtTime('2026-11-09T06:03:00Z', 'Africa/Kigali', 'en')).toBe('08:03');      // UTC+2
    expect(fmtTime('2026-11-09T06:03:00Z', 'UTC', 'en')).toBe('06:03');
    expect(fmtTime(null, 'UTC', 'en')).toBe('—');
    expect(fmtClock(Date.UTC(2026, 10, 9, 15, 0, 30), 'Africa/Kigali', 'en')).toBe('17:00:30');
  });

  it('builds the value of a datetime-local field and sends it back to the API', () => {
    expect(toInputValue('2026-11-09T06:03:00Z', 'Africa/Kigali', 'x')).toBe('2026-11-09T08:03');
    expect(toInputValue('2026-11-08T22:30:00Z', 'Africa/Kigali', 'x')).toBe('2026-11-09T00:30');   // past midnight locally: never "24:30"
    expect(toInputValue(null, 'Africa/Kigali', '2026-11-09T08:00')).toBe('2026-11-09T08:00');
    expect(toApiDateTime('2026-11-09T08:03')).toBe('2026-11-09 08:03');
  });

  it('moves between months and finds the weekday of a calendar date', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 13)).toBe('2028-01');
    expect(weekday('2026-11-09', 'en')).toBe('Mon');
    expect(currentMonth('UTC')).toMatch(/^\d{4}-\d{2}$/);
  });
});
