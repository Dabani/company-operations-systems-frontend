// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from './lazyPage';

describe('lazyPage', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('wraps a named export as the default export', () => {
    const Comp = () => null;
    const L = page(async () => ({ Foo: Comp }), 'Foo');
    expect(L).toBeTruthy();
  });

  it('reloads the app once when a chunk fails to load (stale deployment), then surfaces the error', async () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });
    const L = page(async () => { throw new Error('Failed to fetch dynamically imported module'); }, 'Foo' as never) as unknown as { _init: (p: unknown) => unknown; _payload: unknown };

    // First failure: reload requested, promise never settles.
    const first = Promise.race([(async () => { try { (L._init(L._payload) as never); } catch (p) { await (p as Promise<unknown>); } })(), new Promise((r) => setTimeout(r, 50))]);
    await first;
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('ops.chunk.reloaded')).toBe('1');
  });
});
