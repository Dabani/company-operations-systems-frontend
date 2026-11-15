import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';
import { RichTextField } from '@/components/RichTextField';
import { plainText } from '@/lib/richText';

interface Req { id: string; code: string; title: string; department: string | null; headcount: number; justification: string; needed_by: string | null; status: string; requested_by: string | null; vacancy_id: string | null }
export const REQ_COLOR: Record<string, string> = { pending_approval: 'orange', approved: 'green', rejected: 'red', cancelled: 'gray', filled: 'teal' };

export function RequisitionsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [vac, setVac] = useState<Req | null>(null);
  const form = useForm({ initialValues: { department_id: null as string | null, title: '', headcount: 1 as number | string, needed_by: '', justification: '' } });
  const vform = useForm({ initialValues: { title: '', description: '', closes_on: '' } });
  const q = useQuery({ queryKey: ['hr-requisitions'], queryFn: async () => (await api.get<{ data: Req[] }>('/requisitions')).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-requisitions'] }); void qc.invalidateQueries({ queryKey: ['hr-vacancies'] }); };

  const create = useMutation({ mutationFn: async (v: typeof form.values) => api.post('/requisitions', { ...v, needed_by: v.needed_by || undefined }),
    onSuccess: () => { toastOk(t('rec.requisition_sent')); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const cancel = useMutation({ mutationFn: async (id: string) => api.post(`/requisitions/${id}/cancel`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const open = useMutation({ mutationFn: async (v: typeof vform.values) => api.post(`/requisitions/${vac!.id}/vacancy`, { title: v.title || undefined, description: v.description || undefined, closes_on: v.closes_on || undefined }),
    onSuccess: () => { toastOk(t('rec.vacancy_opened')); setVac(null); vform.reset(); refresh(); }, onError: (e) => { vform.setErrors(parseError(e).fields); toastError(e); } });

  return (
    <>
      <PageHeader title={t('rec.requisitions_title')} description={t('rec.requisitions_intro')}
        actions={can('hr.requisition.create') || can('hr.recruitment.manage') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>{t('rec.new_requisition')}</Button> : undefined} />
      <Alert variant="light" color="blue" mb="md">{t('rec.approval_note')} <Link to="/approvals">{t('hr.open_approvals')}</Link></Alert>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('rec.job_title')}</Table.Th><Table.Th visibleFrom="sm">{t('employees.department')}</Table.Th><Table.Th>{t('rec.headcount')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><Badge variant="outline">{r.code}</Badge></Table.Td>
              <Table.Td><Text size="sm" fw={600}>{r.title}</Text><Text size="xs" c="dimmed" lineClamp={1}>{r.requested_by} · {plainText(r.justification)}</Text></Table.Td>
              <Table.Td visibleFrom="sm">{r.department ?? '—'}</Table.Td><Table.Td>{r.headcount}</Table.Td>
              <Table.Td><Badge color={REQ_COLOR[r.status]} variant="light">{t(`rec.req_status.${r.status}`)}</Badge></Table.Td>
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                {r.status === 'approved' && !r.vacancy_id && can('hr.recruitment.manage') && <Button size="compact-xs" variant="light" onClick={() => { setVac(r); vform.setValues({ title: r.title, description: '', closes_on: '' }); }}>{t('rec.open_vacancy')}</Button>}
                {(r.status === 'pending_approval' || (r.status === 'approved' && !r.vacancy_id)) && <Button size="compact-xs" variant="subtle" color="red" loading={cancel.isPending} onClick={() => cancel.mutate(r.id)}>{t('approvals.cancel')}</Button>}
              </Group></Table.Td>
            </Table.Tr>
          ))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('rec.no_requisitions')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={modal} onClose={() => setModal(false)} title={t('rec.new_requisition')} centered size="lg">
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Group grow align="flex-start"><TextInput label={t('rec.job_title')} required {...form.getInputProps('title')} /><Select label={t('employees.department')} required searchable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('rec.headcount')} min={1} max={500} required {...form.getInputProps('headcount')} /><TextInput type="date" label={t('rec.needed_by')} {...form.getInputProps('needed_by')} /></Group>
          <RichTextField label={t('rec.justification')} description={t('rec.justification_hint')} required minHeight={100} {...form.getInputProps('justification')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('rec.submit_requisition')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!vac} onClose={() => setVac(null)} title={`${t('rec.open_vacancy')} — ${vac?.code ?? ''}`} centered size="lg">
        <form onSubmit={vform.onSubmit((v) => open.mutate(v))}><Stack gap="sm">
          <TextInput label={t('rec.job_title')} {...vform.getInputProps('title')} />
          <RichTextField label={t('rec.vacancy_description')} minHeight={120} {...vform.getInputProps('description')} />
          <TextInput type="date" label={t('rec.closes_on')} {...vform.getInputProps('closes_on')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setVac(null)}>{t('common.cancel')}</Button><Button type="submit" loading={open.isPending}>{t('rec.open_vacancy')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
