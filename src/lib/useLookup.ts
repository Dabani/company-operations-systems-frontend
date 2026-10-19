import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { LookupValue } from '@/types';

/** Dropdown options for a lookup list, e.g. useLookup('location_type'). */
export function useLookup(type: string, enabled = true) {
  const q = useQuery({
    queryKey: ['lookup', type],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.get<{ data: LookupValue[] }>('/lookups', { params: { type } })).data.data,
  });
  const items = q.data ?? [];
  return { ...q, items, options: items.map((v) => ({ value: v.id, label: v.label })), byId: (id?: string | null) => items.find((v) => v.id === id) };
}
