import type { ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { ForbiddenPage } from '@/pages/ErrorPages';

/** UI guard only (hides screens). The API enforces every permission independently. */
export function RequirePermission({ permission, children }: { permission: string | string[]; children: ReactNode }) {
  const { can } = useAuth();
  return [permission].flat().some((p) => can(p)) ? <>{children}</> : <ForbiddenPage />;
}
