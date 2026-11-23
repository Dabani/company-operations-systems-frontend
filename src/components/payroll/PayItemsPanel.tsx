import { ActionIcon, Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import type { PayComponent } from '@/components/payroll/PayComponentsPanel';
import { VERIFY_COLOR } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Row { id: string; employee_id: string; employee: string | null; component: string; kind: string; amount: string; valid_from: string; valid_to: string | null; reason: string | null; verification: string; prepared_by: string | null }

/** Recurring pay items of an employee (a fixed allowance or deduction). Amounts are sensitive: reading them is audited, and each item needs a second person's verification. */
export function PayItemsPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [emp, setEmp] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [ending, setEnding] = useState<Row | null>(null);
  const [endDate, setEndDate] = useState('');
  const form = useForm({ initialValues: { component_id: '', amount: '' as number | string, valid_from: '', valid_to: '', reason: '' } });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const comps = useQuery({ queryKey: ['pay-components'], queryFn: async () => (await api.get<{ data: PayComponent[] }>('/payroll/components')).data.data });
  const q = useQuery({ queryKey: ['pay-items', emp], enabled: !!emp, gcTime: 0, queryFn: async () => (await api.get<{ data: Row[] }>('/payroll/items', { params: { employee_id: emp } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['pay-items'] }); void qc.invalidateQueries({ queryKey: ['pay-status'] }); };
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/payroll/items', { ...v, employee_id: emp, valid_to: v.valid_to || undefined, reason: v.reason || undefined }),
    onSuccess: () => { toastOk(); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/payroll/items/${id}/verify`), onSuccess: () => { toastOk(t('pay.verified_ok')); refresh(); }, onError: toastError });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/payroll/items/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const end = useMutation({ mutationFn: async () => api.post(`/payroll/items/${ending!.id}/end`, { valid_to: endDate }), onSuccess: () => { toastOk(); setEnding(null); refresh(); }, onError: toastError });
  return (
    <>
      <Text size="sm" c="dimmed" mb="sm" maw={700}>{t('pay.items_hint')}</Text>
      <Group mb="sm" align="flex-end"><Select label={t('leave.employee')} searchable w={280} value={emp} onChange={setEmp} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} />
        {emp && can('hr.payroll.configure') && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button>}</Group>
      {emp && (
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>{t('pay.component')}</Table.Th><Table.Th ta="right">{t('trips.amount')}</Table.Th><Table.Th>{t('leave.valid')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((r) => (
              <Table.Tr key={r.id}><Table.Td><code>{r.component}</code> <Badge size="xs" variant="light" color={r.kind === 'earning' ? 'green' : 'orange'}>{t(`pay.kind.${r.kind}`)}</Badge><Text size="xs" c="dimmed">{r.reason}</Text></Table.Td>
                <Table.Td ta="right">{Number(r.amount).toLocaleString()}</Table.Td><Table.Td><Text size="xs">{r.valid_from} → {r.valid_to ?? '…'}</Text></Table.Td>
                <Table.Td><Badge variant={r.verification === 'verified' ? 'light' : 'filled'} color={VERIFY_COLOR[r.verification]}>{t(`pay.verification.${r.verification}`)}</Badge><Text size="xs" c="dimmed">{r.prepared_by}</Text></Table.Td>
                <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                  {r.verification !== 'verified' && can('hr.payroll.verify') && <Button size="compact-xs" color="green" variant="light" onClick={() => verify.mutate(r.id)}>{t('pay.verify')}</Button>}
                  {r.verification === 'verified' && !r.valid_to && can('hr.payroll.configure') && <Button size="compact-xs" variant="subtle" onClick={() => { setEnding(r); setEndDate(''); }}>{t('pay.end')}</Button>}
                  {r.verification !== 'verified' && can('hr.payroll.configure') && <Tooltip label={t('common.delete')}><ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => del.mutate(r.id)}><IconTrash size={14} /></ActionIcon></Tooltip>}
                </Group></Table.Td></Table.Tr>))}
            {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('pay.none_yet')}</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      )}
      <Modal opened={modal} onClose={() => setModal(false)} title={t('pay.add_item')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Select label={t('pay.component')} description={t('pay.recurring_only')} required data={(comps.data ?? []).filter((c) => c.source === 'recurring' && c.is_active).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} {...form.getInputProps('component_id')} />
          <NumberInput label={t('trips.amount')} required min={0} decimalScale={2} thousandSeparator=" " {...form.getInputProps('amount')} />
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.valid_from')} required {...form.getInputProps('valid_from')} /><TextInput type="date" label={t('leave.valid_to')} {...form.getInputProps('valid_to')} /></Group>
          <TextInput label={t('pay.reason')} maxLength={500} {...form.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!ending} onClose={() => setEnding(null)} title={t('pay.end')} centered size="sm">
        <Stack gap="sm"><TextInput type="date" label={t('leave.valid_to')} required value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEnding(null)}>{t('common.cancel')}</Button><Button disabled={!endDate} loading={end.isPending} onClick={() => end.mutate()}>{t('common.save')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
