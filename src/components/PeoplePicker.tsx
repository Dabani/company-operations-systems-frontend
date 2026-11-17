import { MultiSelect, Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api } from '@/api/client';

export interface Person { id: string; name: string; email: string }
interface PeopleResponse { data?: Person[]; meta?: { timezone?: string } }

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Active members of the organization, searched on the server (the first 100 matches). Names already picked stay in the list so their labels never disappear. */
export function usePeople(enabled = true) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const known = useRef<Record<string, Person>>({});
  const q = useQuery({
    queryKey: ['meeting-people', debounced], enabled, staleTime: 60_000,
    queryFn: async () => (await api.get<PeopleResponse>('/meetings/people', { params: { search: debounced || undefined } })).data,
  });

  // Tolerate a missing body, a missing `data` array, or a bare array response.
  const raw = q.data as PeopleResponse | Person[] | undefined;
  const list: Person[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const timezone: string = (!Array.isArray(raw) && raw?.meta?.timezone) || BROWSER_TZ;

  list.forEach((p) => { known.current[p.id] = p; });
  const remember = (people: Person[]) => people.forEach((p) => { known.current[p.id] = p; });
  const options = (selected: (string | null | undefined)[]) => {
    const ids = new Set(list.map((p) => p.id));
    const extra = selected.filter((id): id is string => !!id && !ids.has(id) && !!known.current[id]);
    return [...list, ...extra.map((id) => known.current[id])].map((p) => ({ value: p.id, label: `${p.name} (${p.email})` }));
  };
  return { setSearch, options, remember, timezone, loading: q.isLoading };
}

interface One { label: string; value: string | null; onChange: (v: string | null) => void; people: ReturnType<typeof usePeople>; error?: string; clearable?: boolean; description?: string }
export function PersonSelect({ label, value, onChange, people, error, clearable = true, description }: One) {
  return <Select label={label} description={description} data={people.options([value])} value={value} onChange={onChange} onSearchChange={people.setSearch} searchable clearable={clearable} nothingFoundMessage="—" error={error} filter={({ options }) => options} />;
}

interface Many { label: string; value: string[]; onChange: (v: string[]) => void; people: ReturnType<typeof usePeople>; error?: string }
export function PeopleMultiSelect({ label, value, onChange, people, error }: Many) {
  return <MultiSelect label={label} data={people.options(value)} value={value} onChange={onChange} onSearchChange={people.setSearch} searchable nothingFoundMessage="—" error={error} filter={({ options }) => options} />;
}
