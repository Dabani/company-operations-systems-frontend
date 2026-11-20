import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { fmtMoney } from '@/lib/trips';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Rate { id: string; kind: string; zone: string; grade_id: string | null; currency: string; amount: string; valid_from: string; valid_to: string | null; source_note: string | null }

/** Per diem, accommodation and transport rates. Nothing is pre-filled. A rate is never edited: it is ended and a new one entered, so older trips keep their rate. */
export function TripRatesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const configure = can('hr.trip.configure');
  const kinds = useLookup('trip_rate_kind');
  const zones = useLookup('trip_zone');
  const currencies = useLookup('currency');
  const [modal, setModal] = useState(false);
  const [ending, setEnding] = useState<Rate | null>(null);
  const [endDate, setEndDate] = useState('');
  const form = useForm({ initialValues: { kind_id: '', zone_id: '', currency_id: '', amount: '' as number | string, grade_id: '', valid_from: '', valid_to: '', source_note: '' } });
  const q = useQuery({ queryKey: ['trip-rates'], queryFn: async () => (await api.get<{ data: Rate[] }>('/trips/rates')).data.data });
  const grades = useQuery({ queryKey: ['hr-grades'], enabled: configure, queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/hr/grades')).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['trip-rates'] });
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/trips/rates', { ...v, grade_id: v.grade_id || undefined, valid_to: v.valid_to || undefined, source_note: v.source_note || undefined }),
    onSuccess: () => { toastOk(); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const end = useMutation({ mutationFn: async () => api.post(`/trips/rates/${ending!.id}/end`, { valid_to: endDate }), onSuccess: () => { toastOk(); setEnding(null); refresh(); }, onError: toastError });
  const label = (items: { code: string; label: string }[], code: string) => items.find((i) => i.code === code)?.label ?? code;
  return (
    <>
      <PageHeader title={t('trips.rates_title')} description={t('trips.rates_intro')} actions={configure ? <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>{t('common.add')}</Button> : undefined} />
      {q.data?.length === 0 && <Alert variant="light" color="orange" mb="md">{t('trips.rates_empty')}</Alert>}
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('trips.zone')}</Table.Th><Table.Th>{t('trips.grade')}</Table.Th><Table.Th ta="right">{t('trips.amount')}</Table.Th><Table.Th>{t('leave.valid')}</Table.Th><Table.Th>{t('leave.source')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{label(kinds.items, r.kind)}</Table.Td><Table.Td>{label(zones.items, r.zone)}</Table.Td>
              <Table.Td>{r.grade_id ? (grades.data?.find((g) => g.id === r.grade_id)?.name ?? '…') : t('trips.all_grades')}</Table.Td>
              <Table.Td ta="right">{fmtMoney(r.amount, r.currency, i18n.language)}</Table.Td>
              <Table.Td><Text size="xs">{r.valid_from} → {r.valid_to ?? '…'}</Text>{r.valid_to && <Badge size="xs" color="gray" variant="light">{t('trips.ended')}</Badge>}</Table.Td>
              <Table.Td><Text size="xs" c="dimmed" lineClamp={2}>{r.source_note}</Text></Table.Td>
              <Table.Td ta="right">{configure && !r.valid_to && <Button size="compact-xs" variant="subtle" onClick={() => { setEnding(r); setEndDate(''); }}>{t('leave.end_rule')}</Button>}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={modal} onClose={() => setModal(false)} title={t('trips.add_rate')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Group grow align="flex-start"><Select label={t('common.type')} required data={kinds.options} {...form.getInputProps('kind_id')} /><Select label={t('trips.zone')} required data={zones.options} {...form.getInputProps('zone_id')} /></Group>
          <Group grow align="flex-start"><Select label={t('trips.currency')} required searchable data={currencies.options} {...form.getInputProps('currency_id')} /><NumberInput label={t('trips.amount')} required min={0} decimalScale={2} thousandSeparator=" " {...form.getInputProps('amount')} /></Group>
          <Select label={t('trips.grade')} description={t('trips.grade_hint')} clearable data={(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))} {...form.getInputProps('grade_id')} />
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.valid_from')} required {...form.getInputProps('valid_from')} /><TextInput type="date" label={t('leave.valid_to')} {...form.getInputProps('valid_to')} /></Group>
          <TextInput label={t('trips.rate_source')} description={t('trips.rate_source_hint')} maxLength={255} {...form.getInputProps('source_note')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!ending} onClose={() => setEnding(null)} title={t('leave.end_rule')} centered size="sm">
        <Stack gap="sm"><Text size="sm" c="dimmed">{t('trips.end_rate_hint')}</Text><TextInput type="date" label={t('leave.valid_to')} required value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEnding(null)}>{t('common.cancel')}</Button><Button disabled={!endDate} loading={end.isPending} onClick={() => end.mutate()}>{t('common.save')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
