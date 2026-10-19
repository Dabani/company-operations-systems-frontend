import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, csrf, UNAUTHENTICATED_EVENT } from '@/api/client';
import i18n from '@/i18n';
import { disconnectEcho } from '@/lib/echo';
import type { Me } from '@/types';

interface AuthState {
  me: Me | null;
  loading: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<{ data: Me }>('/me')).data.data,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const me = q.isError ? null : (q.data ?? null);

  // User language preference wins over the browser/default.
  useEffect(() => { if (me?.language && me.language !== i18n.language) void i18n.changeLanguage(me.language); }, [me?.language]);

  useEffect(() => {
    const onUnauth = () => { qc.setQueryData(['me'], undefined); void qc.invalidateQueries({ queryKey: ['me'] }); };
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauth);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauth);
  }, [qc]);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    await csrf();
    await api.post('/auth/login', { email, password, remember });
    await qc.invalidateQueries({ queryKey: ['me'] });
    await qc.refetchQueries({ queryKey: ['me'] });
  }, [qc]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { disconnectEcho(); qc.clear(); qc.setQueryData(['me'], null); window.location.assign('/login'); }
  }, [qc]);

  const value = useMemo<AuthState>(() => ({
    me,
    loading: q.isLoading,
    can: (p) => !!me?.permissions.includes(p),
    login, logout, refresh: () => qc.invalidateQueries({ queryKey: ['me'] }),
  }), [me, q.isLoading, login, logout, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
