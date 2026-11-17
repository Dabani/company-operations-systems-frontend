/** Helpers shared by the meeting screens. Instants come from the API as ISO strings and are always shown in the organization's timezone. */

export const MEETING_COLOR: Record<string, string> = { draft: 'gray', scheduled: 'blue', in_progress: 'orange', held: 'teal', closed: 'green', cancelled: 'red' };
export const RSVP_COLOR: Record<string, string> = { pending: 'gray', accepted: 'green', declined: 'red', proposed: 'orange' };
export const PRIORITY_COLOR: Record<string, string> = { low: 'gray', normal: 'blue', high: 'orange' };

function locale(lang: string): string {
  try { return new Intl.DateTimeFormat(lang).resolvedOptions().locale; } catch { return 'en'; }
}

export function fmtDateTime(iso: string | null | undefined, tz: string, lang: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale(lang), { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** "Fri 20 Nov 2026, 09:00 – 10:30" (the end shows the date only when it is another day). */
export function fmtRange(startIso: string, endIso: string, tz: string, lang: string): string {
  const day = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat(locale(lang), { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  const end = day(startIso) === day(endIso) ? time(endIso) : fmtDateTime(endIso, tz, lang);
  return `${fmtDateTime(startIso, tz, lang)} – ${end}`;
}

/** Offset (ms) of a timezone at an instant: wall clock read as UTC minus the real instant. */
function offsetAt(ms: number, tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second));
  return wall - Math.floor(ms / 1000) * 1000;
}

/** A datetime-local value (YYYY-MM-DDTHH:mm) typed in the organization's timezone -> the UTC instant the API expects. */
export function wallToUtc(value: string, tz: string): string {
  const [d, t] = value.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, da, h, mi);
  let guess = target;
  for (let i = 0; i < 2; i++) guess = target - offsetAt(guess, tz);     // the second pass settles daylight-saving edges
  return new Date(guess).toISOString();
}

/** Reverse: an instant -> the datetime-local value in the organization's timezone. */
export function utcToWall(iso: string | null | undefined, tz: string): string {
  if (!iso) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
