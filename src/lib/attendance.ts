/** Helpers shared by the attendance screens. Times come from the API as UTC instants and are always shown in the organization's timezone. */

export const STATUS_COLOR: Record<string, string> = { present: 'green', late: 'orange', absent: 'red', holiday: 'blue', day_off: 'gray', leave: 'teal', incomplete: 'yellow' };

function locale(lang: string): string {
  try { return new Intl.DateTimeFormat(lang).resolvedOptions().locale; } catch { return 'en'; }
}

/** 483 -> "8:03" */
export function fmtMinutes(m: number): string { return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; }

export function fmtTime(iso: string | null | undefined, tz: string, lang: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function fmtClock(ms: number, tz: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
}

export function fmtLongDate(ms: number, tz: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
}

/** "Mon" for a calendar date written as YYYY-MM-DD (no timezone involved). */
export function weekday(date: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/** The value of a datetime-local input (YYYY-MM-DDTHH:mm) for an instant, in the organization's timezone. */
export function toInputValue(iso: string | null | undefined, tz: string, fallback: string): string {
  if (!iso) return fallback;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}

/** datetime-local value -> what the API expects (YYYY-MM-DD HH:mm). */
export function toApiDateTime(v: string): string { return v.replace('T', ' ').slice(0, 16); }

export function currentMonth(tz: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
