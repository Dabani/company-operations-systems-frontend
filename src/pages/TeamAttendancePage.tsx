import { Alert, Badge, Button, Drawer, Group, Modal, SegmentedControl, Stack, Table, Tabs, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconLockOpen, IconRefresh } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CorrectionModal, type CorrectionTarget } from '@/components/CorrectionModal';
import { PageHeader } from '@/components/PageHeader';
import { STATUS_COLOR, currentMonth, fmtMinutes, fmtTime, shiftMonth, weekday } from '@/lib/attendance';
import { toastError, toastOk } from '@/lib/ui';
import type { DayRow } from './ClockPage';

interface SummaryRow { employee_id: string; employee: string; employee_number: string; present: number; late: number; absent: number; holiday: number; leave: number; day_off: number; incomplete: number;
  expected_minutes: number; worked_minutes: number; late_minutes: number; overtime_minutes: number }
interface Summary { month: string; validated: boolean; pending_corrections: number; rows: SummaryRow[] }
interface Correction { id: string; employee: string | null; work_date: string; in_at: string; out_at: string; reason: string; status: string; requested_by: string | null; mine: boolean; timezone: string }
const CORR_COLOR: Record<string, string> = { pending_approval: 'orange', approved: 'green', rejected: 'red', cancelled: 'gray' };

export function TeamAttendancePage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState<SummaryRow | null>(null);
  const [correct, setCorrect] = useState<CorrectionTarget | null>(null);
  const [validate, setValidate] = useState(false);
  const [reopen, setReopen] = useState(false);
  const [status, setStatus] = useState('pending_approval');
  const reopenForm = useForm({ initialValues: { reason: '' } });
  const lang = i18n.language;

  const summary = useQuery({ queryKey: ['att-summary', month], queryFn: async () => (await api.get<{ data: Summary }>('/attendance/summary', { params: { month: month || undefined } })).data.data });
  const m = month || summary.data?.month || currentMonth('UTC');
  const days = useQuery({ queryKey: ['att-team-days', m, person?.employee_id], enabled: !!person, queryFn: async () => (await api.get<{ data: { timezone: string; validated: boolean; days: DayRow[] } }>('/attendance/days', { params: { month: m, employee_id: person!.employee_id } })).data.data });
  const corrections = useQuery({ queryKey: ['att-corrections', status], queryFn: async () => (await api.get<{ data: Correction[] }>('/attendance/corrections', { params: { status } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['att-summary'] }); void qc.invalidateQueries({ queryKey: ['att-team-days'] }); void qc.invalidateQueries({ queryKey: ['att-periods'] }); };

  const doValidate = useMutation({ mutationFn: async () => api.post(`/attendance/periods/${m}/validate`), onSuccess: () => { toastOk(t('att.month_validated')); setValidate(false); refresh(); }, onError: (e) => { setValidate(false); toastError(e); } });
  const doReopen = useMutation({ mutationFn: async (v: { reason: string }) => api.post(`/attendance/periods/${m}/reopen`, v), onSuccess: () => { toastOk(t('att.month_reopened')); setReopen(false); reopenForm.reset(); refresh(); }, onError: (e) => { reopenForm.setErrors(parseError(e).fields); toastError(e); } });
  const recompute = useMutation({ mutationFn: async () => api.post('/attendance/recompute', { month: m }), onSuccess: () => { toastOk(t('att.recomputed')); refresh(); }, onError: toastError });
  const cancel = useMutation({ mutationFn: async (id: string) => api.post(`/attendance/corrections/${id}/cancel`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-corrections'] }); void qc.invalidateQueries({ queryKey: ['att-summary'] }); }, onError: toastError });

  const s = summary.data;
  const tz = days.data?.timezone ?? 'UTC';
  return (
    <>
      <PageHeader title={t('att.team_title')} description={t('att.team_intro')} />
      <Group mb="md" align="flex-end" justify="space-between">
        <Group align="flex-end" gap="xs">
          <Button variant="default" size="sm" onClick={() => setMonth(shiftMonth(m, -1))}>‹</Button>
          <TextInput type="month" label={t('att.month')} value={m} onChange={(e) => setMonth(e.currentTarget.value)} />
          <Button variant="default" size="sm" onClick={() => setMonth(shiftMonth(m, 1))}>›</Button>
          {s && <Badge size="lg" color={s.validated ? 'green' : 'gray'} variant="light" leftSection={s.validated ? <IconLock size={14} /> : <IconLockOpen size={14} />}>{s.validated ? t('att.validated') : t('att.open')}</Badge>}
          {!!s?.pending_corrections && <Badge size="lg" color="orange" variant="light">{t('att.pending_corrections', { count: s.pending_corrections })}</Badge>}
        </Group>
        <Group gap="xs">
          {can('hr.attendance.manage') && !s?.validated && <Button variant="default" leftSection={<IconRefresh size={16} />} loading={recompute.isPending} onClick={() => recompute.mutate()}>{t('att.recompute')}</Button>}
          {can('hr.attendance.validate') && !s?.validated && <Button leftSection={<IconLock size={16} />} onClick={() => setValidate(true)}>{t('att.validate_month')}</Button>}
          {can('hr.attendance.reopen') && s?.validated && <Button color="red" variant="light" leftSection={<IconLockOpen size={16} />} onClick={() => setReopen(true)}>{t('att.reopen_month')}</Button>}
        </Group>
      </Group>

      <Tabs defaultValue="summary">
        <Tabs.List mb="md"><Tabs.Tab value="summary">{t('att.tab_summary')}</Tabs.Tab><Tabs.Tab value="corrections">{t('att.tab_corrections')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="summary">
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('hr.employee')}</Table.Th><Table.Th>{t('att.status.present')}</Table.Th><Table.Th>{t('att.status.late')}</Table.Th><Table.Th>{t('att.status.absent')}</Table.Th><Table.Th visibleFrom="md">{t('att.status.leave')}</Table.Th><Table.Th visibleFrom="md">{t('att.status.incomplete')}</Table.Th><Table.Th>{t('att.worked')}</Table.Th><Table.Th visibleFrom="sm">{t('att.late')}</Table.Th><Table.Th visibleFrom="sm">{t('att.overtime')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(s?.rows ?? []).map((r) => (
                <Table.Tr key={r.employee_id} style={{ cursor: 'pointer' }} onClick={() => setPerson(r)}>
                  <Table.Td><Text size="sm" fw={600}>{r.employee}</Text><Text size="xs" c="dimmed">{r.employee_number}</Text></Table.Td>
                  <Table.Td>{r.present}</Table.Td><Table.Td>{r.late || '—'}</Table.Td><Table.Td>{r.absent ? <Text c="red" fw={600} size="sm">{r.absent}</Text> : '—'}</Table.Td>
                  <Table.Td visibleFrom="md">{r.leave || '—'}</Table.Td><Table.Td visibleFrom="md">{r.incomplete ? <Text c="orange" fw={600} size="sm">{r.incomplete}</Text> : '—'}</Table.Td>
                  <Table.Td>{fmtMinutes(r.worked_minutes)}</Table.Td><Table.Td visibleFrom="sm">{r.late_minutes ? `${r.late_minutes} min` : '—'}</Table.Td><Table.Td visibleFrom="sm">{r.overtime_minutes ? fmtMinutes(r.overtime_minutes) : '—'}</Table.Td>
                </Table.Tr>
              ))}
              {s?.rows.length === 0 && <Table.Tr><Table.Td colSpan={9}><Text size="sm" c="dimmed">{t('att.no_team')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="corrections">
          <Group mb="md"><SegmentedControl value={status} onChange={setStatus} data={['pending_approval', 'approved', 'rejected', 'cancelled'].map((x) => ({ value: x, label: t(`hr.status.${x}`) }))} /></Group>
          {status === 'pending_approval' && <Alert variant="light" color="blue" mb="md">{t('att.corrections_note')} <Link to="/approvals">{t('hr.open_approvals')}</Link></Alert>}
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('hr.employee')}</Table.Th><Table.Th>{t('att.date')}</Table.Th><Table.Th>{t('att.in')} – {t('att.out')}</Table.Th><Table.Th visibleFrom="md">{t('att.reason')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(corrections.data ?? []).map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.employee}</Table.Td><Table.Td>{c.work_date}</Table.Td><Table.Td>{fmtTime(c.in_at, c.timezone, lang)} – {fmtTime(c.out_at, c.timezone, lang)}</Table.Td>
                  <Table.Td visibleFrom="md"><Text size="xs" c="dimmed" lineClamp={2}>{c.reason}</Text></Table.Td>
                  <Table.Td><Badge color={CORR_COLOR[c.status]} variant="light">{t(`hr.status.${c.status}`)}</Badge></Table.Td>
                  <Table.Td>{c.mine && c.status === 'pending_approval' && <Button size="compact-xs" color="red" variant="subtle" onClick={() => cancel.mutate(c.id)}>{t('approvals.cancel')}</Button>}</Table.Td>
                </Table.Tr>
              ))}
              {corrections.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('att.no_corrections')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={!!person} onClose={() => setPerson(null)} position="right" size="lg" title={person ? `${person.employee} — ${m}` : ''}>
        <Table verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>{t('att.date')}</Table.Th><Table.Th>{t('att.in')}</Table.Th><Table.Th>{t('att.out')}</Table.Th><Table.Th>{t('att.worked')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(days.data?.days ?? []).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{weekday(r.work_date, lang)} {r.work_date.slice(8)}</Table.Td><Table.Td>{fmtTime(r.first_in_at, tz, lang)}</Table.Td><Table.Td>{r.is_open ? '…' : fmtTime(r.last_out_at, tz, lang)}</Table.Td><Table.Td>{fmtMinutes(r.worked_minutes)}</Table.Td>
                <Table.Td><Badge color={STATUS_COLOR[r.status]} variant="light">{t(`att.status.${r.status}`)}</Badge>{r.late_minutes > 0 && <Text size="xs" c="orange">{r.late_minutes} min</Text>}</Table.Td>
                <Table.Td>{can('hr.attendance.correct') && !days.data?.validated && <Button size="compact-xs" variant="subtle" onClick={() => setCorrect({ employeeId: r.employee_id, employeeName: person?.employee, date: r.work_date, firstIn: r.first_in_at, lastOut: r.last_out_at, timezone: tz })}>{t('att.correct')}</Button>}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Drawer>

      <ConfirmModal opened={validate} onClose={() => setValidate(false)} onConfirm={() => doValidate.mutate()} loading={doValidate.isPending} title={t('att.validate_month')} text={t('att.validate_confirm', { month: m })} />
      <Modal opened={reopen} onClose={() => setReopen(false)} centered title={t('att.reopen_month')}>
        <form onSubmit={reopenForm.onSubmit((v) => doReopen.mutate(v))}><Stack gap="sm">
          <Alert color="red" variant="light">{t('att.reopen_warning')}</Alert>
          <Textarea label={t('att.reason')} required minLength={5} autosize minRows={2} {...reopenForm.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setReopen(false)}>{t('common.cancel')}</Button><Button color="red" type="submit" loading={doReopen.isPending}>{t('att.reopen_month')}</Button></Group>
        </Stack></form>
      </Modal>
      <CorrectionModal target={correct} onClose={() => setCorrect(null)} />
    </>
  );
}
