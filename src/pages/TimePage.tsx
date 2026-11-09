import { ActionIcon, Alert, Badge, Button, Group, Modal, Select, Stack, Switch, Table, Tabs, Text, TextInput } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { fmt } from '@/components/TimerWidget';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Entry { id: string; project: string; project_id: string; task: string | null; work_date: string; started_at: string; ended_at: string | null; duration_seconds: number; is_manual: boolean; manual_reason: string | null;
  is_billable: boolean; description: string | null; status: string; adjusts_entry_id: string | null; auto_stopped: boolean; editable: boolean }
interface Week { week_start: string; timesheet: { id: string; status: string; total_seconds: number; approval_request_id: string | null }; entries: Entry[]; total_seconds: number; billable_seconds: number }
interface TeamRow { id: string; user: string; week_start: string; status: string; total_seconds: number; approval_request_id: string | null }
const COLOR: Record<string, string> = { draft: 'gray', submitted: 'orange', approved: 'green', invoiced: 'blue' };
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const utc = (local: string) => new Date(local).toISOString().slice(0, 19).replace('T', ' ');
const hours = (s: number) => (s / 3600).toFixed(2);

export function TimePage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [date, setDate] = useState<string | null>(null);
  const [add, setAdd] = useState<{ project: string | null; task: string | null; start: string; end: string; reason: string; billable: boolean } | null>(null);
  const [adjust, setAdjust] = useState<{ id: string; minutes: string; reason: string } | null>(null);

  const week = useQuery({ queryKey: ['time-week', date], queryFn: async () => (await api.get<{ data: Week }>('/time-week', { params: date ? { date } : {} })).data.data });
  const team = useQuery({ queryKey: ['time-team'], enabled: can('time.view_team'), queryFn: async () => (await api.get<{ data: TeamRow[] }>('/timesheets')).data.data });
  const projects = useQuery({ queryKey: ['timer-projects'], queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/projects', { params: { per_page: 100 } })).data.data });
  const tasks = useQuery({ queryKey: ['timer-tasks', add?.project], enabled: !!add?.project, queryFn: async () => (await api.get<{ data: { id: string; key: string; title: string }[] }>(`/projects/${add!.project}/tasks`)).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['time-week'] }); void qc.invalidateQueries({ queryKey: ['time-team'] }); void qc.invalidateQueries({ queryKey: ['timer'] }); };

  const w = week.data;
  const byDay = useMemo(() => { const m = new Map<string, Entry[]>(); for (let i = 0; i < 7; i++) m.set(addDays(w?.week_start ?? '1970-01-05', i), []); w?.entries.forEach((e) => m.get(e.work_date)?.push(e)); return m; }, [w]);

  const save = useMutation({
    mutationFn: async () => api.post('/time-entries', { project_id: add!.project, task_id: add!.task, started_at: utc(add!.start), ended_at: utc(add!.end), reason: add!.reason, is_billable: add!.billable }),
    onSuccess: () => { toastOk(); setAdd(null); refresh(); }, onError: toastError,
  });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/time-entries/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const submit = useMutation({ mutationFn: async () => api.post(`/timesheets/${w!.week_start}/submit`), onSuccess: () => { toastOk(t('time.submitted')); refresh(); }, onError: toastError });
  const doAdjust = useMutation({ mutationFn: async () => api.post(`/time-entries/${adjust!.id}/adjust`, { seconds: Math.round(Number(adjust!.minutes) * 60), reason: adjust!.reason }),
    onSuccess: () => { toastOk(); setAdjust(null); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('time.title')} />
      <Tabs defaultValue="week">
        <Tabs.List mb="md"><Tabs.Tab value="week">{t('time.my_week')}</Tabs.Tab>{can('time.view_team') && <Tabs.Tab value="team">{t('time.team')}</Tabs.Tab>}</Tabs.List>
        <Tabs.Panel value="week">
          {w && <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <Group gap="xs"><ActionIcon variant="default" onClick={() => setDate(addDays(w.week_start, -7))} aria-label={t('time.prev')}><IconChevronLeft size={16} /></ActionIcon>
                <Text fw={600}>{w.week_start} → {addDays(w.week_start, 6)}</Text>
                <ActionIcon variant="default" onClick={() => setDate(addDays(w.week_start, 7))} aria-label={t('time.next')}><IconChevronRight size={16} /></ActionIcon>
                <Badge color={COLOR[w.timesheet.status === 'draft' ? 'draft' : w.timesheet.status]} variant="light">{t(`time.ts.${w.timesheet.status}`)}</Badge></Group>
              <Group gap="xs"><Text size="sm">{t('time.total')}: <b>{hours(w.total_seconds)} h</b> · {t('time.billable')}: {hours(w.billable_seconds)} h</Text>
                <Button variant="light" leftSection={<IconPlus size={16} />} disabled={w.timesheet.status !== 'draft'} onClick={() => setAdd({ project: null, task: null, start: '', end: '', reason: '', billable: true })}>{t('time.add_manual')}</Button>
                <Button loading={submit.isPending} disabled={w.timesheet.status !== 'draft' || w.entries.length === 0} onClick={() => submit.mutate()}>{t('time.submit_week')}</Button></Group>
            </Group>
            {w.entries.some((e) => e.auto_stopped) && <Alert color="red" variant="light">{t('time.auto_stopped_note')}</Alert>}
            {w.timesheet.status === 'submitted' && <Alert color="orange" variant="light">{t('time.awaiting_approval')} <Text component={Link} to="/approvals" size="sm" td="underline">{t('menu.approvals')}</Text></Alert>}
            <Table.ScrollContainer minWidth={680}><Table withTableBorder verticalSpacing="xs"><Table.Tbody>
              {[...byDay.entries()].map(([day, list]) => (
                <Table.Tr key={day} style={{ verticalAlign: 'top' }}>
                  <Table.Td w={120}><Text size="sm" fw={600}>{new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</Text>
                    <Text size="xs" c="dimmed">{hours(list.reduce((a, e) => a + e.duration_seconds, 0))} h</Text></Table.Td>
                  <Table.Td>{list.length === 0 ? <Text size="xs" c="dimmed">—</Text> : list.map((e) => (
                    <Group key={e.id} justify="space-between" wrap="nowrap" mb={4}>
                      <div><Text size="sm">{e.project}{e.task ? ` · ${e.task}` : ''}{e.description ? ` — ${e.description}` : ''}</Text>
                        <Group gap={4}>{e.is_manual && <Badge size="xs" variant="outline">{t('time.manual')}</Badge>}{e.adjusts_entry_id && <Badge size="xs" color="grape" variant="light">{t('time.adjustment')}</Badge>}
                          {e.auto_stopped && <Badge size="xs" color="red" variant="light">{t('time.auto_stopped')}</Badge>}{!e.is_billable && <Badge size="xs" variant="light">{t('time.non_billable')}</Badge>}
                          <Badge size="xs" color={COLOR[e.status]} variant="dot">{t(`time.es.${e.status}`)}</Badge></Group></div>
                      <Group gap={4} wrap="nowrap"><Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{e.duration_seconds < 0 ? '-' : ''}{fmt(Math.abs(e.duration_seconds))}</Text>
                        {e.editable && <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(e.id)} aria-label={t('common.delete')}><IconTrash size={16} /></ActionIcon>}
                        {can('time.adjust') && ['approved', 'invoiced'].includes(e.status) && !e.adjusts_entry_id && <Button size="compact-xs" variant="subtle" onClick={() => setAdjust({ id: e.id, minutes: '', reason: '' })}>{t('time.adjust')}</Button>}</Group>
                    </Group>))}</Table.Td>
                </Table.Tr>))}
            </Table.Tbody></Table></Table.ScrollContainer>
          </Stack>}
        </Tabs.Panel>
        {can('time.view_team') && <Tabs.Panel value="team"><Table.ScrollContainer minWidth={480}><Table withTableBorder striped><Table.Thead><Table.Tr><Table.Th>{t('common.user')}</Table.Th><Table.Th>{t('time.week')}</Table.Th><Table.Th>{t('time.total')}</Table.Th><Table.Th>{t('common.status')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{team.data?.map((r) => <Table.Tr key={r.id}><Table.Td>{r.user}</Table.Td><Table.Td>{r.week_start}</Table.Td><Table.Td>{hours(r.total_seconds)} h</Table.Td><Table.Td><Badge color={COLOR[r.status]} variant="light">{t(`time.ts.${r.status}`)}</Badge></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Tabs.Panel>}
      </Tabs>

      <Modal opened={!!add} onClose={() => setAdd(null)} title={t('time.add_manual')} centered>
        {add && <Stack gap="sm">
          <Select label={t('time.project')} searchable data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} value={add.project} onChange={(v) => setAdd({ ...add, project: v, task: null })} />
          <Select label={t('time.task_optional')} clearable searchable disabled={!add.project} data={(tasks.data ?? []).map((x) => ({ value: x.id, label: `${x.key} · ${x.title}` }))} value={add.task} onChange={(v) => setAdd({ ...add, task: v })} />
          <Group grow><TextInput type="datetime-local" label={t('time.from')} value={add.start} onChange={(e) => setAdd({ ...add, start: e.currentTarget.value })} /><TextInput type="datetime-local" label={t('time.to')} value={add.end} onChange={(e) => setAdd({ ...add, end: e.currentTarget.value })} /></Group>
          <TextInput label={t('time.reason')} description={t('time.reason_note')} value={add.reason} onChange={(e) => setAdd({ ...add, reason: e.currentTarget.value })} />
          <Switch label={t('time.billable')} checked={add.billable} onChange={(e) => setAdd({ ...add, billable: e.currentTarget.checked })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setAdd(null)}>{t('common.cancel')}</Button><Button disabled={!add.project || !add.start || !add.end || add.reason.trim().length < 5} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></Group>
        </Stack>}
      </Modal>
      <Modal opened={!!adjust} onClose={() => setAdjust(null)} title={t('time.adjust')} centered>
        {adjust && <Stack gap="sm"><Text size="sm" c="dimmed">{t('time.adjust_note')}</Text>
          <TextInput label={t('time.adjust_minutes')} description={t('time.adjust_minutes_note')} value={adjust.minutes} onChange={(e) => setAdjust({ ...adjust, minutes: e.currentTarget.value })} />
          <TextInput label={t('time.reason')} value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.currentTarget.value })} />
          <Group justify="flex-end"><Button disabled={!Number(adjust.minutes) || adjust.reason.trim().length < 5} loading={doAdjust.isPending} onClick={() => doAdjust.mutate()}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
    </>
  );
}
