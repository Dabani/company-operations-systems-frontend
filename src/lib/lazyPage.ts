import { lazy, type ComponentType } from 'react';

const KEY = 'ops.chunk.reloaded';
const flag = {
  get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set: () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode */ } },
  clear: () => { try { sessionStorage.removeItem(KEY); } catch { /* private mode */ } },
};

/**
 * Route-level code splitting. After a new deployment the old hashed chunk files no longer exist: the first failed
 * import reloads the app once (to pick up the new index.html); a second failure is shown by the route error boundary.
 */
export function lazyPage<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const m = await loader();
      flag.clear();
      return m;
    } catch (e) {
      if (!flag.get()) {
        flag.set();
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw e;
    }
  });
}

/** page(() => import('./pages/X'), 'XPage') for modules with named exports. */
export const page = <K extends string>(loader: () => Promise<Record<K, ComponentType<any>>>, name: K) =>
  lazyPage(() => loader().then((m) => ({ default: m[name] })));
