import { describe, expect, it } from 'vitest';
import { formatKpi, presetRange, toneColor } from './reportFormat';

describe('formatKpi', () => {
  it('shows a dash for missing values', () => { expect(formatKpi({ value: null, unit: 'percent' })).toBe('—'); });
  it('appends units', () => {
    expect(formatKpi({ value: 12.5, unit: 'percent' }, 'en')).toBe('12.5 %');
    expect(formatKpi({ value: 3, unit: 'hours' }, 'en')).toBe('3 h');
    expect(formatKpi({ value: 1500, unit: 'RWF' }, 'en')).toBe('1,500 RWF');
  });
  it('has no unit suffix when none is given', () => { expect(formatKpi({ value: 7, unit: null }, 'en')).toBe('7'); });
});

describe('presetRange', () => {
  it('is inclusive of today (90 days = today and the 89 days before)', () => {
    expect(presetRange(90, new Date(2026, 9, 22))).toEqual({ from: '2026-07-25', to: '2026-10-22' });
  });
  it('handles a single day', () => { expect(presetRange(1, new Date(2026, 0, 5))).toEqual({ from: '2026-01-05', to: '2026-01-05' }); });
});

describe('toneColor', () => {
  it('maps tones to Mantine colours and falls back to gray', () => {
    expect(toneColor('bad')).toBe('red');
    expect(toneColor('good')).toBe('green');
    expect(toneColor('whatever' as never)).toBe('gray');
  });
});
