import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Table, Tabs, Text, Textarea, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconHistory, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { LeaveAdjustModal } from '@/components/leave/LeaveAdjustModal';
import { LeaveLedgerDrawer } from '@/components/leave/LeaveLedgerDrawer';
import { LeaveRequestModal } from '@/components/leave/LeaveRequestModal';
import { PageHeader } from '@/components/PageHeader';
import { formatDays, isWeekend, LEAVE_STATUS_COLOR, leaveOnDate, monthDays, monthRange, shiftMonth, todayISO, type LeaveReq } from '@/lib/leave';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface BalanceRow { employee_id: string; employee: string; employee_number: string | null; balances: { leave_type_id: string; leave_type: string; balance: string; pending: string }[] }

export function TeamLeavePage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('hr.leave.manage');
  const types = useLookup('leave_type');
  const [ym, setYm] = useState(() => todayISO().slice(0, 7));
  const [tab, setTab] = useState<string | null>('calendar');
  const [status, setStatus] = useState<string | null>('pending_approval');
  const [behalf, setBehalf] = useState(false);
  const [adjust, setAdjust] = useState<{ id?: string } | null>(null);
  const [ledger, setLedger] = useState<{ id: string; name: string } | null>(null);
  const [cancel, setCancel] = useState<LeaveReq | null>(null);
  const [reason, setReason] = useState('');
  const { from, to } = monthRange(ym);
  const days = monthDays(ym);

  const cal = useQuery({ queryKey: ['leave-calendar', ym], queryFn: async () => (await api.get<{ data: LeaveReq[] }>('/leave/calendar', { params: { from, to } })).data.data });
  const bal = useQuery({ queryKey: ['leave-balances'], queryFn: async () => (await api.get<{ data: BalanceRow[] }>('/leave/balances')).data.data });
  const list = useQuery({ queryKey: ['leave-requests', 'team', status], enabled: tab === 'requests', queryFn: async () => (await api.get<{ data: LeaveReq[] }>('/leave/requests', { params: { status: status || undefined } })).data.data });
  const label = (code: string) => types.items.find((l) => l.code === code)?.label ?? code;
  const people = useMemo(() => {
    const map = new Map<string, string>((bal.data ?? []).map((b) => [b.employee_id, b.employee]));
    (cal.data ?? []).forEach((r) => { if (!map.has(r.employee_id)) map.set(r.employee_id, r.employee ?? '—'); });
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [bal.data, cal.data]);
  const doCancel = useMutation({
    mutationFn: async (r: LeaveReq) => api.post(`/leave/requests/${r.id}/cancel`, { reason }),
    onSuccess: () => { toastOk(); setCancel(null); setReason(''); void qc.invalidateQueries({ queryKey: ['leave-requests'] }); void qc.invalidateQueries({ queryKey: ['leave-calendar'] }); void qc.invalidateQueries({ queryKey: ['leave-balances'] }); }, onError: toastError,
  });
  const month = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`));
  const balTypes = bal.data?.[0]?.balances ?? [];

  return (
    <>
      <PageHeader title={t('leave.team_title')} description={t('leave.team_intro')}
        actions={<>{can('hr.leave.approve') && <Button variant="default" component={Link} to="/approvals">{t('hr.open_approvals')}</Button>}
          {manage && <><Button variant="default" onClick={() => setAdjust({})}>{t('leave.adjust_title')}</Button><Button leftSection={<IconPlus size={16} />} onClick={() => setBehalf(true)}>{t('leave.request_for')}</Button></>}</>} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md"><Tabs.Tab value="calendar">{t('leave.tab_calendar')}</Tabs.Tab><Tabs.Tab value="balances">{t('leave.tab_balances')}</Tabs.Tab><Tabs.Tab value="requests">{t('leave.tab_requests')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="calendar">
          <Group mb="sm" gap="xs">
            <ActionIcon variant="default" aria-label={t('leave.prev_month')} onClick={() => setYm(shiftMonth(ym, -1))}><IconChevronLeft size={16} /></ActionIcon>
            <Text fw={600} w={170} ta="center" tt="capitalize">{month}</Text>
            <ActionIcon variant="default" aria-label={t('leave.next_month')} onClick={() => setYm(shiftMonth(ym, 1))}><IconChevronRight size={16} /></ActionIcon>
            <Group gap={6} ml="md"><Badge color="teal" variant="filled" size="xs" circle /> <Text size="xs">{t('leave.status.approved')}</Text><Badge color="orange" variant="light" size="xs" circle /> <Text size="xs">{t('leave.status.pending_approval')}</Text></Group>
          </Group>
          <Table.ScrollContainer minWidth={900}>
            <Table withColumnBorders verticalSpacing={4} horizontalSpacing={2} fz="xs">
              <Table.Thead><Table.Tr><Table.Th miw={150}>{t('leave.employee')}</Table.Th>{days.map((d) => <Table.Th key={d} ta="center" w={26} bg={isWeekend(d) ? 'var(--mantine-color-gray-light)' : undefined}>{Number(d.slice(8))}</Table.Th>)}</Table.Tr></Table.Thead>
              <Table.Tbody>
                {people.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td fw={500}>{p.name}</Table.Td>
                    {days.map((d) => {
                      const r = leaveOnDate(cal.data ?? [], p.id, d);
                      const bg = r ? (r.status === 'approved' ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-orange-3)') : isWeekend(d) ? 'var(--mantine-color-gray-light)' : undefined;
                      return <Table.Td key={d} bg={bg} p={0}>{r ? <Tooltip label={`${label(r.leave_type)} · ${r.start_date} → ${r.end_date} · ${formatDays(r.days)}`}><div style={{ height: 20 }} aria-label={label(r.leave_type)} /></Tooltip> : null}</Table.Td>;
                    })}
                  </Table.Tr>
                ))}
                {people.length === 0 && <Table.Tr><Table.Td colSpan={days.length + 1}><Text size="sm" c="dimmed">{t('common.no_data')}</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        <Tabs.Panel value="balances">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>{t('leave.employee')}</Table.Th>{balTypes.map((b) => <Table.Th key={b.leave_type_id} ta="right">{label(b.leave_type)}</Table.Th>)}<Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(bal.data ?? []).map((r) => (
                <Table.Tr key={r.employee_id}>
                  <Table.Td><Text size="sm" fw={500}>{r.employee}</Text><Text size="xs" c="dimmed">{r.employee_number}</Text></Table.Td>
                  {r.balances.map((b) => <Table.Td key={b.leave_type_id} ta="right" c={Number(b.balance) < 0 ? 'red' : undefined}>{formatDays(b.balance)}{Number(b.pending) > 0 && <Text span size="xs" c="dimmed"> (−{formatDays(b.pending)})</Text>}</Table.Td>)}
                  <Table.Td><Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label={t('leave.ledger_title')}><ActionIcon variant="subtle" aria-label={t('leave.ledger_title')} onClick={() => setLedger({ id: r.employee_id, name: r.employee })}><IconHistory size={16} /></ActionIcon></Tooltip>
                    {manage && <Button size="compact-xs" variant="light" onClick={() => setAdjust({ id: r.employee_id })}>{t('leave.adjust_short')}</Button>}
                  </Group></Table.Td>
                </Table.Tr>
              ))}
              {bal.data?.length === 0 && <Table.Tr><Table.Td colSpan={balTypes.length + 2}><Text size="sm" c="dimmed">{t('common.no_data')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt="xs">{t('leave.balances_hint')}</Text>
        </Tabs.Panel>

        <Tabs.Panel value="requests">
          <Select mb="sm" w={240} clearable placeholder={t('common.status')} value={status} onChange={setStatus} data={['pending_approval', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: t(`leave.status.${s}`) }))} />
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>{t('leave.employee')}</Table.Th><Table.Th>{t('leave.type')}</Table.Th><Table.Th>{t('leave.period')}</Table.Th><Table.Th>{t('leave.days')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(list.data ?? []).map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.employee}</Table.Td><Table.Td>{label(r.leave_type)}</Table.Td><Table.Td>{r.start_date} → {r.end_date}</Table.Td><Table.Td>{formatDays(r.days)}</Table.Td>
                  <Table.Td><Badge color={LEAVE_STATUS_COLOR[r.status]} variant="light">{t(`leave.status.${r.status}`)}</Badge></Table.Td>
                  <Table.Td ta="right">{manage && r.status === 'approved' && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setCancel(r)}>{t('leave.cancel_approved')}</Button>}</Table.Td>
                </Table.Tr>
              ))}
              {list.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('leave.none')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>

      <LeaveRequestModal opened={behalf} onClose={() => setBehalf(false)} onBehalf />
      <LeaveAdjustModal key={adjust?.id ?? 'any'} opened={!!adjust} onClose={() => setAdjust(null)} employeeId={adjust?.id} />
      <LeaveLedgerDrawer employeeId={ledger?.id ?? null} name={ledger?.name} onClose={() => setLedger(null)} />
      <Modal opened={!!cancel} onClose={() => setCancel(null)} title={t('leave.cancel_approved')} centered size="sm">
        <Stack gap="sm"><Text size="sm" c="dimmed">{t('leave.cancel_approved_hint')}</Text>
          <Textarea label={t('leave.cancel_reason')} required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCancel(null)}>{t('common.cancel')}</Button><Button color="red" disabled={!reason.trim()} loading={doCancel.isPending} onClick={() => cancel && doCancel.mutate(cancel)}>{t('leave.cancel_approved')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
