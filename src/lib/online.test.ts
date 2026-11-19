import { describe, expect, it } from 'vitest';
import { externalApiUrl, jitsiOptions, myPlace, type JoinData, type Queue, type QueueItem } from './online';

const item = (p: Partial<QueueItem>): QueueItem => ({ id: 'x', name: 'A', is_guest: false, kind: 'speak', status: 'requested', topic: null, agenda_item: null, requested_at: '', granted_at: null, finished_at: null, position: 1, decision_note: null, mine: false, ...p });

describe('online helpers', () => {
  it('accepts plain host names only', () => {
    expect(externalApiUrl('meet.example.org')).toBe('https://meet.example.org/external_api.js');
    expect(externalApiUrl('meet.example.org:8443')).toBe('https://meet.example.org:8443/external_api.js');
    expect(externalApiUrl('evil.com/x?')).toBeNull();
    expect(externalApiUrl('a b')).toBeNull();
    expect(externalApiUrl('')).toBeNull();
  });
  it('builds options with the token only when signed', () => {
    const j: JoinData = { domain: 'd', room: 'cops-abc', jwt: 'tok', display_name: 'Ana', moderator: false, subject: 'Board', signed: true };
    const el = {} as HTMLElement;
    expect(jitsiOptions(j, el).jwt).toBe('tok');
    expect('jwt' in jitsiOptions({ ...j, jwt: null }, el)).toBe(false);
    expect(jitsiOptions(j, el).userInfo.displayName).toBe('Ana');
  });
  it('finds my own place', () => {
    const q: Queue = { speaking: item({ id: 's', status: 'speaking', position: null }), waiting: [item({ id: 'a', position: 1 }), item({ id: 'b', position: 2, mine: true })] };
    expect(myPlace(q)).toMatchObject({ kind: 'waiting', position: 2 });
    expect(myPlace({ ...q, speaking: { ...q.speaking!, mine: true } })).toMatchObject({ kind: 'speaking' });
    expect(myPlace({ speaking: null, waiting: [] })).toBeNull();
    expect(myPlace(null)).toBeNull();
  });
});
