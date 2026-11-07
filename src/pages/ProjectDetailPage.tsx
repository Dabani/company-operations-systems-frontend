import { ActionIcon, Alert, Badge, Button, Card, Divider, Drawer, Group, Menu, Modal, ScrollArea, Select, Stack, Tabs, Text, TextInput, Textarea, Timeline } from '@mantine/core';
import { IconClock, IconDots, IconDownload, IconPaperclip, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, downloadFile } from '@/api/client';
import { UploadModal } from '@/components/UploadModal';
import { ProjectBillingPanel } from '@/components/ProjectBillingPanel';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { FileRow, Paginated } from '@/types';

interface Member { id: string; user_id: string; name: string; role: string }
interface Milestone { id: string; name: string; due_date: string | null; completed_at: string | null }
interface Project { id: string; code: string; name: string; description: string | null; status: string; owner: string | null; owner_id: string; my_level: string; milestones: Milestone[]; members: Member[]; task_counts: Record<string, number> }
interface TaskRow { id: string; key: string; title: string; status: string; priority: string; assignee: string | null; assignee_id: string | null; due_date: string | null; overdue: boolean; blocked_by_open: number; milestone_id: string | null }
interface TaskDetail extends TaskRow { description: string | null; priority_id: string; can_edit: boolean; can_comment: boolean; allowed_moves: string[]; blocked_by: { id: string; key: string; title: string; status: string }[];
  comments: { id: string; user: string; user_id: string; body: string; created_at: string }[]; history: { to: string; actor: string | null; note: string | null; at: string }[] }

const COLUMNS = ['todo', 'in_progress', 'in_review', 'done'] as const;
const PRIORITY_COLOR: Record<string, string> = { low: 'gray', normal: 'blue', high: 'orange', urgent: 'red' };
// Mirrors App\Services\Projects\TaskWorkflow (the server is the authority).
const MAP: Record<string, Record<string, boolean>> = {
  todo: { in_progress: false, cancelled: false }, in_progress: { todo: false, in_review: false, cancelled: false, done: true },
  in_review: { in_progress: true, cancelled: true }, done: { in_progress: true }, cancelled: { todo: true },
};
const targets = (from: string, mgr: boolean) => Object.entries(MAP[from] ?? {}).filter(([, needs]) => !needs || mgr).map(([to]) => to);

export function ProjectDetailPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const priorities = useLookup('task_priority');
  const roles = useLookup('project_role');
  const [quick, setQuick] = useState('');
  const [uploading, setUploading] = useState<'project' | 'task' | null>(null);
  const [milestoneName, setMilestoneName] = useState('');
  const [addMember, setAddMember] = useState<{ user_id: string | null; role: string | null } | null>(null);
  const [comment, setComment] = useState('');
  const openTask = sp.get('task');

  const proj = useQuery({ queryKey: ['project', id], queryFn: async () => (await api.get<{ data: Project }>(`/projects/${id}`)).data.data });
  const board = useQuery({ queryKey: ['board', id], queryFn: async () => (await api.get<{ data: TaskRow[] }>(`/projects/${id}/tasks`)).data.data });
  const task = useQuery({ queryKey: ['task', openTask], enabled: !!openTask, queryFn: async () => (await api.get<{ data: TaskDetail }>(`/tasks/${openTask}`)).data.data });
  const files = useQuery({ queryKey: ['project-files', id], queryFn: async () => (await api.get<{ data: FileRow[] }>(`/project-files/${id}`)).data.data });
  const taskFiles = useQuery({ queryKey: ['task-files', openTask], enabled: !!openTask, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/task-files/${openTask}`)).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: proj.data?.my_level === 'manager', queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100 } })).data.data });

  const mgr = proj.data?.my_level === 'manager';
  const canEdit = mgr || proj.data?.my_level === 'member';
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['board', id] }); void qc.invalidateQueries({ queryKey: ['task'] }); void qc.invalidateQueries({ queryKey: ['project', id] }); void qc.invalidateQueries({ queryKey: ['my-tasks'] }); };
  const ok = { onSuccess: () => { toastOk(); refresh(); }, onError: toastError };

  const create = useMutation({ mutationFn: async (title: string) => api.post(`/projects/${id}/tasks`, { title }), onSuccess: () => { setQuick(''); refresh(); }, onError: toastError });
  const move = useMutation({ mutationFn: async (v: { id: string; status: string }) => api.post(`/tasks/${v.id}/move`, { status: v.status }), ...ok });
  const patch = useMutation({ mutationFn: async (v: Record<string, unknown>) => api.patch(`/tasks/${openTask}`, v), ...ok });
  const post = useMutation({ mutationFn: async (v: { path: string; body?: unknown }) => api.post(v.path, v.body), ...ok });
  const del = useMutation({ mutationFn: async (path: string) => api.delete(path), ...ok });
  const addComment = useMutation({ mutationFn: async () => api.post(`/tasks/${openTask}/comments`, { body: comment }), onSuccess: () => { setComment(''); refresh(); }, onError: toastError });

  if (!proj.data) return null;
  const p = proj.data;
  const memberOpts = [{ value: p.owner_id, label: `${p.owner ?? ''} ★` }, ...p.members.filter((m) => m.user_id !== p.owner_id).map((m) => ({ value: m.user_id, label: m.name }))];
  const byStatus = (s: string) => (board.data ?? []).filter((x) => x.status === s);

  const Card1 = (x: TaskRow) => (
    <Card key={x.id} withBorder padding="xs" radius="sm" style={{ cursor: 'pointer' }} onClick={() => setSp({ task: x.id })}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Text size="sm" fw={600} lineClamp={2}>{x.title}</Text>
        {canEdit && <Menu withinPortal position="bottom-end">
          <Menu.Target><ActionIcon variant="subtle" size="sm" onClick={(e) => e.stopPropagation()} aria-label={t('projects.move')}><IconDots size={16} /></ActionIcon></Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>{targets(x.status, mgr).map((to) => <Menu.Item key={to} onClick={() => move.mutate({ id: x.id, status: to })}>{t('projects.move_to', { status: t(`projects.s.${to}`) })}</Menu.Item>)}</Menu.Dropdown>
        </Menu>}
      </Group>
      <Group gap={6} mt={6}>
        <Text size="xs" c="dimmed">{x.key}</Text>
        <Badge size="xs" color={PRIORITY_COLOR[x.priority]} variant="dot">{t(`projects.p.${x.priority}`)}</Badge>
        {x.blocked_by_open > 0 && <Badge size="xs" color="red" variant="light">{t('projects.blocked')}</Badge>}
        {x.due_date && <Text size="xs" c={x.overdue ? 'red' : 'dimmed'}>{x.due_date}</Text>}
      </Group>
      {x.assignee && <Text size="xs" c="dimmed" mt={4}>{x.assignee}</Text>}
    </Card>
  );

  return (
    <>
      <PageHeader title={`${p.code} · ${p.name}`} description={p.description ?? undefined} actions={<Badge variant="light">{t(`projects.ps.${p.status}`, { defaultValue: p.status })}</Badge>} />
      <Tabs defaultValue="board">
        <Tabs.List mb="md"><Tabs.Tab value="board">{t('projects.board')}</Tabs.Tab><Tabs.Tab value="milestones">{t('projects.milestones')}</Tabs.Tab><Tabs.Tab value="members">{t('projects.members')}</Tabs.Tab><Tabs.Tab value="files">{t('files.attachments')}</Tabs.Tab><Tabs.Tab value="billing">{t('billing.title')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="board">
          <ScrollArea type="auto"><Group align="flex-start" wrap="nowrap" gap="md" pb="sm">
            {COLUMNS.map((s) => (
              <Stack key={s} gap="xs" w={270} style={{ flexShrink: 0 }}>
                <Group justify="space-between"><Text fw={700} size="sm">{t(`projects.s.${s}`)}</Text><Badge variant="light" size="sm">{byStatus(s).length}</Badge></Group>
                {s === 'todo' && canEdit && <TextInput size="xs" placeholder={t('projects.quick_add')} value={quick} onChange={(e) => setQuick(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && quick.trim()) create.mutate(quick.trim()); }} rightSection={<IconPlus size={14} />} />}
                {byStatus(s).map(Card1)}
              </Stack>))}
          </Group></ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="milestones"><Stack gap="xs">
          {p.milestones.map((m) => (
            <Group key={m.id} justify="space-between"><div><Text size="sm" fw={600} td={m.completed_at ? 'line-through' : undefined}>{m.name}</Text><Text size="xs" c="dimmed">{m.due_date ?? '—'}</Text></div>
              {mgr && <Group gap={4}><Button size="compact-xs" variant="light" onClick={() => api.patch(`/projects/${id}/milestones/${m.id}`, { completed: !m.completed_at }).then(refresh).catch(toastError)}>{m.completed_at ? t('projects.reopen') : t('projects.complete')}</Button>
                <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(`/projects/${id}/milestones/${m.id}`)}><IconTrash size={16} /></ActionIcon></Group>}</Group>))}
          {mgr && <Group><TextInput placeholder={t('projects.milestone_name')} value={milestoneName} onChange={(e) => setMilestoneName(e.currentTarget.value)} />
            <Button disabled={!milestoneName.trim()} onClick={() => post.mutate({ path: `/projects/${id}/milestones`, body: { name: milestoneName } }, { onSuccess: () => setMilestoneName('') })}>{t('common.save')}</Button></Group>}
        </Stack></Tabs.Panel>

        <Tabs.Panel value="members"><Stack gap="xs">
          <Text size="sm">★ {p.owner} — {t('projects.owner')}</Text>
          {p.members.map((m) => (<Group key={m.id} justify="space-between"><Text size="sm">{m.name} · <Badge size="xs" variant="light">{roles.items.find((r) => r.code === m.role)?.label ?? m.role}</Badge></Text>
            {mgr && <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(`/projects/${id}/members/${m.user_id}`)}><IconTrash size={16} /></ActionIcon>}</Group>))}
          {mgr && <Button size="xs" variant="light" w="fit-content" onClick={() => setAddMember({ user_id: null, role: null })}>{t('projects.add_member')}</Button>}
        </Stack></Tabs.Panel>

        <Tabs.Panel value="files"><Stack gap="xs">
          {canEdit && <Button size="xs" w="fit-content" leftSection={<IconPaperclip size={14} />} onClick={() => setUploading('project')}>{t('files.upload')}</Button>}
          {files.data?.map((f) => <Group key={f.id} justify="space-between"><Text size="sm">{f.name}</Text>{f.can.download && <ActionIcon variant="subtle" onClick={() => downloadFile(f.id, f.name).catch(toastError)}><IconDownload size={16} /></ActionIcon>}</Group>)}
        </Stack></Tabs.Panel>
        <Tabs.Panel value="billing"><ProjectBillingPanel projectId={p.id} isManager={mgr} projectStatus={p.status} /></Tabs.Panel>
      </Tabs>

      <Drawer opened={!!openTask} onClose={() => setSp({})} position="right" size="lg" title={task.data ? `${task.data.key} · ${task.data.title}` : ''}>
        {task.data && <Stack gap="sm">
          <Group gap="xs"><Badge variant="light">{t(`projects.s.${task.data.status}`)}</Badge>{task.data.status === 'in_review' && <Badge color="orange" variant="light">{t('projects.awaiting_review')}</Badge>}</Group>
          {task.data.can_edit ? <>
            <TextInput label={t('common.name')} defaultValue={task.data.title} onBlur={(e) => e.currentTarget.value !== task.data!.title && patch.mutate({ title: e.currentTarget.value })} />
            <Textarea label={t('common.description')} autosize minRows={2} defaultValue={task.data.description ?? ''} onBlur={(e) => patch.mutate({ description: e.currentTarget.value })} />
            <Group grow>
              <Select label={t('projects.assignee')} clearable data={memberOpts} value={task.data.assignee_id} onChange={(v) => patch.mutate({ assignee_id: v })} />
              <Select label={t('projects.priority')} data={priorities.options} value={task.data.priority_id} onChange={(v) => v && patch.mutate({ priority_id: v })} />
              <TextInput type="date" label={t('projects.due')} defaultValue={task.data.due_date ?? ''} onBlur={(e) => patch.mutate({ due_date: e.currentTarget.value || null })} />
            </Group>
            <Select label={t('projects.milestone')} clearable data={p.milestones.map((m) => ({ value: m.id, label: m.name }))} value={task.data.milestone_id} onChange={(v) => patch.mutate({ milestone_id: v })} />
          </> : <Text size="sm">{task.data.description}</Text>}
          {canEdit && <Button size="xs" variant="light" leftSection={<IconClock size={14} />} onClick={() => api.post('/timer/start', { project_id: id, task_id: task.data!.id, stop_existing: true }).then(() => { toastOk(t('time.started')); void qc.invalidateQueries({ queryKey: ['timer'] }); }).catch(toastError)}>{t('time.start_task')}</Button>}
          {task.data.allowed_moves.length > 0 && <Group gap="xs">{task.data.allowed_moves.map((to) => <Button key={to} size="xs" variant={to === 'in_review' ? 'filled' : 'light'} onClick={() => move.mutate({ id: task.data!.id, status: to })}>{to === 'in_review' ? t('projects.request_review') : t('projects.move_to', { status: t(`projects.s.${to}`) })}</Button>)}</Group>}
          {task.data.blocked_by.some((b) => !['done', 'cancelled'].includes(b.status)) && <Alert color="red" variant="light">{t('projects.blocked_note')}</Alert>}
          <Divider label={t('projects.dependencies')} />
          {task.data.blocked_by.map((b) => <Group key={b.id} justify="space-between"><Text size="sm">{b.key} · {b.title} <Badge size="xs" variant="light">{t(`projects.s.${b.status}`)}</Badge></Text>
            {task.data!.can_edit && <ActionIcon color="red" variant="subtle" onClick={() => del.mutate(`/tasks/${task.data!.id}/dependencies/${b.id}`)}><IconTrash size={14} /></ActionIcon>}</Group>)}
          {task.data.can_edit && <Select placeholder={t('projects.add_dependency')} searchable clearable value={null} data={(board.data ?? []).filter((x) => x.id !== task.data!.id).map((x) => ({ value: x.id, label: `${x.key} · ${x.title}` }))}
            onChange={(v) => v && post.mutate({ path: `/tasks/${task.data!.id}/dependencies`, body: { depends_on_task_id: v } })} />}
          <Divider label={t('files.attachments')} />
          {taskFiles.data?.map((f) => <Group key={f.id} justify="space-between"><Text size="sm">{f.name}</Text>{f.can.download && <ActionIcon variant="subtle" onClick={() => downloadFile(f.id, f.name).catch(toastError)}><IconDownload size={16} /></ActionIcon>}</Group>)}
          {canEdit && <Button size="xs" w="fit-content" variant="light" leftSection={<IconPaperclip size={14} />} onClick={() => setUploading('task')}>{t('files.upload')}</Button>}
          <Divider label={t('projects.comments')} />
          {task.data.comments.map((c) => <div key={c.id}><Text size="xs" c="dimmed">{c.user} · {new Date(c.created_at).toLocaleString()}</Text><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</Text></div>)}
          {task.data.can_comment && <Group align="flex-end"><Textarea style={{ flex: 1 }} autosize minRows={1} placeholder={t('projects.write_comment')} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
            <Button disabled={!comment.trim()} loading={addComment.isPending} onClick={() => addComment.mutate()}>{t('projects.send')}</Button></Group>}
          <Divider label={t('projects.history')} />
          <Timeline bulletSize={12} lineWidth={2}>{task.data.history.map((h, i) => <Timeline.Item key={i} title={t(`projects.s.${h.to}`)}><Text size="xs" c="dimmed">{h.actor ?? t('projects.system')} · {new Date(h.at).toLocaleString()}{h.note ? ` · ${h.note}` : ''}</Text></Timeline.Item>)}</Timeline>
        </Stack>}
      </Drawer>

      <Modal opened={!!addMember} onClose={() => setAddMember(null)} title={t('projects.add_member')} centered>
        {addMember && <Stack>
          <Select label={t('common.user')} searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} value={addMember.user_id} onChange={(v) => setAddMember({ ...addMember, user_id: v })} />
          <Select label={t('projects.role')} data={roles.options} value={addMember.role} onChange={(v) => setAddMember({ ...addMember, role: v })} />
          <Group justify="flex-end"><Button disabled={!addMember.user_id || !addMember.role} onClick={() => post.mutate({ path: `/projects/${id}/members`, body: { user_id: addMember.user_id, project_role_id: addMember.role } }, { onSuccess: () => setAddMember(null) })}>{t('common.save')}</Button></Group>
        </Stack>}
      </Modal>
      <UploadModal opened={!!uploading} onClose={() => setUploading(null)} endpoint={uploading === 'task' ? `/task-files/${openTask}` : `/project-files/${id}`} allowRestricted={false}
        onDone={() => { void qc.invalidateQueries({ queryKey: ['project-files', id] }); void qc.invalidateQueries({ queryKey: ['task-files', openTask] }); }} />
    </>
  );
}
