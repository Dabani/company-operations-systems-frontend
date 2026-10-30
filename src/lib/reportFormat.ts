export interface Kpi { key: string; label: string; value: number | null; unit: string | null; tone: 'good' | 'warn' | 'bad' | 'neutral' }

const UNITS: Record<string, string> = { days: 'd', hours: 'h', percent: '%' };

/** 12.5 + 'percent' -> "12.5 %", 3 + 'RWF' -> "3 RWF", null -> "-". Locale-aware number grouping. */
export function formatKpi(k: Pick<Kpi, 'value' | 'unit'>, locale?: string): string {
  if (k.value === null || k.value === undefined) return '—';
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(k.value);
  if (!k.unit) return n;
  return `${n} ${UNITS[k.unit] ?? k.unit}`;
}

export const toneColor = (tone: Kpi['tone']): string => ({ good: 'green', warn: 'orange', bad: 'red', neutral: 'gray' }[tone] ?? 'gray');

/** Period presets -> { from, to } as YYYY-MM-DD in local time. */
export function presetRange(days: number, today = new Date()): { from: string; to: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: iso(from), to: iso(today) };
}
