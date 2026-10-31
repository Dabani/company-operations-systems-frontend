import { ActionIcon, Alert, Badge, Button, Card, Divider, Drawer, FileButton, Group, Menu, Modal, MultiSelect, Select, SimpleGrid, Skeleton, Stack, Text, TextInput, Textarea, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconBan, IconDotsVertical, IconEdit, IconEye, IconMailForward, IconPlayerPlay, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { fmtDateTime } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Language, Paginated, RoleRow } from '@/types';

interface Invitation { last_sent_at: string | null; expires_at: string; expired: boolean; send_count: number }
interface UserRow {
  id: string; name: string; email: string; phone: string | null; has_avatar: boolean; language_id: string | null; status: string; status_label: string; status_color: string | null;
  department_id: string | null; department: string | null; job_title: string | null; role_ids: string[]; roles: { id: string; name: string; color: string | null }[];
  last_login_at: string | null; activated: boolean; invitation?: Invitation;
}
interface Summary { total: number; active: number; invited: number; invitation_expired: number; suspended: number; never_signed_in: number; dormant: number }
type Action = 'suspend' | 'activate' | 'resend_invite' | 'cancel_invite';

const CHIPS: { key: string; quick: string | null; field: keyof Summary; color: string }[] = [
  { key: 'all', quick: null, field: 'total', color: 'gray' },
  { key: 'active', quick: 'active', field: 'active', color: 'green' },
  { key: 'invited', quick: 'invited', field: 'invited', color: 'orange' },
  { key: 'expired', quick: 'expired', field: 'invitation_expired', color: 'red' },
  { key: 'suspended', quick: 'suspended', field: 'suspended', color: 'gray' },
  { key: 'never', quick: 'never', field: 'never_signed_in', color: 'yellow' },
  { key: 'dormant', quick: 'dormant', field: 'dormant', color: 'grape' },
];

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [detail, setDetail] = useState<UserRow | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; mail_failed: number; errors: { line: number; message: string }[] } | null>(null);
  const [confirm, setConfirm] = useState<{ action: Action; users: UserRow[]; clear?: () => void } | null>(null);
  const [reason, setReason] = useState('');
  const [bulkResult, setBulkResult] = useState<{ done: number; failed: { id: string; name: string | null; reason: string }[] } | null>(null);

  const statuses = useLookup('user_status');
  const roles = useQuery({ queryKey: ['roles-options'], enabled: can('role.view'), queryFn: async () => (await api.get<Paginated<RoleRow>>('/roles', { params: { per_page: 100, sort: 'level', direction: 'desc' } })).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const langs = useQuery({ queryKey: ['languages'], queryFn: async () => (await api.get<{ data: Language[] }>('/languages')).data.data });
  const summary = useQuery({ queryKey: ['users-summary'], queryFn: async () => (await api.get<{ data: Summary }>('/users/summary')).data.data, staleTime: 15_000 });
  const activity = useQuery({
    queryKey: ['user-activity', detail?.id], enabled: !!detail && can('audit_log.view'),
    queryFn: async () => (await api.get<{ data: { id: string; action: string; created_at: string; as_actor: boolean; outcome: string | null }[] }>(`/users/${detail!.id}/activity`)).data.data,
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['users'] }); void qc.invalidateQueries({ queryKey: ['users-summary'] }); };
  const mailNote = (sent: boolean | null | undefined, email: string) => {
    if (sent === true) notifications.show({ color: 'green', message: t('users.invite_sent_to', { email }) });
    else if (sent === false) notifications.show({ color: 'orange', autoClose: 10000, message: t('users.mail_failed') });
  };

  const form = useForm({
    initialValues: { name: '', email: '', phone: '', language_id: null as string | null, department_id: '' as string | null, job_title: '', role_ids: [] as string[] },
    validate: { name: (v) => (v.trim() ? null : t('common.name')), role_ids: (v) => (v.length ? null : t('users.roles')) },
  });

  const open = (u: UserRow | 'new') => {
    setEditing(u);
    form.setValues(u === 'new' ? { name: '', email: '', phone: '', language_id: null, department_id: null, job_title: '', role_ids: [] }
      : { name: u.name, email: u.email, phone: u.phone ?? '', language_id: u.language_id, department_id: u.department_id, job_title: u.job_title ?? '', role_ids: u.role_ids });
    form.resetDirty();
  };

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => (editing === 'new' ? api.post('/users', v) : api.patch(`/users/${(editing as UserRow).id}`, v)),
    onSuccess: (r, v) => {
      const sent = (r.data as { invitation_sent?: boolean | null }).invitation_sent;
      if (editing === 'new') mailNote(sent, v.email); else { toastOk(); if (sent !== null && sent !== undefined) mailNote(sent, v.email); }
      setEditing(null); refresh();
    },
    onError: (e) => { const p = parseError(e); form.setErrors(p.fields); toastError(e); },
  });

  const single = useMutation({
    mutationFn: async ({ action, u }: { action: Action; u: UserRow }) => {
      if (action === 'resend_invite') return (await api.post(`/users/${u.id}/invite`)).data;
      if (action === 'cancel_invite') return (await api.delete(`/users/${u.id}`)).data;
      return (await api.post(`/users/${u.id}/status`, { status: action === 'suspend' ? 'suspended' : 'active', reason: reason || undefined })).data;
    },
    onSuccess: (r, { action, u }) => { if (action === 'cancel_invite') toastOk(r.message); else if (action === 'resend_invite' || r.invitation_sent !== undefined) mailNote(r.invitation_sent, u.email); else toastOk(); setConfirm(null); setReason(''); refresh(); setDetail(null); },
    onError: toastError,
  });

  const bulk = useMutation({
    mutationFn: async ({ action, users }: { action: Action; users: UserRow[] }) => (await api.post<{ done: number; failed: { id: string; name: string | null; reason: string }[] }>('/users/bulk', { action, ids: users.map((u) => u.id), reason: reason || undefined })).data,
    onSuccess: (r) => { setBulkResult(r); confirm?.clear?.(); setConfirm(null); setReason(''); refresh(); },
    onError: toastError,
  });

  const run = (action: Action, users: UserRow[], clear?: () => void) => {
    if (action === 'suspend' || action === 'cancel_invite') { setReason(''); setConfirm({ action, users, clear }); return; }   // destructive: ask first
    if (users.length === 1 && !clear) single.mutate({ action, u: users[0] }); else bulk.mutate({ action, users }, { onSuccess: () => clear?.() });
  };
  const confirmed = () => {
    if (!confirm) return;
    if (confirm.users.length === 1 && !confirm.clear) single.mutate({ action: confirm.action, u: confirm.users[0] }); else bulk.mutate({ action: confirm.action, users: confirm.users });
  };

  const doImport = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); return (await api.post('/users/import', fd)).data; },
    onSuccess: (r) => { setImportResult(r); refresh(); },
    onError: toastError,
  });

  const invitationLine = (u: UserRow) => {
    if (u.status !== 'invited' || !u.invitation) return null;
    return u.invitation.expired
      ? <Text size="xs" c="red">{t('users.invitation_expired')}</Text>
      : <Text size="xs" c="dimmed">{t('users.invitation_expires', { date: fmtDateTime(u.invitation.expires_at, i18n.language) })}</Text>;
  };

  const columns: Column<UserRow>[] = [
    { key: 'name', label: t('common.name'), sortable: true, render: (u) => (
      <Group gap="sm" wrap="nowrap"><UserAvatar userId={u.id} hasAvatar={u.has_avatar} name={u.name} size={32} />
        <div><Text size="sm" fw={600}>{u.name}</Text><Text size="xs" c="dimmed">{u.email}</Text></div></Group>) },
    { key: 'roles', label: t('users.roles'), render: (u) => <Group gap={4}>{u.roles.map((r) => <Badge key={r.id} color={r.color ?? 'gray'} variant="light">{r.name}</Badge>)}</Group> },
    { key: 'department', label: t('users.department'), visibleFrom: 'md', render: (u) => u.department ?? '—' },
    { key: 'status_id', label: t('common.status'), render: (u) => <Stack gap={2}><StatusBadge label={u.status_label} color={u.status_color} />{invitationLine(u)}</Stack> },
    { key: 'last_login_at', label: t('users.last_login'), sortable: true, visibleFrom: 'lg', render: (u) => (u.last_login_at ? fmtDateTime(u.last_login_at, i18n.language) : <Text size="sm" c="dimmed">{t('users.never_signed_in')}</Text>) },
  ];

  const neverActivated = (u: UserRow) => u.status === 'invited' && !u.activated && !u.last_login_at;
  const selectableRow = (u: UserRow) => u.id !== me?.id;
  const confirmTitle = confirm?.action === 'cancel_invite' ? t('users.invite_cancel') : t('users.suspend');

  return (
    <>
      <PageHeader title={t('users.title')} />

      <SimpleGrid cols={{ base: 2, sm: 4, lg: 7 }} mb="md" className="no-print">
        {CHIPS.map((c) => (
          <UnstyledButton key={c.key} onClick={() => setQuick(c.quick)} aria-pressed={quick === c.quick}>
            <Card padding="xs" withBorder style={{ borderColor: quick === c.quick ? `var(--mantine-color-${c.color}-6)` : undefined, borderWidth: quick === c.quick ? 2 : 1 }}>
              <Text size="xs" c="dimmed" lh={1.2}>{t(`users.chip_${c.key}`)}</Text>
              {summary.isLoading ? <Skeleton h={22} w={30} mt={4} /> : <Text fz={22} fw={800} c={c.color === 'gray' ? undefined : `${c.color}.7`}>{summary.data?.[c.field] ?? 0}</Text>}
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <DataList<UserRow>
        title={t('users.title')} endpoint="/users" queryKey="users" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
        extraParams={quick ? { quick } : undefined}
        filters={[
          { key: 'status_id', label: t('common.status'), options: statuses.options },
          { key: 'role_id', label: t('users.roles'), options: (roles.data ?? []).map((r) => ({ value: r.id, label: r.name })) },
          { key: 'department_id', label: t('users.department'), options: (depts.data ?? []).map((d) => ({ value: d.id, label: d.name })) },
        ]}
        selectableRow={selectableRow}
        bulk={(selected, clear) => <>
          {can('user.create') && <Button size="xs" variant="light" leftSection={<IconMailForward size={14} />} onClick={() => run('resend_invite', selected.filter((u) => u.status === 'invited'), clear)} disabled={!selected.some((u) => u.status === 'invited')}>{t('users.invite_resend')}</Button>}
          {can('user.suspend') && <Button size="xs" variant="light" color="green" leftSection={<IconPlayerPlay size={14} />} onClick={() => run('activate', selected.filter((u) => u.status === 'suspended'), clear)} disabled={!selected.some((u) => u.status === 'suspended')}>{t('users.reactivate')}</Button>}
          {can('user.suspend') && <Button size="xs" variant="light" color="orange" leftSection={<IconBan size={14} />} onClick={() => run('suspend', selected.filter((u) => u.status !== 'suspended'), clear)} disabled={!selected.some((u) => u.status !== 'suspended')}>{t('users.suspend')}</Button>}
          {can('user.create') && <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={() => run('cancel_invite', selected.filter(neverActivated), clear)} disabled={!selected.some(neverActivated)}>{t('users.invite_cancel')}</Button>}
        </>}
        toolbar={<>
          {(can('data.import') || can('user.create')) && <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => { setImportResult(null); setImportOpen(true); }}>{t('common.import')}</Button>}
          {can('user.create') && <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('users.new')}</Button>}
        </>}
        onRowClick={setDetail}
        rowActions={(u) => <>
          <RowIconButton label={t('common.details')} onClick={() => setDetail(u)}><IconEye size={18} /></RowIconButton>
          {can('user.update') && <RowIconButton label={t('common.edit')} onClick={() => open(u)}><IconEdit size={18} /></RowIconButton>}
          {u.id !== me?.id && (can('user.create') || can('user.suspend')) && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target><ActionIcon variant="subtle" aria-label={t('common.actions')} title={t('common.actions')}><IconDotsVertical size={18} /></ActionIcon></Menu.Target>
              <Menu.Dropdown>
                {can('user.create') && u.status === 'invited' && <Menu.Item leftSection={<IconMailForward size={16} />} onClick={() => run('resend_invite', [u])}>{t('users.invite_resend')}</Menu.Item>}
                {can('user.suspend') && (u.status === 'suspended'
                  ? <Menu.Item color="green" leftSection={<IconPlayerPlay size={16} />} onClick={() => run('activate', [u])}>{t('users.reactivate')}</Menu.Item>
                  : <Menu.Item color="orange" leftSection={<IconBan size={16} />} onClick={() => run('suspend', [u])}>{t('users.suspend')}</Menu.Item>)}
                {can('user.create') && neverActivated(u) && <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => run('cancel_invite', [u])}>{t('users.invite_cancel')}</Menu.Item>}
              </Menu.Dropdown>
            </Menu>
          )}
        </>}
      />

      {/* create / edit */}
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('users.new') : t('users.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            {editing === 'new' && <Alert color="blue" variant="light">{t('users.invite_note')}</Alert>}
            {editing !== 'new' && editing?.status === 'invited' && form.values.email !== editing.email && <Alert color="orange" variant="light">{t('users.email_changed_note')}</Alert>}
            <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            <TextInput label={t('common.email')} type="email" required {...form.getInputProps('email')} />
            <Group grow align="flex-start">
              <TextInput label={t('common.phone')} {...form.getInputProps('phone')} />
              <Select label={t('users.language')} data={(langs.data ?? []).map((l) => ({ value: l.id, label: l.name }))} clearable {...form.getInputProps('language_id')} />
            </Group>
            <Group grow align="flex-start">
              <Select label={t('users.department')} data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} clearable {...form.getInputProps('department_id')} />
              <TextInput label={t('users.job_title')} {...form.getInputProps('job_title')} />
            </Group>
            <MultiSelect label={t('users.roles')} required searchable
              data={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name, disabled: r.level > (me?.level ?? 0) }))}
              {...form.getInputProps('role_ids')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={save.isPending}>{editing === 'new' ? t('users.send_invitation') : t('common.save')}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* confirmation for destructive actions */}
      <Modal opened={!!confirm} onClose={() => setConfirm(null)} title={confirmTitle} centered>
        <Stack>
          <Text size="sm">{confirm?.action === 'cancel_invite' ? t('users.confirm_cancel', { count: confirm?.users.length }) : t('users.confirm_suspend', { count: confirm?.users.length })}</Text>
          {confirm && confirm.users.length <= 5 && <Text size="sm" c="dimmed">{confirm.users.map((u) => u.name).join(', ')}</Text>}
          {confirm?.action === 'suspend' && <Textarea label={t('users.reason')} value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={250} autosize minRows={2} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button color={confirm?.action === 'cancel_invite' ? 'red' : 'orange'} loading={single.isPending || bulk.isPending} onClick={confirmed}>{t('common.confirm')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* result of a bulk action */}
      <Modal opened={!!bulkResult} onClose={() => setBulkResult(null)} title={t('users.bulk_result_title')} centered>
        {bulkResult && <Stack gap="xs">
          <Alert color={bulkResult.failed.length ? 'orange' : 'green'}>{t('users.bulk_result', { done: bulkResult.done, failed: bulkResult.failed.length })}</Alert>
          {bulkResult.failed.map((f) => <Text key={f.id} size="sm"><b>{f.name ?? f.id}</b>: {f.reason}</Text>)}
          <Group justify="flex-end"><Button onClick={() => setBulkResult(null)}>{t('common.close')}</Button></Group>
        </Stack>}
      </Modal>

      {/* import */}
      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title={t('users.import')} centered>
        <Stack>
          <Text size="sm" c="dimmed">{t('users.import_hint')}</Text>
          <FileButton accept=".csv,.xlsx,text/csv" onChange={(f) => f && doImport.mutate(f)}>
            {(props) => <Button {...props} loading={doImport.isPending} leftSection={<IconUpload size={16} />}>{t('common.upload')}</Button>}
          </FileButton>
          {importResult && (
            <Alert color={importResult.errors.length || importResult.mail_failed ? 'orange' : 'green'}>
              <Text size="sm" fw={600}>{t('users.import_done', { count: importResult.created })}</Text>
              {importResult.mail_failed > 0 && <Text size="sm" mt={6}>{t('users.import_mail_failed', { count: importResult.mail_failed })}</Text>}
              {importResult.errors.length > 0 && <><Text size="sm" mt={6}>{t('users.import_errors')}:</Text>
                {importResult.errors.slice(0, 10).map((e) => <Text key={e.line} size="xs">#{e.line}: {e.message}</Text>)}</>}
            </Alert>
          )}
        </Stack>
      </Modal>

      {/* details */}
      <Drawer opened={!!detail} onClose={() => setDetail(null)} position="right" size="md" title={detail && <Group gap="sm"><UserAvatar userId={detail.id} hasAvatar={detail.has_avatar} name={detail.name} size={36} /><div><Text fw={700}>{detail.name}</Text><Text size="xs" c="dimmed">{detail.email}</Text></div></Group>}>
        {detail && <Stack gap="sm">
          <Group gap="xs"><StatusBadge label={detail.status_label} color={detail.status_color} />{detail.roles.map((r) => <Badge key={r.id} color={r.color ?? 'gray'} variant="light">{r.name}</Badge>)}</Group>
          <SimpleGrid cols={2} spacing="xs">
            <div><Text size="xs" c="dimmed">{t('users.department')}</Text><Text size="sm">{detail.department ?? '—'}</Text></div>
            <div><Text size="xs" c="dimmed">{t('users.job_title')}</Text><Text size="sm">{detail.job_title ?? '—'}</Text></div>
            <div><Text size="xs" c="dimmed">{t('common.phone')}</Text><Text size="sm">{detail.phone ?? '—'}</Text></div>
            <div><Text size="xs" c="dimmed">{t('users.last_login')}</Text><Text size="sm">{detail.last_login_at ? fmtDateTime(detail.last_login_at, i18n.language) : t('users.never_signed_in')}</Text></div>
          </SimpleGrid>
          {detail.invitation && (
            <Alert color={detail.invitation.expired ? 'red' : 'orange'} variant="light" title={t('users.invitation')}>
              <Text size="sm">{detail.invitation.last_sent_at && t('users.invitation_sent_on', { date: fmtDateTime(detail.invitation.last_sent_at, i18n.language) })} · {t('users.send_count', { count: detail.invitation.send_count })}</Text>
              <Text size="sm">{detail.invitation.expired ? t('users.invitation_expired') : t('users.invitation_expires', { date: fmtDateTime(detail.invitation.expires_at, i18n.language) })}</Text>
            </Alert>
          )}
          <Group>
            {can('user.update') && <Button size="xs" variant="default" leftSection={<IconEdit size={14} />} onClick={() => { const u = detail; setDetail(null); open(u); }}>{t('common.edit')}</Button>}
            {can('user.create') && detail.status === 'invited' && detail.id !== me?.id && <Button size="xs" leftSection={<IconMailForward size={14} />} loading={single.isPending} onClick={() => run('resend_invite', [detail])}>{t('users.invite_resend')}</Button>}
          </Group>
          {can('audit_log.view') && <>
            <Divider label={t('users.activity')} labelPosition="left" />
            {activity.isLoading && <Skeleton h={60} />}
            {activity.data?.length === 0 && <Text size="sm" c="dimmed">{t('users.no_activity')}</Text>}
            {activity.data?.map((a) => (
              <Group key={a.id} justify="space-between" wrap="nowrap">
                <Text size="xs" ff="monospace" c={a.outcome === 'failure' ? 'red' : undefined}>{a.action}{a.as_actor ? ' ↗' : ''}</Text>
                <Text size="xs" c="dimmed">{fmtDateTime(a.created_at, i18n.language)}</Text>
              </Group>
            ))}
          </>}
        </Stack>}
      </Drawer>
    </>
  );
}
