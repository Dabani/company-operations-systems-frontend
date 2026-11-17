import { describe, expect, it } from 'vitest';
import { publishReady, recipientKind } from './minutes';

describe('minutes publication rules', () => {
  it('knows which recipients a visibility needs', () => {
    expect(recipientKind('participants')).toBeNull();
    expect(recipientKind('organization')).toBeNull();
    expect(recipientKind('department')).toBe('department');
    expect(recipientKind('named')).toBe('user');
  });
  it('is ready only with an allowed visibility and recipients where needed', () => {
    const all = ['participants', 'department', 'organization', 'named'];
    expect(publishReady(null, all, [], [])).toBe(false);
    expect(publishReady('organization', all, [], [])).toBe(true);
    expect(publishReady('organization', ['participants', 'named'], [], [])).toBe(false);
    expect(publishReady('department', all, [], ['u'])).toBe(false);
    expect(publishReady('department', all, ['d'], [])).toBe(true);
    expect(publishReady('named', all, [], [])).toBe(false);
    expect(publishReady('named', all, [], ['u'])).toBe(true);
  });
});
