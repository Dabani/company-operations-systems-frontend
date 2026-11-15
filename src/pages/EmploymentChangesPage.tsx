import { Alert, Badge, Button, Group, SegmentedControl, Table, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';

interface Row { id: string; employee: string | null; change_type: string; status: string; effective_from: string; reason: string | null; created_by: string | null; salary_amount?: string | null; salary_currency?: string | null }
const COLOR: Record<string, string> = { effective: 'green', pending_approval: 'orange', rejected: 'red', cancelled: 'gray' };

export function EmploymentChangesPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_approval');
  const q = useQuery({ queryKey: ['hr-changes', status], queryFn: async () => (await api.get<{ data: Row[] }>('/employment-changes', { params: { status } })).data.data });
  const cancel = useMutation({ mutationFn: async (id: string) => api.post(`/employment-changes/${id}/cancel`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['hr-changes'] }); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('hr.changes_title')} description={t('hr.changes_intro')} />
      <Group mb="md"><SegmentedControl value={status} onChange={setStatus} data={['pending_approval', 'effective', 'rejected', 'cancelled'].map((s) => ({ value: s, label: t(`hr.status.${s}`) }))} /></Group>
      {status === 'pending_approval' && <Alert variant="light" color="blue" mb="md">{t('hr.pending_note')} <Link to="/approvals">{t('hr.open_approvals')}</Link></Alert>}
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead><Table.Tr><Table.Th>{t('hr.employee')}</Table.Th><Table.Th>{t('hr.change_type')}</Table.Th><Table.Th>{t('hr.effective_from')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th visibleFrom="md">{t('hr.reason')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><Text size="sm" fw={600}>{r.employee}</Text></Table.Td><Table.Td>{t(`hr.type.${r.change_type}`)}{r.salary_amount != null ? ` — ${Number(r.salary_amount).toLocaleString()} ${r.salary_currency ?? ''}` : ''}</Table.Td>
              <Table.Td>{r.effective_from}</Table.Td><Table.Td><Badge color={COLOR[r.status]} variant="light">{t(`hr.status.${r.status}`)}</Badge></Table.Td>
              <Table.Td visibleFrom="md"><Text size="xs" c="dimmed" lineClamp={2}>{r.reason ?? ''}</Text></Table.Td>
              <Table.Td>{r.status === 'pending_approval' && r.created_by === me?.id && <Button size="compact-xs" color="red" variant="subtle" loading={cancel.isPending} onClick={() => cancel.mutate(r.id)}>{t('approvals.cancel')}</Button>}</Table.Td>
            </Table.Tr>
          ))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">{t('hr.no_changes')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
    </>
  );
}
