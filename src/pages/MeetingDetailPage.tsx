import { ActionIcon, Alert, Badge, Button, Card, Collapse, Group, Menu, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Table, Tabs, Text, TextInput, Timeline } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArrowDown, IconArrowUp, IconCalendarPlus, IconCheck, IconChevronDown, IconDotsVertical, IconEdit, IconLock, IconPaperclip, IconPlayerPlay, IconPlus, IconSend, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, downloadBlob, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { MeetingFormModal, type MeetingForEdit } from '@/components/MeetingFormModal';
import { PageHeader } from '@/components/PageHeader';
import { PapersPanel } from '@/components/PapersPanel';
import { MeetingAttendanceTab } from '@/components/MeetingAttendanceTab';
import { PeopleMultiSelect, PersonSelect, usePeople } from '@/components/PeoplePicker';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { MEETING_COLOR, PRIORITY_COLOR, RSVP_COLOR, fmtDateTime, fmtRange, wallToUtc } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import { ForbiddenPage, NotFoundPage } from './ErrorPages';
import type { Paginated } from '@/types';

type P = { id: string; name: string } | null;
interface Item { id: string; position: number; title: string; description: string | null; presenter: P; presenter_name: string | null; duration_minutes: number | null; priority: string | null; expected_decision: string | null; is_confidential: boolean }
interface Invitation { id: string; name: string; is_guest: boolean; response: string; department: string | null; responded_at: string | null; email?: string; note?: string | null; proposed_starts_at?: string | null }
interface Detail extends MeetingForEdit {
  code: string; type: string; agenda_status: string; agenda_approved_at: string | null; started_at: string | null; ended_at: string | null; cancel_reason: string | null;
  room: { id: string; name: string; capacity: number | null } | null; department: { id: string; name: string } | null; project: { id: string; code: string; name: string } | null; organizer: P;
  series: { frequency: string; interval: number; count: number } | null; agenda: Item[]; invitations: Invitation[];
  history: { status: string; note: string | null; by: string | null; at: string }[];
  schedule_history: { starts_at: string; ends_at: string; room: string | null; venue: string | null; reason: string | null; by: string | null; at: string }[];
  me: { is_organizer: boolean; is_chair: boolean; is_secretary: boolean; invitation_id: string | null; my_response: string | null; can_manage: boolean; can_edit: boolean; can_chair: boolean; can_rsvp: boolean; can_schedule: boolean; can_cancel: boolean; can_start: boolean; can_hold: boolean };
}

export function MeetingDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const lang = i18n.language;
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirm, setConfirm] = useState<'hold' | 'start' | null>(null);
  const [proposing, setProposing] = useState(false);
  const cancelForm = useForm({ initialValues: { reason: '' } });
  const proposeForm = useForm({ initialValues: { when: '', note: '' } });

  const q = useQuery({ queryKey: ['meeting', id], retry: false, queryFn: async () => (await api.get<{ data: Detail }>(`/meetings/${id}`)).data.data });
  const m = q.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['meeting', id] }); void qc.invalidateQueries({ queryKey: ['meetings'] }); };

  const act = (path: string, ok: string, body?: object) => useMutation({ mutationFn: async () => api.post(`/meetings/${id}/${path}`, body), onSuccess: () => { toastOk(ok); setConfirm(null); refresh(); }, onError: (e) => { setConfirm(null); toastError(e); } });
  const schedule = act('schedule', t('meet.scheduled_ok'));
  const start = act('start', t('meet.started_ok'));
  const hold = act('hold', t('meet.held_ok'));
  const cancel = useMutation({ mutationFn: async (v: { reason: string }) => api.post(`/meetings/${id}/cancel`, v), onSuccess: () => { toastOk(t('meet.cancelled_ok')); setCancelling(false); cancelForm.reset(); refresh(); }, onError: (e) => { cancelForm.setErrors(parseError(e).fields); toastError(e); } });
  const rsvp = useMutation({ mutationFn: async (v: { response: string; note?: string; proposed_starts_at?: string }) => api.post(`/meetings/${id}/rsvp`, v), onSuccess: () => { toastOk(t('meet.answer_saved')); setProposing(false); proposeForm.reset(); refresh(); }, onError: toastError });

  if (q.isError) { const s = (q.error as { response?: { status?: number } }).response?.status; return s === 403 ? <ForbiddenPage /> : <NotFoundPage />; }
  if (!m) return null;
  const tz = m.timezone;
  const me = m.me;

  return (
    <>
      <PageHeader title={m.title} description={`${m.code} · ${t(`meet.type.${m.type}`, { defaultValue: m.type })}`}
        actions={<>
          <StatusBadge label={t(`meet.status.${m.status}`)} color={MEETING_COLOR[m.status]} />
          {m.confidential && <Badge color="red" variant="light" leftSection={<IconLock size={12} />}>{t('meet.confidential')}</Badge>}
          {me.can_schedule && <Button leftSection={<IconSend size={16} />} loading={schedule.isPending} onClick={() => schedule.mutate()}>{t('meet.schedule')}</Button>}
          {me.can_start && <Button leftSection={<IconPlayerPlay size={16} />} onClick={() => setConfirm('start')}>{t('meet.start')}</Button>}
          {me.can_hold && <Button variant="light" leftSection={<IconCheck size={16} />} onClick={() => setConfirm('hold')}>{t('meet.mark_held')}</Button>}
          <Menu position="bottom-end" withinPortal>
            <Menu.Target><ActionIcon variant="default" size="lg" aria-label={t('meet.more')}><IconDotsVertical size={18} /></ActionIcon></Menu.Target>
            <Menu.Dropdown>
              {me.can_edit && <Menu.Item leftSection={<IconEdit size={16} />} onClick={() => setEditing(true)}>{t('common.edit')}</Menu.Item>}
              <Menu.Item leftSection={<IconCalendarPlus size={16} />} onClick={() => { downloadBlob(`/meetings/${id}/ics`, `${m.code}.ics`).catch(toastError); }}>{t('meet.add_to_calendar')}</Menu.Item>
              {me.can_cancel && <Menu.Item color="red" leftSection={<IconX size={16} />} onClick={() => setCancelling(true)}>{t('meet.cancel_meeting')}</Menu.Item>}
            </Menu.Dropdown>
          </Menu>
        </>} />

      {m.status === 'cancelled' && <Alert color="red" variant="light" mb="md" title={t('meet.cancelled')}>{m.cancel_reason}</Alert>}

      {me.can_rsvp && (
        <Card withBorder mb="md" padding="sm">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs"><Text size="sm" fw={600}>{t('meet.your_answer')}</Text><Badge color={RSVP_COLOR[me.my_response ?? 'pending']} variant="light">{t(`meet.rsvp.${me.my_response ?? 'pending'}`)}</Badge></Group>
            <Group gap="xs">
              <Button size="compact-md" color="green" variant={me.my_response === 'accepted' ? 'filled' : 'light'} leftSection={<IconCheck size={14} />} loading={rsvp.isPending} onClick={() => rsvp.mutate({ response: 'accepted' })}>{t('meet.accept')}</Button>
              <Button size="compact-md" color="red" variant={me.my_response === 'declined' ? 'filled' : 'light'} leftSection={<IconX size={14} />} onClick={() => rsvp.mutate({ response: 'declined' })}>{t('meet.decline')}</Button>
              <Button size="compact-md" color="orange" variant={me.my_response === 'proposed' ? 'filled' : 'light'} onClick={() => setProposing(true)}>{t('meet.propose')}</Button>
            </Group>
          </Group>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
        <Card withBorder padding="md">
          <Stack gap={6}>
            <Info label={t('meet.when')}>{fmtRange(m.starts_at, m.ends_at, tz, lang)}</Info>
            <Info label={t('meet.where')}>{[m.room?.name, m.venue].filter(Boolean).join(' · ') || '—'}{m.online_url && <> · <a href={m.online_url} target="_blank" rel="noopener noreferrer">{t('meet.online_link')}</a></>}</Info>
            {m.rsvp_deadline && <Info label={t('meet.rsvp_deadline')}>{fmtDateTime(m.rsvp_deadline, tz, lang)}</Info>}
            {m.department && <Info label={t('meet.department')}>{m.department.name}</Info>}
            {m.project && <Info label={t('meet.project')}><Link to={`/projects/${m.project.id}`}>{m.project.code} {m.project.name}</Link></Info>}
            {m.series && <Info label={t('meet.series')}>{t(`meet.${m.series.frequency}`)} · {t('meet.series_count', { count: m.series.count })}</Info>}
          </Stack>
        </Card>
        <Card withBorder padding="md">
          <Stack gap={6}>
            <Info label={t('meet.organizer')}>{m.organizer?.name ?? '—'}</Info>
            <Info label={t('meet.chair')}>{m.chair?.name ?? '—'}</Info>
            <Info label={t('meet.secretary')}>{m.secretary?.name ?? '—'}</Info>
            {m.facilitator && <Info label={t('meet.facilitator')}>{m.facilitator.name}</Info>}
          </Stack>
        </Card>
      </SimpleGrid>
      {m.purpose && <Card withBorder padding="md" mb="md"><Text size="sm" fw={600} mb={4}>{t('meet.purpose')}</Text><SafeHtml html={m.purpose} /></Card>}

      <Tabs defaultValue="agenda" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="agenda">{t('meet.tab_agenda')} ({m.agenda.length})</Tabs.Tab>
          <Tabs.Tab value="people">{t('meet.tab_people')} ({m.invitations.length})</Tabs.Tab>
          {['in_progress', 'held', 'closed'].includes(m.status) && <Tabs.Tab value="attendance">{t('meet.tab_attendance')}</Tabs.Tab>}
          <Tabs.Tab value="papers">{t('meet.tab_papers')}</Tabs.Tab>
          <Tabs.Tab value="history">{t('meet.tab_history')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="agenda"><AgendaTab m={m} onChange={refresh} /></Tabs.Panel>
        <Tabs.Panel value="people"><PeopleTab m={m} onChange={refresh} /></Tabs.Panel>
        <Tabs.Panel value="attendance"><MeetingAttendanceTab meetingId={m.id} code={m.code} /></Tabs.Panel>
        <Tabs.Panel value="papers"><PapersPanel kind="meeting" id={m.id} canUpload={me.can_manage && ['draft', 'scheduled'].includes(m.status)} /></Tabs.Panel>
        <Tabs.Panel value="history"><HistoryTab m={m} /></Tabs.Panel>
      </Tabs>

      <MeetingFormModal opened={editing} onClose={() => setEditing(false)} meeting={m} onSaved={refresh} />
      <Modal opened={cancelling} onClose={() => setCancelling(false)} centered title={t('meet.cancel_meeting')}>
        <form onSubmit={cancelForm.onSubmit((v) => cancel.mutate(v))}><Stack gap="sm">
          <Alert color="red" variant="light">{t('meet.cancel_warning')}</Alert>
          <TextInput label={t('meet.cancel_reason')} required minLength={3} maxLength={1000} {...cancelForm.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCancelling(false)}>{t('common.back')}</Button><Button color="red" type="submit" loading={cancel.isPending} disabled={cancelForm.values.reason.trim().length < 3}>{t('meet.cancel_meeting')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={proposing} onClose={() => setProposing(false)} centered title={t('meet.propose')}>
        <form onSubmit={proposeForm.onSubmit((v) => rsvp.mutate({ response: 'proposed', note: v.note || undefined, proposed_starts_at: wallToUtc(v.when, tz) }))}><Stack gap="sm">
          <Text size="xs" c="dimmed">{t('meet.times_in_tz', { tz })}</Text>
          <TextInput type="datetime-local" label={t('meet.proposed_start')} required {...proposeForm.getInputProps('when')} />
          <TextInput label={t('meet.note')} maxLength={1000} {...proposeForm.getInputProps('note')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setProposing(false)}>{t('common.cancel')}</Button><Button type="submit" loading={rsvp.isPending} disabled={!proposeForm.values.when}>{t('meet.send_proposal')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={confirm === 'hold'} onClose={() => setConfirm(null)} onConfirm={() => hold.mutate()} loading={hold.isPending} title={t('meet.mark_held')} text={t('meet.hold_confirm')} />
      <ConfirmModal opened={confirm === 'start'} onClose={() => setConfirm(null)} onConfirm={() => start.mutate()} loading={start.isPending} title={t('meet.start')} text={t('meet.start_confirm')} />
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <Group gap="xs" align="baseline" wrap="nowrap"><Text size="xs" c="dimmed" w={110} style={{ flexShrink: 0 }}>{label}</Text><Text size="sm" component="div">{children}</Text></Group>;
}

// ---- agenda ---------------------------------------------------------------------------------------------------------------------------
const blankItem = { title: '', description: '', presenter_id: null as string | null, presenter_name: '', duration_minutes: '' as number | string, priority_id: null as string | null, expected_decision: '', is_confidential: false };

function AgendaTab({ m, onChange }: { m: Detail; onChange: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [removing, setRemoving] = useState<Item | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const priorities = useLookup('agenda_priority');
  const people = usePeople(!!editing);
  const form = useForm({ initialValues: blankItem });
  const draft = m.agenda_status === 'draft';
  const canEdit = m.me.can_manage && ['draft', 'scheduled'].includes(m.status) && draft;
  const total = m.agenda.reduce((s, i) => s + (i.duration_minutes ?? 0), 0);

  const openItem = (i: Item | 'new') => {
    setEditing(i); form.clearErrors();
    if (i === 'new') { form.setValues({ ...blankItem, priority_id: priorities.items.find((p) => p.code === 'normal')?.id ?? null }); return; }
    if (i.presenter) people.remember([{ id: i.presenter.id, name: i.presenter.name, email: '' }]);
    form.setValues({ title: i.title, description: i.description ?? '', presenter_id: i.presenter?.id ?? null, presenter_name: i.presenter_name ?? '', duration_minutes: i.duration_minutes ?? '',
      priority_id: priorities.items.find((p) => p.code === i.priority)?.id ?? null, expected_decision: i.expected_decision ?? '', is_confidential: i.is_confidential });
  };
  const save = useMutation({
    mutationFn: async (v: typeof blankItem) => {
      const body = { ...v, description: v.description || null, presenter_name: v.presenter_name || null, expected_decision: v.expected_decision || null, duration_minutes: v.duration_minutes === '' ? null : Number(v.duration_minutes), priority_id: v.priority_id ?? undefined };
      return editing === 'new' ? api.post(`/meetings/${m.id}/agenda-items`, body) : api.patch(`/agenda-items/${(editing as Item).id}`, body);
    },
    onSuccess: () => { toastOk(); setEditing(null); onChange(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (i: Item) => api.delete(`/agenda-items/${i.id}`), onSuccess: () => { toastOk(); setRemoving(null); onChange(); }, onError: (e) => { setRemoving(null); toastError(e); } });
  const move = useMutation({ mutationFn: async (order: string[]) => api.post(`/meetings/${m.id}/agenda/reorder`, { order }), onSuccess: onChange, onError: toastError });
  const circulate = useMutation({ mutationFn: async () => api.post(`/meetings/${m.id}/agenda/circulate`), onSuccess: () => { toastOk(t('meet.agenda_circulated')); onChange(); }, onError: toastError });
  const approve = useMutation({ mutationFn: async () => api.post(`/meetings/${m.id}/agenda/approve`), onSuccess: () => { toastOk(t('meet.agenda_approved')); onChange(); }, onError: toastError });
  const swap = (idx: number, d: number) => { const ids = m.agenda.map((i) => i.id); [ids[idx], ids[idx + d]] = [ids[idx + d], ids[idx]]; move.mutate(ids); };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs"><Badge variant="light" color={m.agenda_status === 'approved' ? 'green' : m.agenda_status === 'circulated' ? 'blue' : 'gray'}>{t(`meet.agenda.${m.agenda_status}`)}</Badge>{total > 0 && <Text size="xs" c="dimmed">{t('meet.total_minutes', { count: total })}</Text>}</Group>
        <Group gap="xs">
          {canEdit && <Button size="compact-md" variant="light" leftSection={<IconPlus size={14} />} onClick={() => openItem('new')}>{t('meet.add_item')}</Button>}
          {m.me.can_manage && draft && m.agenda.length > 0 && m.status !== 'cancelled' && <Button size="compact-md" leftSection={<IconSend size={14} />} loading={circulate.isPending} onClick={() => circulate.mutate()}>{t('meet.circulate')}</Button>}
          {m.me.can_chair && m.agenda_status === 'circulated' && <Button size="compact-md" color="green" leftSection={<IconCheck size={14} />} loading={approve.isPending} onClick={() => approve.mutate()}>{t('meet.approve_agenda')}</Button>}
        </Group>
      </Group>
      {m.agenda.length === 0 && <Text size="sm" c="dimmed">{t('meet.no_agenda')}</Text>}
      {m.agenda.map((i, idx) => (
        <Card key={i.id} withBorder padding="sm">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <Badge circle variant="light">{idx + 1}</Badge>
              <div>
                <Group gap={6}>{i.is_confidential && <IconLock size={14} />}<Text size="sm" fw={600}>{i.title}</Text>{i.priority && i.priority !== 'normal' && <Badge size="xs" color={PRIORITY_COLOR[i.priority]} variant="light">{t(`meet.priority.${i.priority}`)}</Badge>}</Group>
                <Text size="xs" c="dimmed">{[i.presenter?.name ?? i.presenter_name, i.duration_minutes ? `${i.duration_minutes} min` : null].filter(Boolean).join(' · ')}</Text>
              </div>
            </Group>
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" aria-label={t('meet.papers')} title={t('meet.papers')} onClick={() => setOpen(open === i.id ? null : i.id)}>{open === i.id ? <IconChevronDown size={18} /> : <IconPaperclip size={18} />}</ActionIcon>
              {canEdit && <>
                <ActionIcon variant="subtle" disabled={idx === 0} aria-label={t('meet.move_up')} onClick={() => swap(idx, -1)}><IconArrowUp size={16} /></ActionIcon>
                <ActionIcon variant="subtle" disabled={idx === m.agenda.length - 1} aria-label={t('meet.move_down')} onClick={() => swap(idx, 1)}><IconArrowDown size={16} /></ActionIcon>
                <ActionIcon variant="subtle" aria-label={t('common.edit')} onClick={() => openItem(i)}><IconEdit size={16} /></ActionIcon>
                <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => setRemoving(i)}><IconTrash size={16} /></ActionIcon>
              </>}
            </Group>
          </Group>
          {(i.description || i.expected_decision) && <Stack gap={4} mt="xs" ml={36}>{i.description && <SafeHtml html={i.description} />}{i.expected_decision && <Text size="xs"><b>{t('meet.expected_decision')}:</b> {i.expected_decision}</Text>}</Stack>}
          <Collapse expanded={open === i.id}><div style={{ marginLeft: 36, marginTop: 8 }}>{open === i.id && <PapersPanel kind="agenda-item" id={i.id} canUpload={m.me.can_manage && ['draft', 'scheduled'].includes(m.status)} />}</div></Collapse>
        </Card>
      ))}

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('meet.add_item') : t('meet.edit_item')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <TextInput label={t('meet.item_title')} required maxLength={200} {...form.getInputProps('title')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PersonSelect label={t('meet.presenter')} people={people} value={form.values.presenter_id} onChange={(x) => form.setFieldValue('presenter_id', x)} error={form.errors.presenter_id as string | undefined} />
            <TextInput label={t('meet.presenter_external')} maxLength={150} {...form.getInputProps('presenter_name')} />
            <NumberInput label={t('meet.duration')} min={1} max={1440} suffix=" min" {...form.getInputProps('duration_minutes')} />
            <Select label={t('meet.priority_label')} allowDeselect={false} data={priorities.options.map((o) => ({ ...o, label: priorities.items.find((p) => p.id === o.value) ? t(`meet.priority.${priorities.items.find((p) => p.id === o.value)!.code}`) : o.label }))} {...form.getInputProps('priority_id')} />
          </SimpleGrid>
          <RichTextField label={t('meet.item_description')} minHeight={80} {...form.getInputProps('description')} />
          <TextInput label={t('meet.expected_decision')} maxLength={5000} {...form.getInputProps('expected_decision')} />
          <Switch label={t('meet.item_confidential')} description={t('meet.item_confidential_hint')} {...form.getInputProps('is_confidential', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending} disabled={!form.values.title.trim()}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing)} loading={remove.isPending} text={t('meet.delete_item_text', { title: removing?.title })} />
    </Stack>
  );
}

// ---- people ---------------------------------------------------------------------------------------------------------------------------
function PeopleTab({ m, onChange }: { m: Detail; onChange: () => void }) {
  const { t, i18n } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Invitation | null>(null);
  const people = usePeople(adding);
  const depts = useQuery({ queryKey: ['dept-options'], enabled: adding, queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data, retry: false });
  const form = useForm({ initialValues: { user_ids: [] as string[], department_ids: [] as string[], guest_name: '', guest_email: '' } });
  const canEdit = m.me.can_edit;
  const counts = m.invitations.reduce<Record<string, number>>((a, i) => ({ ...a, [i.response]: (a[i.response] ?? 0) + 1 }), {});

  const add = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post<{ data: { added: number; warnings: { name: string | null }[] } }>(`/meetings/${m.id}/invitations`, {
      user_ids: v.user_ids, department_ids: v.department_ids, guests: v.guest_email ? [{ name: v.guest_name || v.guest_email, email: v.guest_email }] : [] })).data.data,
    onSuccess: (r) => { toastOk(t('meet.invited_count', { count: r.added })); setAdding(false); form.reset(); onChange(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (i: Invitation) => api.delete(`/meeting-invitations/${i.id}`), onSuccess: () => { toastOk(); setRemoving(null); onChange(); }, onError: (e) => { setRemoving(null); toastError(e); } });

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">{['accepted', 'declined', 'proposed', 'pending'].map((c) => <Badge key={c} variant="light" color={RSVP_COLOR[c]}>{t(`meet.rsvp.${c}`)}: {counts[c] ?? 0}</Badge>)}</Group>
        {canEdit && <Button size="compact-md" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>{t('meet.invite_more')}</Button>}
      </Group>
      <Table verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('meet.department')}</Table.Th><Table.Th>{t('meet.my_answer')}</Table.Th><Table.Th visibleFrom="md">{t('meet.note')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {m.invitations.map((i) => (
            <Table.Tr key={i.id}>
              <Table.Td><Group gap={6}><Text size="sm" fw={500}>{i.name}</Text>{i.is_guest && <Badge size="xs" variant="outline">{t('meet.guest')}</Badge>}</Group>{i.email && <Text size="xs" c="dimmed">{i.email}</Text>}</Table.Td>
              <Table.Td visibleFrom="sm">{i.department ?? '—'}</Table.Td>
              <Table.Td><Badge variant="light" color={RSVP_COLOR[i.response]}>{t(`meet.rsvp.${i.response}`)}</Badge></Table.Td>
              <Table.Td visibleFrom="md"><Text size="xs" c="dimmed" lineClamp={2}>{i.note}{i.proposed_starts_at && ` · ${fmtDateTime(i.proposed_starts_at, m.timezone, i18n.language)}`}</Text></Table.Td>
              <Table.Td>{canEdit && <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => setRemoving(i)}><IconTrash size={16} /></ActionIcon>}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={adding} onClose={() => setAdding(false)} title={t('meet.invite_more')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => add.mutate(v))}><Stack gap="sm">
          <PeopleMultiSelect label={t('meet.people')} people={people} value={form.values.user_ids} onChange={(x) => form.setFieldValue('user_ids', x)} />
          <PeopleDepartments depts={depts.data ?? []} value={form.values.department_ids} onChange={(x) => form.setFieldValue('department_ids', x)} />
          <Text size="sm" fw={500}>{t('meet.guests')}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput placeholder={t('common.name')} {...form.getInputProps('guest_name')} /><TextInput type="email" placeholder="email@example.org" {...form.getInputProps('guest_email')} /></SimpleGrid>
          <Group justify="flex-end"><Button variant="default" onClick={() => setAdding(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={add.isPending} disabled={!form.values.user_ids.length && !form.values.department_ids.length && !form.values.guest_email}>{t('meet.invite')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!removing} onClose={() => setRemoving(null)} onConfirm={() => removing && remove.mutate(removing)} loading={remove.isPending} text={t('meet.remove_invitee_text', { name: removing?.name })} />
    </Stack>
  );
}

function PeopleDepartments({ depts, value, onChange }: { depts: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  if (depts.length === 0) return null;
  return <PeopleMultiSelect
  label={t('meet.whole_departments')}
  people={{
    setSearch: () => undefined,
    options: () => depts.map((d) => ({ value: d.id, label: d.name })),
    remember: () => undefined,
    timezone: 'UTC',
    loading: false,
  }}
  value={value}
  onChange={onChange}
/>;
}

// ---- history --------------------------------------------------------------------------------------------------------------------------
function HistoryTab({ m }: { m: Detail }) {
  const { t, i18n } = useTranslation();
  return (
    <Stack gap="md">
      <Timeline bulletSize={14} lineWidth={2} active={m.history.length}>
        {m.history.map((h, i) => (
          <Timeline.Item key={i} title={t(`meet.status.${h.status}`)}>
            <Text size="xs" c="dimmed">{fmtDateTime(h.at, m.timezone, i18n.language)}{h.by ? ` · ${h.by}` : ''}</Text>
            {h.note && <Text size="xs">{h.note}</Text>}
          </Timeline.Item>
        ))}
      </Timeline>
      {m.schedule_history.length > 0 && (
        <div>
          <Text size="sm" fw={600} mb={4}>{t('meet.schedule_changes')}</Text>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('meet.was')}</Table.Th><Table.Th visibleFrom="sm">{t('meet.where')}</Table.Th><Table.Th>{t('meet.changed')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{m.schedule_history.map((h, i) => (
              <Table.Tr key={i}><Table.Td><Text size="xs">{fmtRange(h.starts_at, h.ends_at, m.timezone, i18n.language)}</Text></Table.Td><Table.Td visibleFrom="sm"><Text size="xs">{h.room ?? h.venue ?? '—'}</Text></Table.Td>
                <Table.Td><Text size="xs">{fmtDateTime(h.at, m.timezone, i18n.language)}{h.by ? ` · ${h.by}` : ''}</Text>{h.reason && <Text size="xs" c="dimmed">{h.reason}</Text>}</Table.Td></Table.Tr>))}</Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
}
