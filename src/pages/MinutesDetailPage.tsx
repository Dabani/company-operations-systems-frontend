import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, MultiSelect, Select, Stack, Text, TextInput, Timeline } from '@mantine/core';
import { IconCheck, IconDownload, IconSend, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, downloadBlob, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { usePeople } from '@/components/PeoplePicker';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { NotFoundPage } from '@/pages/ErrorPages';
import { MINUTES_COLOR, publishReady, recipientKind } from '@/lib/minutes';
import { toastError, toastOk } from '@/lib/ui';

interface Comment { id: string; user: string | null; mine: boolean; body: string; anchor_text: string | null; created_at: string; resolved: boolean }
interface Detail {
  id: string; version_no: number; status: string; visibility: string | null; correction_reason: string | null; approved_at: string | null; published_at: string | null; has_pdf: boolean;
  timezone: string; body: string; revision: number; approved_by: string | null; published_by: string | null; approval_request_id: string | null;
  meeting: { id: string; code: string; title: string; status: string; confidential: boolean; starts_at: string; can_open: boolean };
  reviewers: { id: string; name: string | null }[]; recipients: { user_id: string | null; department_id: string | null; name: string | null }[]; comments: Comment[];
  history: { status: string; note: string | null; by: string | null; at: string }[]; allowed_visibilities: string[];
  me: { is_writer: boolean; is_chair: boolean; can_edit: boolean; can_submit: boolean; can_publish: boolean; can_comment: boolean; can_review: boolean };
}

export function MinutesDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['minutes', id], retry: false, queryFn: async () => (await api.get<{ data: Detail }>(`/minutes/${id}`)).data.data });
  if (q.isError) return <NotFoundPage />;
  if (!q.data) return null;
  return <View key={`${q.data.id}:${q.data.status}`} d={q.data} />;
}

function View({ d }: { d: Detail }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const key = ['minutes', d.id];
  const [body, setBody] = useState(d.body);
  const [rev, setRev] = useState(d.revision);
  const [saved, setSaved] = useState(d.body);
  const [conflict, setConflict] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: d.timezone }).format(new Date(iso)) : '—');
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['meeting-minutes', d.meeting.id] }); void qc.invalidateQueries({ queryKey: ['minutes-library'] }); };
  const dirty = body !== saved;

  const save = useMutation({
    mutationFn: async () => (await api.patch<{ data: Detail }>(`/minutes/${d.id}`, { minutes_body: body, revision: rev })).data.data,
    onSuccess: (r) => { setRev(r.revision); setSaved(body); setConflict(false); toastOk(); },
    onError: (e) => { const info = parseError(e); if (info.fields.revision) setConflict(true); toastError(e); },
  });
  const submit = useMutation({
    mutationFn: async () => { if (dirty) await save.mutateAsync(); return api.post(`/minutes/${d.id}/submit`); },
    onSuccess: () => { toastOk(t('min.submitted')); setConfirmSubmit(false); refresh(); }, onError: (e) => { setConfirmSubmit(false); toastError(e); },
  });

  return (
    <Stack gap="md">
      <PageHeader title={`${d.meeting.title} · ${t('min.version_n', { n: d.version_no })}`} description={`${d.meeting.code} · ${fmt(d.meeting.starts_at)}`}
        actions={<>
          <StatusBadge label={t(`min.status.${d.status}`)} color={MINUTES_COLOR[d.status]} />
          {d.has_pdf && <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => { downloadBlob(`/minutes/${d.id}/pdf`, `minutes-${d.meeting.code}-v${d.version_no}.pdf`).catch(toastError); }}>{t('min.pdf')}</Button>}
          {d.meeting.can_open && <Button component={Link} to={`/meetings/${d.meeting.id}`} variant="default">{t('min.open_meeting')}</Button>}
        </>} />

      {d.correction_reason && <Alert color="orange" variant="light" title={t('min.correction')}>{d.correction_reason}</Alert>}
      {d.status === 'pending_approval' && <Alert color="orange" variant="light">{d.me.is_chair ? t('min.awaiting_you') : t('min.awaiting_chair')}</Alert>}
      {d.status === 'approved' && <Alert color="blue" variant="light">{t('min.approved_by', { name: d.approved_by ?? '—', date: fmt(d.approved_at) })}{d.me.can_publish ? ` ${t('min.ready_to_publish')}` : ''}</Alert>}
      {(d.status === 'published' || d.status === 'superseded') && <Alert color={d.status === 'published' ? 'green' : 'gray'} variant="light">
        {t('min.published_by', { name: d.published_by ?? '—', date: fmt(d.published_at) })}{d.visibility ? ` · ${t(`min.vis.${d.visibility}`)}` : ''}
        {d.recipients.length > 0 && <Text size="xs" mt={4}>{d.recipients.map((r) => r.name).filter(Boolean).join(', ')}</Text>}
      </Alert>}
      {conflict && <Alert color="red" variant="filled">{t('min.conflict')} <Button size="compact-xs" variant="white" ml="xs" onClick={refresh}>{t('min.reload')}</Button></Alert>}

      <Card withBorder padding="md">
        {d.me.can_edit
          ? <RichTextField value={body} onChange={setBody} minHeight={380} />
          : <SafeHtml html={d.body} />}
        {d.me.can_edit && (
          <Group justify="space-between" mt="sm">
            <Text size="xs" c="dimmed">{dirty ? t('min.unsaved') : t('min.all_saved')}</Text>
            <Group>
              <Button variant="default" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
              {d.me.can_submit && <Button leftSection={<IconSend size={16} />} onClick={() => setConfirmSubmit(true)}>{t('min.submit')}</Button>}
            </Group>
          </Group>)}
        {d.me.can_publish && <Group justify="flex-end" mt="sm"><Button color="green" leftSection={<IconCheck size={16} />} onClick={() => setPublishing(true)}>{t('min.publish')}</Button></Group>}
      </Card>

      {(d.me.is_writer || d.me.is_chair || d.reviewers.length > 0) && <Reviewers d={d} onChange={refresh} />}
      {(d.comments.length > 0 || d.me.can_comment) && <Comments d={d} onChange={refresh} />}

      {d.history.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={600} mb="xs">{t('min.history')}</Text>
          <Timeline active={d.history.length} bulletSize={14} lineWidth={2}>
            {d.history.map((h, i) => <Timeline.Item key={i} title={t(`min.status.${h.status}`)}><Text size="xs" c="dimmed">{h.by ?? '—'} · {fmt(h.at)}</Text>{h.note && <Text size="xs">{h.note}</Text>}</Timeline.Item>)}
          </Timeline>
        </Card>)}

      <ConfirmModal opened={confirmSubmit} onClose={() => setConfirmSubmit(false)} onConfirm={() => submit.mutate()} loading={submit.isPending} title={t('min.submit')} text={t('min.submit_text')} confirmLabel={t('common.confirm')} confirmColor="blue" />
      {publishing && <PublishModal d={d} onClose={() => setPublishing(false)} onDone={() => { setPublishing(false); refresh(); }} />}
    </Stack>
  );
}

function Reviewers({ d, onChange }: { d: Detail; onChange: () => void }) {
  const { t } = useTranslation();
  const people = usePeople(d.me.can_review);
  const [ids, setIds] = useState<string[]>(d.reviewers.map((r) => r.id));
  const save = useMutation({ mutationFn: async () => api.put(`/minutes/${d.id}/reviewers`, { user_ids: ids }), onSuccess: () => { toastOk(); onChange(); }, onError: toastError });
  return (
    <Card withBorder padding="md">
      <Group gap="xs" mb="xs"><IconUsers size={16} /><Text fw={600}>{t('min.reviewers')}</Text></Group>
      {d.me.can_review ? (
        <Group align="flex-end" wrap="nowrap">
          <MultiSelect style={{ flex: 1 }} searchable data={people.options([...ids, ...d.reviewers.map((r) => r.id)])} value={ids} onChange={setIds} onSearchChange={people.setSearch} placeholder={t('min.reviewers_ph')} nothingFoundMessage="—" filter={({ options }) => options} />
          <Button variant="light" loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        </Group>)
        : <Group gap="xs">{d.reviewers.length === 0 ? <Text size="sm" c="dimmed">—</Text> : d.reviewers.map((r) => <Badge key={r.id} variant="light" color="gray">{r.name}</Badge>)}</Group>}
    </Card>
  );
}

function Comments({ d, onChange }: { d: Detail; onChange: () => void }) {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const add = useMutation({ mutationFn: async () => api.post(`/minutes/${d.id}/comments`, { body: text }), onSuccess: () => { setText(''); onChange(); }, onError: toastError });
  const resolve = useMutation({ mutationFn: async (id: string) => api.post(`/minute-comments/${id}/resolve`), onSuccess: onChange, onError: toastError });
  const fmt = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short', timeZone: d.timezone }).format(new Date(iso));
  return (
    <Card withBorder padding="md">
      <Text fw={600} mb="xs">{t('min.comments')}</Text>
      <Stack gap="xs">
        {d.comments.length === 0 && <Text size="sm" c="dimmed">{t('min.no_comments')}</Text>}
        {d.comments.map((c) => (
          <Group key={c.id} justify="space-between" wrap="nowrap" align="flex-start" opacity={c.resolved ? 0.55 : 1}>
            <div><Text size="sm">{c.body}</Text><Text size="xs" c="dimmed">{c.user ?? '—'} · {fmt(c.created_at)}</Text></div>
            {!c.resolved && (d.me.is_writer || c.mine) && d.me.can_comment && <ActionIcon variant="subtle" color="green" aria-label={t('min.resolve')} title={t('min.resolve')} onClick={() => resolve.mutate(c.id)}><IconCheck size={16} /></ActionIcon>}
            {c.resolved && <Badge variant="light" color="green">{t('min.resolved')}</Badge>}
          </Group>))}
        {d.me.can_comment && (
          <Group align="flex-end" wrap="nowrap">
            <TextInput style={{ flex: 1 }} value={text} maxLength={3000} onChange={(e) => setText(e.currentTarget.value)} placeholder={t('min.comment_ph')} />
            <Button variant="light" disabled={!text.trim()} loading={add.isPending} onClick={() => add.mutate()}>{t('min.comment')}</Button>
          </Group>)}
      </Stack>
    </Card>
  );
}

function PublishModal({ d, onClose, onDone }: { d: Detail; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [vis, setVis] = useState<string | null>(null);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const people = usePeople(true);
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/departments', { params: { per_page: 100 } })).data.data });
  const kind = vis ? recipientKind(vis) : null;
  const go = useMutation({
    mutationFn: async () => api.post(`/minutes/${d.id}/publish`, { visibility: vis, department_ids: kind === 'department' ? deptIds : [], user_ids: kind === 'user' ? userIds : [] }),
    onSuccess: () => { toastOk(t('min.published_ok')); onDone(); }, onError: toastError,
  });
  return (
    <Modal opened onClose={onClose} title={t('min.publish')} centered>
      <Stack>
        {d.meeting.confidential && <Alert color="orange" variant="light">{t('min.confidential_note')}</Alert>}
        <Select label={t('min.visibility')} required value={vis} onChange={setVis} data={d.allowed_visibilities.map((v) => ({ value: v, label: t(`min.vis.${v}`) }))} />
        {kind === 'department' && <MultiSelect label={t('min.departments')} searchable data={(depts.data ?? []).map((x) => ({ value: x.id, label: x.name }))} value={deptIds} onChange={setDeptIds} />}
        {kind === 'user' && <MultiSelect label={t('min.people')} searchable data={people.options(userIds)} value={userIds} onChange={setUserIds} onSearchChange={people.setSearch} />}
        <Text size="xs" c="dimmed">{t('min.publish_help')}</Text>
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button color="green" disabled={!publishReady(vis, d.allowed_visibilities, deptIds, userIds)} loading={go.isPending} onClick={() => go.mutate()}>{t('min.publish')}</Button></Group>
      </Stack>
    </Modal>
  );
}
