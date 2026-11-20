import { Alert, Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Table, Text, Textarea, Tooltip, ActionIcon } from '@mantine/core';
import { IconHistory, IconPaperclip, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { LinkedFilesModal } from '@/components/LinkedFilesModal';
import { LeaveLedgerDrawer } from '@/components/leave/LeaveLedgerDrawer';
import { LeaveRequestModal } from '@/components/leave/LeaveRequestModal';
import { PageHeader } from '@/components/PageHeader';
import { balanceColor, canCancelOwn, formatDays, LEAVE_STATUS_COLOR, todayISO, type LeaveReq } from '@/lib/leave';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Summary { employee_id: string; leave_year: { id: number; start: string; end: string }; types: { leave_type_id: string; leave_type: string; uses_balance: boolean; balance?: string; pending?: string; available?: string; annual_entitlement?: string | null }[]; upcoming: LeaveReq[] }

export function MyLeavePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const types = useLookup('leave_type');
  const [modal, setModal] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [docs, setDocs] = useState<LeaveReq | null>(null);
  const [cancel, setCancel] = useState<LeaveReq | null>(null);
  const [reason, setReason] = useState('');
  const sum = useQuery({ queryKey: ['leave-me'], queryFn: async () => (await api.get<{ data: Summary }>('/leave/me/summary')).data.data, retry: false });
  const eid = sum.data?.employee_id;
  const mine = useQuery({ queryKey: ['leave-requests', 'mine', eid], enabled: !!eid, queryFn: async () => (await api.get<{ data: LeaveReq[] }>('/leave/requests', { params: { employee_id: eid } })).data.data });
  const label = (code: string) => types.items.find((l) => l.code === code)?.label ?? code;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['leave-me'] }); void qc.invalidateQueries({ queryKey: ['leave-requests'] }); };
  const doCancel = useMutation({
    mutationFn: async (r: LeaveReq) => api.post(`/leave/requests/${r.id}/cancel`, r.status === 'approved' ? { reason } : undefined),
    onSuccess: () => { toastOk(); setCancel(null); setReason(''); refresh(); }, onError: toastError,
  });

  if (sum.isError) return <><PageHeader title={t('leave.my_title')} /><Alert color="orange">{t('leave.no_employee')}</Alert></>;
  const today = todayISO();
  return (
    <>
      <PageHeader title={t('leave.my_title')} description={t('leave.my_intro')}
        actions={<><Button variant="default" leftSection={<IconHistory size={16} />} onClick={() => setLedger(true)}>{t('leave.ledger_title')}</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>{t('leave.new_request')}</Button></>} />
      <Alert variant="light" color="blue" mb="md">{t('leave.approval_note')} <Link to="/approvals">{t('hr.open_approvals')}</Link></Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="lg">
        {(sum.data?.types ?? []).filter((x) => x.uses_balance).map((x) => (
          <Card key={x.leave_type_id} withBorder padding="md">
            <Text size="sm" c="dimmed">{label(x.leave_type)}</Text>
            <Text fz={32} fw={700} c={balanceColor(x.available)}>{formatDays(x.available)} <Text span size="sm" c="dimmed">{t('leave.days_available')}</Text></Text>
            <Group gap="md" mt={4}>
              <Text size="xs" c="dimmed">{t('leave.balance')}: {formatDays(x.balance)}</Text>
              <Text size="xs" c="dimmed">{t('leave.reserved')}: {formatDays(x.pending)}</Text>
              {x.annual_entitlement && Number(x.annual_entitlement) > 0 && <Text size="xs" c="dimmed">{t('leave.per_year', { days: formatDays(x.annual_entitlement) })}</Text>}
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('leave.type')}</Table.Th><Table.Th>{t('leave.period')}</Table.Th><Table.Th>{t('leave.days')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(mine.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><Badge variant="outline">{r.code}</Badge></Table.Td>
              <Table.Td>{label(r.leave_type)}</Table.Td>
              <Table.Td>{r.start_date} → {r.end_date}</Table.Td>
              <Table.Td>{formatDays(r.days)}</Table.Td>
              <Table.Td><Badge color={LEAVE_STATUS_COLOR[r.status]} variant="light">{t(`leave.status.${r.status}`)}</Badge></Table.Td>
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                <Tooltip label={t('doc.title')}><ActionIcon variant="subtle" aria-label={t('doc.title')} onClick={() => setDocs(r)}><IconPaperclip size={16} /></ActionIcon></Tooltip>
                {canCancelOwn(r, today) && <Button size="compact-xs" variant="subtle" color="red" onClick={() => (r.status === 'approved' ? setCancel(r) : doCancel.mutate(r))}>{t('leave.withdraw')}</Button>}
              </Group></Table.Td>
            </Table.Tr>
          ))}
          {mine.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('leave.none')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <LeaveRequestModal opened={modal} onClose={() => setModal(false)} />
      <LeaveLedgerDrawer employeeId={ledger ? (eid ?? null) : null} onClose={() => setLedger(false)} />
      <LinkedFilesModal opened={!!docs} onClose={() => setDocs(null)} title={`${t('doc.title')} — ${docs?.code ?? ''}`} listUrl={`/leave/requests/${docs?.id}/files`} canUpload={!!docs && (docs.status === 'pending_approval' || docs.status === 'approved') && (can('hr.leave.request') || can('hr.leave.manage'))} hint={t('doc.leave_hint')} />
      <Modal opened={!!cancel} onClose={() => setCancel(null)} title={t('leave.withdraw')} centered size="sm">
        <Stack gap="sm"><Textarea label={t('leave.cancel_reason')} required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCancel(null)}>{t('common.cancel')}</Button><Button color="red" disabled={!reason.trim()} loading={doCancel.isPending} onClick={() => cancel && doCancel.mutate(cancel)}>{t('leave.withdraw')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
