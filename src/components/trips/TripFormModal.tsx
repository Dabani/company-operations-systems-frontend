import { Alert, Button, Group, Modal, MultiSelect, NumberInput, Select, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { fmtMoney, sumMoney } from '@/lib/trips';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface Estimate { employee_id: string; rate: string | null; days: number; amount: string | null }

/** Request a business trip. The per diem estimate comes from the rate table and is only a help for the budget: no rate means no figure, never a guess. */
export function TripFormModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const zones = useLookup('trip_zone');
  const currencies = useLookup('currency');
  const form = useForm({
    initialValues: { purpose: '', destination: '', zone_id: '', start_date: '', end_date: '', currency_id: '', budget_estimate: '' as number | string, project_id: '', linked_meeting: '', itinerary: '', traveler_ids: [] as string[], advances: {} as Record<string, number | string> },
    validate: { traveler_ids: (v) => (v.length === 0 ? t('trips.pick_traveler') : null) },
  });
  const emps = useQuery({ queryKey: ['emp-options'], enabled: opened, queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const projects = useQuery({ queryKey: ['project-options'], enabled: opened, retry: false, queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/projects', { params: { per_page: 100 } })).data.data });
  const v = form.values;
  const canEstimate = !!v.zone_id && !!v.currency_id && !!v.start_date && !!v.end_date && v.end_date >= v.start_date && v.traveler_ids.length > 0;
  const est = useMutation({
    mutationFn: async () => (await api.post<{ data: Estimate[] }>('/trips/estimate', { zone_id: v.zone_id, currency_id: v.currency_id, start_date: v.start_date, end_date: v.end_date, traveler_ids: v.traveler_ids })).data.data,
    onError: toastError,
  });
  const save = useMutation({
    mutationFn: async () => api.post<{ data: { id: string } }>('/trips', {
      ...v, project_id: v.project_id || undefined, linked_meeting: v.linked_meeting || undefined, itinerary: v.itinerary || undefined,
      advances: v.traveler_ids.filter((id) => Number(v.advances[id]) > 0).map((id) => ({ employee_id: id, amount: v.advances[id] })),
    }),
    onSuccess: (r) => { toastOk(t('trips.requested')); form.reset(); onClose(); void qc.invalidateQueries({ queryKey: ['trips'] }); nav(`/trips/${r.data.data.id}`); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const name = (id: string) => emps.data?.find((e) => e.id === id)?.full_name ?? id;
  const cur = currencies.items.find((c) => c.id === v.currency_id)?.code ?? '';
  const total = est.data ? sumMoney(est.data.filter((e) => e.amount).map((e) => e.amount as string)) : null;

  return (
    <Modal opened={opened} onClose={onClose} title={t('trips.new_title')} centered size="xl">
      <form onSubmit={form.onSubmit(() => save.mutate())}><Stack gap="sm">
        <Textarea label={t('trips.purpose')} required autosize minRows={2} maxLength={5000} {...form.getInputProps('purpose')} />
        <Group grow align="flex-start"><TextInput label={t('trips.destination')} required maxLength={200} {...form.getInputProps('destination')} /><Select label={t('trips.zone')} required data={zones.options} {...form.getInputProps('zone_id')} /></Group>
        <Group grow align="flex-start"><TextInput type="date" label={t('trips.from')} required {...form.getInputProps('start_date')} /><TextInput type="date" label={t('trips.to')} required min={v.start_date || undefined} {...form.getInputProps('end_date')} /></Group>
        <MultiSelect label={t('trips.travelers')} required searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('traveler_ids')} />
        <Group grow align="flex-start">
          <Select label={t('trips.currency')} required searchable data={currencies.options} {...form.getInputProps('currency_id')} />
          <NumberInput label={t('trips.budget')} required min={0.01} decimalScale={2} thousandSeparator=" " {...form.getInputProps('budget_estimate')} />
        </Group>
        <Group>
          <Button variant="light" size="xs" disabled={!canEstimate} loading={est.isPending} onClick={() => est.mutate()}>{t('trips.estimate')}</Button>
          <Text size="xs" c="dimmed">{t('trips.estimate_hint')}</Text>
        </Group>
        {est.data && (
          <Table verticalSpacing={4} fz="sm"><Table.Tbody>
            {est.data.map((e) => <Table.Tr key={e.employee_id}><Table.Td>{name(e.employee_id)}</Table.Td><Table.Td>{e.rate ? `${e.days} × ${fmtMoney(e.rate, cur, i18n.language)}` : <Text span c="orange" size="sm">{t('trips.no_rate')}</Text>}</Table.Td><Table.Td ta="right">{e.amount ? fmtMoney(e.amount, cur, i18n.language) : '—'}</Table.Td></Table.Tr>)}
            {total && <Table.Tr><Table.Td colSpan={2} fw={600}>{t('common.total')}</Table.Td><Table.Td ta="right" fw={600}>{fmtMoney(total, cur, i18n.language)}</Table.Td></Table.Tr>}
          </Table.Tbody></Table>
        )}
        {v.traveler_ids.length > 0 && (
          <Stack gap={6}><Text size="sm" fw={500}>{t('trips.advances')}</Text><Text size="xs" c="dimmed">{t('trips.advances_hint')}</Text>
            <Group gap="sm">{v.traveler_ids.map((id) => <NumberInput key={id} label={name(id)} min={0} decimalScale={2} thousandSeparator=" " w={200} value={v.advances[id] ?? ''} onChange={(n) => form.setFieldValue('advances', { ...v.advances, [id]: n })} />)}</Group>
          </Stack>
        )}
        {projects.data && projects.data.length > 0 && <Select label={t('trips.project')} clearable searchable data={projects.data.map((p) => ({ value: p.id, label: p.name }))} {...form.getInputProps('project_id')} />}
        <TextInput label={t('trips.meeting')} maxLength={200} {...form.getInputProps('linked_meeting')} />
        <Textarea label={t('trips.itinerary')} autosize minRows={2} maxLength={10000} {...form.getInputProps('itinerary')} />
        <Alert variant="light" color="blue">{t('trips.approval_note')}</Alert>
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('trips.submit')}</Button></Group>
      </Stack></form>
    </Modal>
  );
}
