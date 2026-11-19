import { describe, expect, it } from 'vitest';
import { choicesOk, messageOk, pollFormOk, shouldStick } from './collab';

describe('collab helpers', () => {
  it('validates messages', () => { expect(messageOk('  ')).toBe(false); expect(messageOk(' hi ')).toBe(true); expect(messageOk('a'.repeat(1001))).toBe(false); });
  it('validates the poll form', () => {
    expect(pollFormOk('Approve the budget?', ['Yes', 'No'])).toBe(true);
    expect(pollFormOk('ok', ['Yes', 'No'])).toBe(false);
    expect(pollFormOk('Approve the budget?', ['Yes'])).toBe(false);
    expect(pollFormOk('Approve the budget?', ['Yes', 'yes '])).toBe(false);
    expect(pollFormOk('Approve the budget?', ['Yes', ''])).toBe(false);
    expect(pollFormOk('Approve the budget?', Array.from({ length: 11 }, (_, i) => `o${i}`))).toBe(false);
  });
  it('validates choices', () => {
    expect(choicesOk(1, false, 0, 3)).toBe(true);
    expect(choicesOk(2, false, 0, 3)).toBe(false);
    expect(choicesOk(3, true, 0, 3)).toBe(true);
    expect(choicesOk(3, true, 2, 3)).toBe(false);
    expect(choicesOk(0, true, 0, 3)).toBe(false);
  });
  it('sticks to the bottom only when the reader is near it', () => { expect(shouldStick(900, 100, 1000)).toBe(true); expect(shouldStick(0, 100, 1000)).toBe(false); });
});
