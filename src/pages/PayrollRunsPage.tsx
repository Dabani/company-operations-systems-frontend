import { Badge, Button, Group, Modal, Select, Stack, Table, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { RUN_COLOR } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

export interface RunRow { id: string; code: string; kind: string; period_from: string; period_to: string; currency: string; status: string; parent: { id: string; code: string } | null; md_required: boolean; prepared_by: string | null }

export function PayrollRunsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const currencies = useLookup('currency');
  const [status, setStatus] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const form = useForm({ initialValues: { period_from: '', period_to: '', currency_id: '', note: '' } });
  const q = useQuery({ queryKey: ['pay-runs', status], queryFn: async () => (await api.get<{ data: RunRow[] }>('/payroll/runs', { params: { status: status || undefined } })).data.data });
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post<{ data: { id: string } }>('/payroll/runs', { ...v, note: v.note || undefined })).data.data,
    onSuccess: (r) => { toastOk(); setModal(false); form.reset(); void qc.invalidateQueries({ queryKey: ['pay-runs'] }); nav(`/payroll/runs/${r.id}`); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <>
      <PageHeader title={t('pay.runs_title')} description={t('pay.runs_intro')}
        actions={<>{(can('hr.payroll.export') || can('hr.payroll.export.configure')) && <Button variant="default" component={Link} to="/payroll/exports">{t('pay.exports_title')}</Button>}
          {can('hr.payroll.prepare') && <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>{t('pay.new_run')}</Button>}</>} />
      <Select mb="sm" w={240} clearable placeholder={t('common.status')} value={status} onChange={setStatus} data={['draft', 'calculated', 'reviewed', 'approved', 'locked', 'paid', 'declared', 'cancelled'].map((s) => ({ value: s, label: t(`pay.status.${s}`) }))} />
      <Table highlightOnHover verticalSpacing="sm" style={{ cursor: 'pointer' }}>
        <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('leave.period')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('pay.prepared_by')}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id} onClick={() => nav(`/payroll/runs/${r.id}`)}>
              <Table.Td><Badge variant="outline">{r.code}</Badge></Table.Td><Table.Td>{r.period_from} → {r.period_to}</Table.Td>
              <Table.Td>{t(`pay.runkind.${r.kind}`)}{r.parent && <Text size="xs" c="dimmed">{r.parent.code}</Text>}</Table.Td>
              <Table.Td><Badge color={RUN_COLOR[r.status]} variant="light">{t(`pay.status.${r.status}`)}</Badge></Table.Td><Table.Td>{r.prepared_by}</Table.Td>
            </Table.Tr>))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('pay.no_runs')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={modal} onClose={() => setModal(false)} title={t('pay.new_run')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.from')} required {...form.getInputProps('period_from')} /><TextInput type="date" label={t('leave.to')} required min={form.values.period_from || undefined} {...form.getInputProps('period_to')} /></Group>
          <Select label={t('trips.currency')} required searchable data={currencies.options} {...form.getInputProps('currency_id')} />
          <Textarea label={t('pay.note')} autosize minRows={2} maxLength={2000} {...form.getInputProps('note')} />
          <Text size="xs" c="dimmed">{t('pay.run_settings_note')}</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.create')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
