import { NavLink } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { iconFor } from '@/lib/icons';
import type { MenuNode } from '@/types';

const containsRoute = (n: MenuNode, path: string): boolean =>
  n.route === path || n.children.some((c) => containsRoute(c, path));

/** Accordion sidebar built from the permission-filtered menu API (up to 3 levels). One branch open per level. */
export function SidebarMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState<string[]>([]);

  const q = useQuery({ queryKey: ['menu'], queryFn: async () => (await api.get<{ data: MenuNode[] }>('/menu')).data.data, staleTime: 5 * 60_000 });

  // Open the branch that contains the current route.
  useEffect(() => {
    if (!q.data) return;
    const ids: string[] = [];
    const walk = (nodes: MenuNode[], trail: string[]) => nodes.forEach((n) => {
      if (n.route === pathname) ids.push(...trail);
      walk(n.children, [...trail, n.id]);
    });
    walk(q.data, []);
    if (ids.length) setOpen((cur) => Array.from(new Set([...cur, ...ids])));
  }, [q.data, pathname]);

  const toggle = (id: string, siblings: MenuNode[]) =>
    setOpen((cur) => {
      const sib = siblings.map((s) => s.id);
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.filter((x) => !sib.includes(x)), id];
    });

  const render = (nodes: MenuNode[], depth: number) =>
    nodes.map((n) => {
      const Icon = iconFor(n.icon);
      const label = n.label_key ? t(n.label_key, { defaultValue: n.label ?? n.code }) : (n.label ?? n.code);
      const isGroup = n.children.length > 0;
      return (
        <NavLink
          key={n.id}
          label={label}
          leftSection={depth === 1 || !isGroup ? <Icon size={depth === 1 ? 20 : 17} stroke={1.7} /> : <Icon size={17} stroke={1.7} />}
          active={n.route === pathname}
          variant={depth === 1 && isGroup && containsRoute(n, pathname) ? 'light' : 'light'}
          opened={isGroup ? open.includes(n.id) : undefined}
          onClick={isGroup ? () => toggle(n.id, nodes) : () => { nav(n.route!); onNavigate?.(); }}
          childrenOffset={14}
          style={{ borderRadius: 8, fontWeight: depth === 1 ? 600 : 400 }}
        >
          {isGroup ? render(n.children, depth + 1) : null}
        </NavLink>
      );
    });

  return <>{q.data ? render(q.data, 1) : null}</>;
}
