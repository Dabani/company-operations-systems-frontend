import { Alert, Badge, Button, Card, Drawer, Group, Modal, MultiSelect, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Table, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconPlus, IconSend, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface Session {
  id: string; title: string; topic: LV; status: LV; session_date: string; duration_minutes: number | null; trainer: string | null; venue: string | null; is_mandatory: boolean; retain_until: string | null;
  invited_count: number; attended_count: number; my: { attended: boolean | null; signed_at: string | null } | null; notes?: string | null;
  attendees?: { user_id: string; name: string; department: string | null; attended: boolean | null; signed_at: string | null }[];
}
interface Reg { id: string; date: string; topic: string; title: string; participant: string; department: string | null; attended: boolean | null; signed_at: string | null }
interface Report { year: number; quarters: { quarter: number; sessions_held: number; mandatory_held: number; invited: number; attended: number; rate: number | null }[]; detail: { sessions: { id: string; title: string; topic: string; date: string; invited: number; attended: number }[]; gaps: { id: string; name: string; department: string | null }[] } | null }

const empty = { title: '', topic_id: null as string | null, session_date: '', duration_minutes: '' as number | '', trainer: '', venue: '', is_mandatory: true, invite_all: true, attendee_ids: [] as string[], notes: '' };

export function TrainingPage() {
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const manage = can('training.manage');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [people, setPeople] = useState<string[] | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState<string | null>(String(Math.ceil((new Date().getMonth() + 1) / 3)));
  const [comment, setComment] = useState('');
  const topics = useLookup('training_topic'); const statuses = useLookup('training_status');

  useEffect(() => { const id = params.get('open'); if (id) { setOpen(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);

  const users = useQuery({ queryKey: ['user-options'], enabled: manage && can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });
  const detail = useQuery({ queryKey: ['training', open], enabled: !!open, queryFn: async () => (await api.get<{ data: Session }>(`/training-sessions/${open}`)).data.data });
  const report = useQuery({ queryKey: ['training-report', year, quarter], enabled: manage || can('compliance.view'), queryFn: async () => (await api.get<{ data: Report }>('/training-report', { params: { year, quarter } })).data.data });
  const s = detail.data;

  const form = useForm({ initialValues: empty, validate: { title: (v) => (v.trim() ? null : t('case.subject')), topic_id: (v) => (v ? null : t('trn.topic')), session_date: (v) => (v ? null : t('trn.date')) } });
  const refresh = () => { ['trainings', 'training', 'training-register', 'training-report', 'obligations'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); };

  const create = useMutation({
    mutationFn: async (v: typeof empty) => api.post('/training-sessions', { ...v, duration_minutes: v.duration_minutes === '' ? null : v.duration_minutes }),
    onSuccess: () => { toastOk(); setCreating(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const act = useMutation({
    mutationFn: async (a: { method: 'post' | 'put'; path: string; body?: Record<string, unknown> }) => api[a.method](`/training-sessions/${open}/${a.path}`, a.body ?? {}),
    onSuccess: () => { toastOk(); setPeople(null); refresh(); }, onError: toastError,
  });
  const submit = useMutation({
    mutationFn: async () => (await api.post<{ data: { recipients: number } }>('/training-report/submit', { year: Number(year), quarter: Number(quarter), description: comment })).data.data,
    onSuccess: (r) => { toastOk(t('trn.submitted', { count: r.recipients })); setComment(''); void qc.invalidateQueries({ queryKey: ['management-reports'] }); }, onError: toastError,
  });

  const columns: Column<Session>[] = [
    { key: 'title', label: t('case.subject'), sortable: true, render: (x) => <div><Group gap={6} wrap="nowrap"><Text size="sm" fw={600} lineClamp={1}>{x.title}</Text>{x.is_mandatory && <Badge size="xs" color="red" variant="light">{t('trn.mandatory')}</Badge>}</Group><Text size="xs" c="dimmed">{x.topic.label}</Text></div> },
    { key: 'session_date', label: t('trn.date'), sortable: true, render: (x) => fmtDateTime(x.session_date, i18n.language) },
    { key: 'status', label: t('common.status'), render: (x) => <StatusBadge label={x.status.label} color={x.status.color} /> },
    { key: 'attended_count', label: t('trn.attended'), visibleFrom: 'sm', render: (x) => manage ? `${x.attended_count} / ${x.invited_count}` : x.my?.attended ? <Badge color="green" variant="light">{t('trn.confirmed')}</Badge> : <Badge color="gray" variant="light">{t('trn.invited')}</Badge> },
  ];
  const regColumns: Column<Reg>[] = [
    { key: 'date', label: t('trn.date'), render: (x) => x.date },
    { key: 'title', label: t('trn.topic'), render: (x) => <div><Text size="sm">{x.title}</Text><Text size="xs" c="dimmed">{x.topic}</Text></div> },
    { key: 'participant', label: t('trn.attendees'), render: (x) => <div><Text size="sm" fw={600}>{x.participant}</Text><Text size="xs" c="dimmed">{x.department ?? ''}</Text></div> },
    { key: 'attended', label: t('trn.attended'), render: (x) => x.attended === null ? '—' : <Badge color={x.attended ? 'green' : 'red'} variant="light">{x.attended ? t('trn.present') : t('trn.absent')}</Badge> },
    { key: 'signed_at', label: t('trn.confirmed'), visibleFrom: 'md', render: (x) => x.signed_at ? fmtDateTime(x.signed_at, i18n.language) : '—' },
  ];
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  const canConfirm = s?.my && s.status.code !== 'cancelled' && !s.my.signed_at && (s.status.code === 'held' || new Date(s.session_date).toDateString() === new Date().toDateString());

  return (
    <>
      <PageHeader title={t('trn.title')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('trn.new')}</Button> : undefined} />
      <Tabs defaultValue="sessions" keepMounted={false}>
        <Tabs.List mb="md"><Tabs.Tab value="sessions">{t('trn.all')}</Tabs.Tab><Tabs.Tab value="register">{t('trn.register')}</Tabs.Tab>{(manage || can('compliance.view')) && <Tabs.Tab value="report">{t('trn.report')}</Tabs.Tab>}</Tabs.List>

        <Tabs.Panel value="sessions">
          <DataList<Session> title={t('trn.title')} endpoint="/training-sessions" queryKey="trainings" columns={columns} defaultSort={{ key: 'session_date', direction: 'desc' }} onRowClick={(x) => setOpen(x.id)}
            filters={[{ key: 'topic_id', label: t('trn.topic'), options: topics.options }, { key: 'status_id', label: t('common.status'), options: statuses.options }]} />
        </Tabs.Panel>
        <Tabs.Panel value="register">
          <DataList<Reg> title={t('trn.register')} endpoint="/training-attendance" queryKey="training-register" columns={regColumns} />
        </Tabs.Panel>
        <Tabs.Panel value="report">
          <Stack gap="md">
            <Group>
              <Select label={t('trn.year')} data={years} value={year} onChange={(v) => setYear(v ?? year)} allowDeselect={false} w={120} />
              <SegmentedControl value={quarter ?? '1'} onChange={setQuarter} data={['1', '2', '3', '4'].map((q) => ({ value: q, label: `Q${q}` }))} mt={24} />
            </Group>
            <SimpleGrid cols={{ base: 2, md: 4 }}>
              {(report.data?.quarters ?? []).map((q) => (
                <Card key={q.quarter} padding="md" withBorder style={{ borderColor: String(q.quarter) === quarter ? 'var(--mantine-color-brand-5)' : undefined }}>
                  <Text size="xs" c="dimmed" fw={700}>Q{q.quarter}</Text><Text fz={26} fw={800}>{q.rate === null ? '—' : `${q.rate}%`}</Text>
                  <Text size="xs" c="dimmed">{t('trn.sessions')}: {q.sessions_held} · {q.attended}/{q.invited}</Text>
                </Card>))}
            </SimpleGrid>
            {report.data?.detail && (
              <Stack gap="sm">
                <Table withTableBorder fz="sm"><Table.Thead><Table.Tr><Table.Th>{t('trn.date')}</Table.Th><Table.Th>{t('case.subject')}</Table.Th><Table.Th>{t('trn.attended')}</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>{report.data.detail.sessions.map((x) => <Table.Tr key={x.id}><Table.Td>{x.date}</Table.Td><Table.Td>{x.title}<Text size="xs" c="dimmed">{x.topic}</Text></Table.Td><Table.Td>{x.attended}/{x.invited}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
                {report.data.detail.gaps.length > 0 && <Alert color="orange" title={`${t('trn.gaps')}: ${report.data.detail.gaps.length}`}><Text size="sm">{report.data.detail.gaps.map((g) => g.name + (g.department ? ` (${g.department})` : '')).join(', ')}</Text></Alert>}
                {(manage || can('compliance.manage')) && (
                  <Stack gap="xs"><RichTextField label={t('trn.comment')} value={comment} onChange={setComment} minHeight={70} />
                    <Group justify="flex-end"><Button leftSection={<IconSend size={16} />} loading={submit.isPending} onClick={() => submit.mutate()}>{t('trn.submit')}</Button></Group></Stack>)}
              </Stack>)}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={s ? <Group gap="xs"><Text fw={700}>{s.title}</Text><StatusBadge label={s.status.label} color={s.status.color} /></Group> : ''}>
        {s && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">{s.topic.label} · {fmtDateTime(s.session_date, i18n.language)}{s.duration_minutes ? ` · ${s.duration_minutes} min` : ''}{s.trainer ? ` · ${s.trainer}` : ''}{s.venue ? ` · ${s.venue}` : ''}</Text>
            {s.is_mandatory && <Badge color="red" variant="light" w="fit-content">{t('trn.mandatory')}</Badge>}
            {s.notes && <SafeHtml html={s.notes} />}
            {canConfirm && <Button color="green" leftSection={<IconCheck size={16} />} loading={act.isPending} onClick={() => act.mutate({ method: 'post', path: 'confirm' })}>{t('trn.confirm')}</Button>}
            {s.my?.signed_at && <Alert color="green" variant="light">{t('trn.confirmed')}: {fmtDateTime(s.my.signed_at, i18n.language)}</Alert>}
            {manage && s.status.code === 'planned' && <Group><Button loading={act.isPending} onClick={() => act.mutate({ method: 'post', path: 'complete' })}>{t('trn.complete')}</Button><Button variant="default" color="red" onClick={() => act.mutate({ method: 'post', path: 'cancel' })}>{t('trn.cancel')}</Button></Group>}

            <Group justify="space-between"><Text fw={700}>{t('trn.attendees')} ({s.attended_count}/{s.invited_count})</Text>{manage && s.status.code !== 'cancelled' && <Button size="compact-sm" variant="light" onClick={() => setPeople((s.attendees ?? []).map((a) => a.user_id))}>{t('trn.add_people')}</Button>}</Group>
            <Table withTableBorder fz="sm"><Table.Tbody>{(s.attendees ?? []).map((a) => (
              <Table.Tr key={a.user_id}>
                <Table.Td><Text size="sm" fw={a.user_id === me?.id ? 700 : 400}>{a.name}</Text><Text size="xs" c="dimmed">{a.department}</Text></Table.Td>
                <Table.Td>{a.signed_at && <Badge size="xs" color="green" variant="light">{t('trn.confirmed')}</Badge>}</Table.Td>
                <Table.Td>{manage && s.status.code !== 'cancelled' ? (
                  <Group gap={4} wrap="nowrap">
                    <Button size="compact-xs" color="green" variant={a.attended === true ? 'filled' : 'light'} leftSection={<IconCheck size={12} />} onClick={() => act.mutate({ method: 'post', path: 'attendance', body: { user_id: a.user_id, attended: true } })}>{t('trn.present')}</Button>
                    <Button size="compact-xs" color="red" variant={a.attended === false ? 'filled' : 'light'} leftSection={<IconX size={12} />} onClick={() => act.mutate({ method: 'post', path: 'attendance', body: { user_id: a.user_id, attended: false } })}>{t('trn.absent')}</Button></Group>
                ) : a.attended === null ? '—' : <Badge color={a.attended ? 'green' : 'red'} variant="light">{a.attended ? t('trn.present') : t('trn.absent')}</Badge>}</Table.Td>
              </Table.Tr>))}</Table.Tbody></Table>
            {s.retain_until && <Text size="xs" c="dimmed">{t('trn.retain')}: {s.retain_until}</Text>}
          </Stack>
        )}
      </Drawer>

      <Modal opened={people !== null} onClose={() => setPeople(null)} title={t('trn.add_people')} centered>
        <Stack><MultiSelect searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} value={people ?? []} onChange={setPeople} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setPeople(null)}>{t('common.cancel')}</Button><Button loading={act.isPending} onClick={() => act.mutate({ method: 'put', path: 'attendees', body: { user_ids: people ?? [] } })}>{t('common.save')}</Button></Group></Stack>
      </Modal>

      <Modal opened={creating} onClose={() => setCreating(false)} title={t('trn.new')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('case.subject')} required {...form.getInputProps('title')} />
            <Group grow align="flex-start"><Select label={t('trn.topic')} required data={topics.options} {...form.getInputProps('topic_id')} /><TextInput type="datetime-local" label={t('trn.date')} required {...form.getInputProps('session_date')} /></Group>
            <Group grow align="flex-start"><NumberInput label={t('trn.duration')} min={5} max={1440} {...form.getInputProps('duration_minutes')} /><TextInput label={t('trn.trainer')} {...form.getInputProps('trainer')} /><TextInput label={t('trn.venue')} {...form.getInputProps('venue')} /></Group>
            <Group><Switch label={t('trn.mandatory')} {...form.getInputProps('is_mandatory', { type: 'checkbox' })} /><Switch label={t('trn.invite_all')} {...form.getInputProps('invite_all', { type: 'checkbox' })} /></Group>
            {!form.values.invite_all && <MultiSelect label={t('trn.attendees')} searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...form.getInputProps('attendee_ids')} />}
            <RichTextField label={t('common.description')} value={form.values.notes} onChange={(v) => form.setFieldValue('notes', v)} minHeight={80} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
