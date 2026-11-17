import { describe, expect, it } from 'vitest';
import { utcToWall, wallToUtc } from './meetings';

describe('meeting time helpers', () => {
  it('reads a wall-clock time in the organization timezone as the right UTC instant', () => {
    expect(wallToUtc('2026-11-20T09:00', 'Africa/Kigali')).toBe('2026-11-20T07:00:00.000Z');
    expect(wallToUtc('2026-11-20T09:00', 'UTC')).toBe('2026-11-20T09:00:00.000Z');
  });
  it('follows daylight saving', () => {
    expect(wallToUtc('2026-01-15T09:00', 'Europe/Paris')).toBe('2026-01-15T08:00:00.000Z');
    expect(wallToUtc('2026-07-15T09:00', 'Europe/Paris')).toBe('2026-07-15T07:00:00.000Z');
  });
  it('round-trips', () => {
    for (const tz of ['Africa/Kigali', 'Europe/Paris', 'America/New_York']) {
      expect(utcToWall(wallToUtc('2026-03-29T09:30', tz), tz)).toBe('2026-03-29T09:30');
    }
  });
  it('returns an empty value for no instant', () => { expect(utcToWall(null, 'UTC')).toBe(''); });
});
