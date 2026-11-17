export const FU_COLOR: Record<string, string> = { open: 'gray', in_progress: 'blue', completed: 'green', done: 'teal', closed: 'green', cancelled: 'gray' };

/** Moves that must come with a written reason (mirrors the server). */
export function moveNeedsReason(kind: 'resolution' | 'action', from: string, to: string): boolean {
  return to === 'cancelled' || (kind === 'resolution' && from === 'completed' && to === 'open') || (kind === 'action' && from === 'done' && to === 'in_progress');
}

/** The note is needed (3+ characters) for reasons, and for "done" unless a file is attached (the server also checks the files). */
export function moveNoteOk(kind: 'resolution' | 'action', from: string, to: string, note: string): boolean {
  const n = note.trim().length;
  if (moveNeedsReason(kind, from, to)) return n >= 3;
  return true;
}

/** Calendar date (Y-m-d) shown without any time-zone shift. */
export function fmtDue(due: string | null, locale: string): string {
  return due ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(due + 'T00:00:00Z')) : '—';
}
