export const MINUTES_COLOR: Record<string, string> = { draft: 'gray', pending_approval: 'orange', approved: 'blue', published: 'green', superseded: 'gray' };
export const VISIBILITIES = ['participants', 'department', 'organization', 'named'] as const;

/** Which of the recipient pickers a visibility needs (mirrors the server rule). */
export function recipientKind(visibility: string): 'department' | 'user' | null {
  return visibility === 'department' ? 'department' : visibility === 'named' ? 'user' : null;
}

/** True when the visibility can be saved: the chosen kind has at least one recipient. */
export function publishReady(visibility: string | null, allowed: string[], departmentIds: string[], userIds: string[]): boolean {
  if (!visibility || !allowed.includes(visibility)) return false;
  const k = recipientKind(visibility);
  return k === null || (k === 'department' ? departmentIds.length > 0 : userIds.length > 0);
}
