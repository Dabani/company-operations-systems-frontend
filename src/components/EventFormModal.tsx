import { Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CurrencySelect } from '@/components/CurrencySelect';
import { RichTextField } from '@/components/RichTextField';
import { utcToWall, wallToUtc } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

export interface EventForEdit {
  id: string; title: string; description: string | null; type_id: string; status: string; timezone: string; starts_at: string; ends_at: string; venue: string | null; online_url: string | null;
  department_id?: string | null; department?: string | { id: string } | null; project_id?: string | null; organizer: { id: string; name: string }; capacity: number | null; waitlist_enabled: boolean; allow_guests: boolean;
  registration_opens_at: string | null; registration_closes_at: string | null; budget_amount: number | string | null; currency_code: string | null;
}
interface Props { opened: boolean; onClose: () => void; event?: EventForEdit | null; onSaved: (id: string) => void }

const blank = {
  title: '', description: '', type_id: null as string | null, starts_at: '', ends_at: '', venue: '', online_url: '', department_id: null as string | null, project_id: null as string | null, organizer_id: null as string | null,
  capacity: '' as number | string, waitlist_enabled: true, allow_guests: false, registration_opens_at: '', registration_closes_at: '', budget_amount: '' as number | string, currency_code: '',
};

/** Create or change an event. Times are typed in the organization's timezone and sent as UTC instants. */
export function EventFormModal({ opened, onClose, event, onSaved }: Props) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const edit = !!event;
  const form = useForm({ initialValues: blank });
  const types = useLookup('event_type', opened);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const people = useQuery({ queryKey: ['event-people', debounced], enabled: opened && can('event.create'), staleTime: 60_000,
    queryFn: async () => (await api.get<{ data: { id: string; name: string; email: string }[]; meta?: { timezone?: string } }>('/events/people', { params: { search: debounced || undefined } })).data });
  const depts = useQuery({ queryKey: ['dept-options'], enabled: opened && can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const projects = useQuery({ queryKey: ['project-options'], enabled: opened && can('project.view'), queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/projects', { params: { per_page: 100 } })).data.data });
  const tz = event?.timezone ?? people.data?.meta?.timezone ?? 'UTC';

  useEffect(() => {
    if (!opened) return;
    if (event) {
      form.setValues({ ...blank, title: event.title, description: event.description ?? '', type_id: event.type_id, starts_at: utcToWall(event.starts_at, event.timezone), ends_at: utcToWall(event.ends_at, event.timezone),
        venue: event.venue ?? '', online_url: event.online_url ?? '', department_id: event.department_id ?? (typeof event.department === 'object' && event.department ? event.department.id : null), project_id: event.project_id ?? null,
        organizer_id: event.organizer.id, capacity: event.capacity ?? '', waitlist_enabled: event.waitlist_enabled, allow_guests: event.allow_guests,
        registration_opens_at: utcToWall(event.registration_opens_at, event.timezone), registration_closes_at: utcToWall(event.registration_closes_at, event.timezone),
        budget_amount: event.budget_amount ?? '', currency_code: event.currency_code ?? '' });
    } else form.setValues(blank);
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, event?.id]);

  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const body: Record<string, unknown> = {
        title: v.title, description: v.description || null, type_id: v.type_id, starts_at: wallToUtc(v.starts_at, tz), ends_at: wallToUtc(v.ends_at, tz), venue: v.venue || null, online_url: v.online_url || null,
        department_id: v.department_id, project_id: v.project_id, capacity: v.capacity === '' ? null : Number(v.capacity), waitlist_enabled: v.waitlist_enabled, allow_guests: v.allow_guests,
        registration_opens_at: v.registration_opens_at ? wallToUtc(v.registration_opens_at, tz) : null, registration_closes_at: v.registration_closes_at ? wallToUtc(v.registration_closes_at, tz) : null,
        budget_amount: v.budget_amount === '' ? null : Number(v.budget_amount), currency_code: v.budget_amount === '' ? null : (v.currency_code || null),
      };
      if (v.organizer_id) body.organizer_id = v.organizer_id;
      return (await (edit ? api.patch<{ data: { id: string } }>(`/events/${event!.id}`, body) : api.post<{ data: { id: string } }>('/events', body))).data.data;
    },
    onSuccess: (r) => { toastOk(); onSaved(r.id); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const orgOptions = (() => {
    const list = (people.data?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
    if (event && !list.some((p) => p.value === event.organizer.id)) list.unshift({ value: event.organizer.id, label: event.organizer.name });
    return list;
  })();

  return (
    <Modal opened={opened} onClose={onClose} size="lg" centered title={edit ? t('ev.edit') : t('ev.new')}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <TextInput label={t('ev.name')} required maxLength={200} {...form.getInputProps('title')} />
          <Select label={t('common.type')} required data={types.options} {...form.getInputProps('type_id')} />
          <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput type="datetime-local" label={t('ev.starts')} description={t('meet.times_in_tz', { tz })} required {...form.getInputProps('starts_at')} />
            <TextInput type="datetime-local" label={t('ev.ends')} required {...form.getInputProps('ends_at')} />
            <TextInput label={t('ev.venue')} maxLength={255} {...form.getInputProps('venue')} />
            <TextInput label={t('ev.online_url')} placeholder="https://" {...form.getInputProps('online_url')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label={t('ev.organizer')} searchable data={orgOptions} searchValue={search} onSearchChange={setSearch} filter={({ options }) => options} {...form.getInputProps('organizer_id')} />
            <Select label={t('users.department')} clearable searchable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
            <Select label={t('ev.project')} clearable searchable data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} {...form.getInputProps('project_id')} />
            <NumberInput label={t('ev.capacity')} description={t('ev.capacity_help')} min={1} allowDecimal={false} {...form.getInputProps('capacity')} />
            <TextInput type="datetime-local" label={t('ev.reg_opens')} {...form.getInputProps('registration_opens_at')} />
            <TextInput type="datetime-local" label={t('ev.reg_closes')} {...form.getInputProps('registration_closes_at')} />
            <NumberInput label={t('ev.budget')} min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps('budget_amount')} />
            <CurrencySelect label={t('ev.currency')} value={form.values.currency_code} onChange={(c) => form.setFieldValue('currency_code', c)} error={form.errors.currency_code as string | undefined} required={form.values.budget_amount !== ''} />
          </SimpleGrid>
          <Switch label={t('ev.waitlist')} description={t('ev.waitlist_help')} {...form.getInputProps('waitlist_enabled', { type: 'checkbox' })} />
          <Switch label={t('ev.allow_guests')} description={t('ev.allow_guests_help')} {...form.getInputProps('allow_guests', { type: 'checkbox' })} />
          {edit && event!.status !== 'draft' && <Alert color="blue" variant="light">{t('ev.edit_notice')}</Alert>}
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}
