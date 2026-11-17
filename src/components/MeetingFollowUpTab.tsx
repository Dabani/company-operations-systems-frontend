import { ActionIcon, Alert, Badge, Button, Card, Collapse, Group, Menu, Modal, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconChecklist, IconDots, IconDownload, IconPaperclip, IconPlus, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, downloadFile, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { PersonSelect, usePeople } from '@/components/PeoplePicker';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadModal } from '@/components/UploadModal';
import { FU_COLOR, fmtDue, moveNoteOk } from '@/lib/followups';
import { formatBytes } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import type { FileRow } from '@/types';

export interface FuItem {
  kind: 'resolution' | 'action'; id: string; code: string; title: string; status: string; due_on: string | null; overdue: boolean; days_overdue: number;
  body?: string | null; description?: string | null; responsible?: { id: string; name: string } | null; owner?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null; resolution?: { id: string; code: string; title: string } | null; completion_note?: string | null;
  task?: { id: string; project_id: string; project: string | null; number: number; status: string | null } | null; obligation?: { id: string; code: string } | null;
  meeting: { id: string; code: string; title: string };
  me: { can_edit: boolean; can_delete: boolean; moves: string[]; can_convert?: boolean; can_attach: boolean };
}
interface Resp { data: { resolutions: FuItem[]; actions: FuItem[] }; meta: { can_record: boolean; is_runner: boolean; can_convert_obligation: boolean; frequencies: string[] } }

/** Resolutions and action items of one meeting (Guide 6.7). */
export function MeetingFollowUpTab({ meetingId }: { meetingId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['meeting-followups', meetingId];
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<Resp>(`/meetings/${meetingId}/followups`)).data });
  const [form, setForm] = useState<{ kind: 'resolution' | 'action'; item: FuItem | null } | null>(null);
  const [move, setMove] = useState<{ item: FuItem; to: string } | null>(null);
  const [convert, setConvert] = useState<FuItem | null>(null);
  const [remove, setRemove] = useState<FuItem | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['followups'] }); void qc.invalidateQueries({ queryKey: ['followup-summary'] }); };
  const del = useMutation({ mutationFn: async (i: FuItem) => api.delete(`/meeting-${i.kind === 'resolution' ? 'resolutions' : 'actions'}/${i.id}`), onSuccess: () => { setRemove(null); refresh(); }, onError: (e) => { setRemove(null); toastError(e); } });
  if (!q.data) return null;
  const { data, meta } = q.data;
  const section = (kind: 'resolution' | 'action', items: FuItem[]) => (
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={5}>{t(kind === 'resolution' ? 'fu.resolutions' : 'fu.actions')} ({items.length})</Title>
        {meta.can_record && <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setForm({ kind, item: null })}>{t(kind === 'resolution' ? 'fu.add_resolution' : 'fu.add_action')}</Button>}
      </Group>
      {items.length === 0 && <Text size="sm" c="dimmed">{t(kind === 'resolution' ? 'fu.none_resolutions' : 'fu.none_actions')}</Text>}
      {items.map((i) => <ItemCard key={i.id} item={i} meta={meta} onEdit={() => setForm({ kind, item: i })} onMove={(to) => setMove({ item: i, to })} onConvert={() => setConvert(i)} onDelete={() => setRemove(i)} />)}
    </Stack>
  );
  return (
    <Stack gap="lg">
      {!meta.can_record && data.resolutions.length + data.actions.length === 0 && <Alert variant="light" color="gray" icon={<IconChecklist size={16} />}>{t('fu.empty_help')}</Alert>}
      {section('resolution', data.resolutions)}
      {section('action', data.actions)}
      {form && <ItemFormModal meetingId={meetingId} kind={form.kind} item={form.item} resolutions={data.resolutions} onClose={() => setForm(null)} onDone={() => { setForm(null); refresh(); }} />}
      {move && <MoveModal item={move.item} to={move.to} onClose={() => setMove(null)} onDone={() => { setMove(null); refresh(); }} />}
      {convert && <ConvertModal item={convert} meta={meta} onClose={() => setConvert(null)} onDone={() => { setConvert(null); refresh(); }} />}
      <ConfirmModal opened={!!remove} onClose={() => setRemove(null)} onConfirm={() => remove && del.mutate(remove)} loading={del.isPending} title={t('common.delete')} text={t('fu.delete_text')} />
    </Stack>
  );
}

function ItemCard({ item: i, meta, onEdit, onMove, onConvert, onDelete }: { item: FuItem; meta: Resp['meta']; onEdit: () => void; onMove: (to: string) => void; onConvert: () => void; onDelete: () => void }) {
  const { t, i18n } = useTranslation();
  const [files, setFiles] = useState(false);
  const who = i.kind === 'resolution' ? (i.responsible?.name ?? i.department?.name) : i.owner?.name;
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Group gap="xs"><Text size="xs" c="dimmed">{i.code}</Text><StatusBadge label={t(`fu.status.${i.status}`)} color={FU_COLOR[i.status]} />{i.overdue && <Badge color="red" variant="filled">{t('fu.overdue_days', { n: i.days_overdue })}</Badge>}</Group>
          <Text fw={600}>{i.title}</Text>
          <Text size="xs" c="dimmed">{t('fu.due')}: {fmtDue(i.due_on, i18n.language)} · {t(i.kind === 'resolution' ? 'fu.responsible' : 'fu.owner')}: {who ?? '—'}{i.resolution ? ` · ${i.resolution.code}` : ''}</Text>
        </div>
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" aria-label={t('fu.files')} title={t('fu.files')} onClick={() => setFiles((x) => !x)}><IconPaperclip size={18} /></ActionIcon>
          {(i.me.can_edit || i.me.can_delete || i.me.can_convert) && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target><ActionIcon variant="subtle" aria-label={t('common.actions')}><IconDots size={18} /></ActionIcon></Menu.Target>
              <Menu.Dropdown>
                {i.me.can_edit && <Menu.Item onClick={onEdit}>{t('common.edit')}</Menu.Item>}
                {i.me.can_convert && <Menu.Item onClick={onConvert}>{t('fu.convert')}</Menu.Item>}
                {i.me.can_delete && <Menu.Item color="red" onClick={onDelete}>{t('common.delete')}</Menu.Item>}
              </Menu.Dropdown>
            </Menu>)}
        </Group>
      </Group>
      {(i.body || i.description) && <SafeHtml html={(i.body ?? i.description) as string} />}
      {i.completion_note && <Text size="sm" mt={4}><b>{t('fu.result')}:</b> {i.completion_note}</Text>}
      {(i.task || i.obligation) && (
        <Group gap="xs" mt={4}>
          {i.task && <Badge component={Link} to={`/projects/${i.task.project_id}`} variant="light" style={{ cursor: 'pointer' }}>{t('fu.task_link', { code: `${i.task.project}-${i.task.number}` })}{i.task.status ? ` · ${i.task.status}` : ''}</Badge>}
          {i.obligation && <Badge component={Link} to="/compliance/calendar" variant="light" color="grape" style={{ cursor: 'pointer' }}>{i.obligation.code}</Badge>}
        </Group>)}
      {i.me.moves.length > 0 && <Group gap="xs" mt="xs">{i.me.moves.map((to) => <Button key={to} size="compact-xs" variant={to === 'cancelled' ? 'subtle' : 'light'} color={to === 'cancelled' ? 'red' : undefined} onClick={() => onMove(to)}>{t(`fu.to.${to}`)}</Button>)}</Group>}
      <Collapse expanded={files}><FilesPanel kind={i.kind} id={i.id} canUpload={i.me.can_attach} /></Collapse>
    </Card>
  );
}

function FilesPanel({ kind, id, canUpload }: { kind: string; id: string; canUpload: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ['followup-files', kind, id];
  const files = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/meeting-followup-files/${kind}/${id}`)).data.data });
  const rows = files.data ?? [];
  return (
    <Stack gap="xs" mt="xs">
      {rows.length === 0 && <Text size="sm" c="dimmed">{t('fu.no_files')}</Text>}
      {rows.map((f) => (
        <Group key={f.id} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap"><FileTypeIcon ext={f.extension} size={26} /><div><Text size="sm">{f.name}</Text><Text size="xs" c="dimmed">{formatBytes(f.size_bytes)}</Text></div></Group>
          <ActionIcon variant="subtle" aria-label={t('meet.download')} onClick={() => { downloadFile(f.id, f.name).catch(toastError); }}><IconDownload size={16} /></ActionIcon>
        </Group>))}
      {canUpload && <Group><Button size="compact-sm" variant="light" leftSection={<IconUpload size={14} />} onClick={() => setOpen(true)}>{t('fu.add_file')}</Button></Group>}
      <UploadModal opened={open} onClose={() => setOpen(false)} onDone={() => { void qc.invalidateQueries({ queryKey: key }); }} endpoint={`/meeting-followup-files/${kind}/${id}`} allowRestricted={false} />
    </Stack>
  );
}

function ItemFormModal({ meetingId, kind, item, resolutions, onClose, onDone }: { meetingId: string; kind: 'resolution' | 'action'; item: FuItem | null; resolutions: FuItem[]; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const people = usePeople(true);
  const res = kind === 'resolution';
  const form = useForm({
    initialValues: { title: item?.title ?? '', text: (res ? item?.body : item?.description) ?? '', due_on: item?.due_on ?? '', person: (res ? item?.responsible?.id : item?.owner?.id) ?? (null as string | null), resolution_id: item?.resolution?.id ?? (null as string | null) },
    validate: { title: (v) => (v.trim() ? null : t('fu.required')) },
  });
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => {
      const body: Record<string, unknown> = { title: v.title, due_on: v.due_on || null };
      if (res) { body.body = v.text || null; body.responsible_user_id = v.person; } else { body.description = v.text || null; body.owner_id = v.person; body.resolution_id = v.resolution_id; }
      const base = res ? 'resolutions' : 'actions';
      return item ? api.patch(`/meeting-${base}/${item.id}`, body) : api.post(`/meetings/${meetingId}/${base}`, body);
    },
    onSuccess: () => { toastOk(); onDone(); }, onError: (e) => { form.setErrors(mapErr(parseError(e).fields)); toastError(e); },
  });
  return (
    <Modal opened onClose={onClose} title={t(res ? (item ? 'fu.edit_resolution' : 'fu.add_resolution') : (item ? 'fu.edit_action' : 'fu.add_action'))} size="lg" centered>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <TextInput label={t('fu.title')} required maxLength={255} {...form.getInputProps('title')} />
          <RichTextField label={t(res ? 'fu.text' : 'fu.details')} minHeight={120} value={form.values.text} onChange={(v) => form.setFieldValue('text', v)} />
          <Group grow align="flex-start">
            <TextInput type="date" label={t('fu.due')} {...form.getInputProps('due_on')} />
            <PersonSelect label={t(res ? 'fu.responsible' : 'fu.owner')} people={people} value={form.values.person} onChange={(x) => form.setFieldValue('person', x)} error={form.errors.person as string | undefined} description={t('fu.participants_only')} />
          </Group>
          {!res && resolutions.length > 0 && <Select label={t('fu.from_resolution')} clearable value={form.values.resolution_id} onChange={(v) => form.setFieldValue('resolution_id', v)} data={resolutions.map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` }))} />}
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** The server names the fields responsible_user_id / owner_id; the form calls both "person". */
function mapErr(f: Record<string, string>): Record<string, string> {
  const o = { ...f };
  if (o.responsible_user_id) o.person = o.responsible_user_id;
  if (o.owner_id) o.person = o.owner_id;
  return o;
}

function MoveModal({ item, to, onClose, onDone }: { item: FuItem; to: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = useMutation({
    mutationFn: async () => api.post(`/meeting-${item.kind === 'resolution' ? 'resolutions' : 'actions'}/${item.id}/status`, { to, note: note.trim() || null }),
    onSuccess: () => { toastOk(); onDone(); }, onError: (e) => { const f = parseError(e).fields; setErr(f.note ?? f.status ?? null); if (!f.note && !f.status) toastError(e); },
  });
  const hint = to === 'done' ? t('fu.done_help') : t('fu.reason_help');
  return (
    <Modal opened onClose={onClose} title={`${item.code} · ${t(`fu.to.${to}`)}`} centered>
      <Stack>
        <Text size="sm" c="dimmed">{hint}</Text>
        <Textarea label={to === 'done' ? t('fu.result') : t('fu.reason')} autosize minRows={3} maxLength={2000} value={note} onChange={(e) => { setNote(e.currentTarget.value); setErr(null); }} error={err} />
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={go.isPending} disabled={!moveNoteOk(item.kind, item.status, to, note)} color={to === 'cancelled' ? 'red' : undefined} onClick={() => go.mutate()}>{t('common.confirm')}</Button></Group>
      </Stack>
    </Modal>
  );
}

function ConvertModal({ item, meta, onClose, onDone }: { item: FuItem; meta: Resp['meta']; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'task' | 'obligation'>('task');
  const [project, setProject] = useState<string | null>(null);
  const [freq, setFreq] = useState<string | null>('annual');
  const projects = useQuery({ queryKey: ['convert-projects'], queryFn: async () => (await api.get<{ data: { id: string; code: string; name: string }[] }>('/projects', { params: { per_page: 100 } })).data.data });
  const go = useMutation({
    mutationFn: async () => mode === 'task' ? api.post(`/meeting-resolutions/${item.id}/convert-task`, { project_id: project }) : api.post(`/meeting-resolutions/${item.id}/convert-obligation`, { frequency: freq }),
    onSuccess: () => { toastOk(t('fu.converted')); onDone(); }, onError: toastError,
  });
  const modes = [{ value: 'task', label: t('fu.as_task') }, ...(meta.can_convert_obligation ? [{ value: 'obligation', label: t('fu.as_obligation') }] : [])];
  return (
    <Modal opened onClose={onClose} title={t('fu.convert')} centered>
      <Stack>
        <Select label={t('fu.convert_to')} data={modes} value={mode} onChange={(v) => setMode((v as 'task' | 'obligation') ?? 'task')} allowDeselect={false} />
        {mode === 'task' && <Select label={t('fu.project')} searchable value={project} onChange={setProject} data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} />}
        {mode === 'obligation' && <><Select label={t('fu.frequency')} value={freq} onChange={setFreq} data={meta.frequencies.map((f) => ({ value: f, label: t(`fu.freq.${f}`) }))} allowDeselect={false} />{!item.due_on && <Alert color="orange" variant="light">{t('fu.due_needed')}</Alert>}</>}
        <Text size="xs" c="dimmed">{t('fu.convert_help')}</Text>
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={go.isPending} disabled={mode === 'task' ? !project : !freq || !item.due_on} onClick={() => go.mutate()}>{t('fu.convert')}</Button></Group>
      </Stack>
    </Modal>
  );
}
