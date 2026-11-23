import { ActionIcon, Badge, Button, Group, Modal, SegmentedControl, Select, Stack, Switch, Table, Text, TextInput, Textarea, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { VERIFY_COLOR } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface Row { id: string; scheme: string; category: string | null; employee_id: string | null; employee: string | null; applies: boolean; valid_from: string; valid_to: string | null; reason: string | null; verification: string; prepared_by: string | null }

/** Which schemes apply to which employee category, plus approved exceptions for one employee. No assignment = the scheme does NOT apply (the dry-run says so). */
export function PayAssignmentsPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const cats = useLookup('employee_category');
  const [modal, setModal] = useState(false);
  const [target, setTarget] = useState<'category' | 'employee'>('category');
  const [ending, setEnding] = useState<Row | null>(null);
  const [endDate, setEndDate] = useState('');
  const form = useForm({ initialValues: { scheme_id: '', category_id: '', employee_id: '', applies: true, valid_from: '', valid_to: '', reason: '' } });
  const q = useQuery({ queryKey: ['pay-assignments'], queryFn: async () => (await api.get<{ data: Row[] }>('/payroll/assignments')).data.data });
  const schemes = useQuery({ queryKey: ['pay-schemes'], queryFn: async () => (await api.get<{ data: { id: string; code: string; name: string }[] }>('/payroll/schemes')).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], enabled: modal, queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['pay-assignments'] }); void qc.invalidateQueries({ queryKey: ['pay-status'] }); };
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/payroll/assignments', { scheme_id: v.scheme_id, category_id: target === 'category' ? v.category_id : undefined, employee_id: target === 'employee' ? v.employee_id : undefined, applies: v.applies, valid_from: v.valid_from, valid_to: v.valid_to || undefined, reason: v.reason || undefined }),
    onSuccess: () => { toastOk(); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/payroll/assignments/${id}/verify`), onSuccess: () => { toastOk(t('pay.verified_ok')); refresh(); }, onError: toastError });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/payroll/assignments/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const end = useMutation({ mutationFn: async () => api.post(`/payroll/assignments/${ending!.id}/end`, { valid_to: endDate }), onSuccess: () => { toastOk(); setEnding(null); refresh(); }, onError: toastError });
  return (
    <>
      <Group justify="space-between" mb="sm" align="flex-start"><Text size="sm" c="dimmed" maw={700}>{t('pay.assign_hint')}</Text>
        {can('hr.payroll.configure') && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button>}</Group>
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>{t('pay.scheme')}</Table.Th><Table.Th>{t('pay.target')}</Table.Th><Table.Th>{t('pay.applies')}</Table.Th><Table.Th>{t('leave.valid')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><code>{r.scheme}</code></Table.Td>
              <Table.Td>{r.employee ? <><Badge size="xs" color="grape" variant="light">{t('pay.exception')}</Badge> {r.employee}<Text size="xs" c="dimmed">{r.reason}</Text></> : (cats.items.find((c) => c.code === r.category)?.label ?? r.category)}</Table.Td>
              <Table.Td><Badge color={r.applies ? 'green' : 'gray'} variant="light">{r.applies ? t('pay.applies') : t('pay.does_not_apply')}</Badge></Table.Td>
              <Table.Td><Text size="xs">{r.valid_from} → {r.valid_to ?? '…'}</Text></Table.Td>
              <Table.Td><Badge variant={r.verification === 'verified' ? 'light' : 'filled'} color={VERIFY_COLOR[r.verification]}>{t(`pay.verification.${r.verification}`)}</Badge><Text size="xs" c="dimmed">{r.prepared_by}</Text></Table.Td>
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                {r.verification !== 'verified' && can('hr.payroll.verify') && <Button size="compact-xs" color="green" variant="light" onClick={() => verify.mutate(r.id)}>{t('pay.verify')}</Button>}
                {r.verification === 'verified' && !r.valid_to && can('hr.payroll.configure') && <Button size="compact-xs" variant="subtle" onClick={() => { setEnding(r); setEndDate(''); }}>{t('pay.end')}</Button>}
                {r.verification !== 'verified' && can('hr.payroll.configure') && <Tooltip label={t('common.delete')}><ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => del.mutate(r.id)}><IconTrash size={14} /></ActionIcon></Tooltip>}
              </Group></Table.Td>
            </Table.Tr>))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('pay.none_yet')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={modal} onClose={() => setModal(false)} title={t('pay.add_assignment')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Select label={t('pay.scheme')} required data={(schemes.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))} {...form.getInputProps('scheme_id')} />
          <SegmentedControl value={target} onChange={(v) => setTarget(v as 'category' | 'employee')} data={[{ value: 'category', label: t('pay.by_category') }, { value: 'employee', label: t('pay.by_employee') }]} />
          {target === 'category' ? <Select label={t('pay.category')} required data={cats.options} {...form.getInputProps('category_id')} />
            : <><Select label={t('leave.employee')} required searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('employee_id')} /><Textarea label={t('pay.reason')} description={t('pay.exception_reason')} required autosize minRows={2} maxLength={500} {...form.getInputProps('reason')} /></>}
          <Switch label={t('pay.applies')} {...form.getInputProps('applies', { type: 'checkbox' })} />
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.valid_from')} required {...form.getInputProps('valid_from')} /><TextInput type="date" label={t('leave.valid_to')} {...form.getInputProps('valid_to')} /></Group>
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
