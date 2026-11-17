import { describe, expect, it } from 'vitest';
import { fmtDue, moveNeedsReason, moveNoteOk } from './followups';

describe('follow-up helpers', () => {
  it('asks for a reason when cancelling or re-opening finished work', () => {
    expect(moveNeedsReason('action', 'open', 'cancelled')).toBe(true);
    expect(moveNeedsReason('action', 'done', 'in_progress')).toBe(true);
    expect(moveNeedsReason('resolution', 'completed', 'open')).toBe(true);
    expect(moveNeedsReason('action', 'open', 'in_progress')).toBe(false);
    expect(moveNeedsReason('resolution', 'open', 'completed')).toBe(false);
  });
  it('checks the note length only where a reason is required', () => {
    expect(moveNoteOk('action', 'open', 'cancelled', ' ab ')).toBe(false);
    expect(moveNoteOk('action', 'open', 'cancelled', 'No longer needed')).toBe(true);
    expect(moveNoteOk('action', 'open', 'in_progress', '')).toBe(true);
  });
  it('shows a due date without shifting the day', () => {
    expect(fmtDue('2026-11-16', 'en')).toContain('16');
    expect(fmtDue(null, 'en')).toBe('—');
  });
});
