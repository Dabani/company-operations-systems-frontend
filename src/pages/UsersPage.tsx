import { Alert, Badge, Button, FileButton, Group, Modal, MultiSelect, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconPlayerPause, IconPlayerPlay, IconPlus, IconUpload } from '@tabler/icons-react';
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
import type { Paginated, RoleRow } from '@/types';

interface UserRow {
  id: string; name: string; email: string; phone: string | null; has_avatar: boolean; status: string; status_label: string; status_color: string | null;
  department_id: string | null; department: string | null; job_title: string | null; role_ids: string[]; roles: { id: string; name: string; color: string | null }[]; last_login_at: string | null;
}

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { line: number; message: string }[] } | null>(null);
  const statuses = useLookup('user_status');

  const roles = useQuery({ queryKey: ['roles-options'], enabled: can('role.view'), queryFn: async () => (await api.get<Paginated<RoleRow>>('/roles', { params: { per_page: 100, sort: 'level', direction: 'desc' } })).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });

  const form = useForm({
    initialValues: { name: '', email: '', phone: '', department_id: '' as string | null, job_title: '', role_ids: [] as string[] },
    validate: { name: (v) => (v.trim() ? null : t('common.name')), role_ids: (v) => (v.length ? null : t('users.roles')) },
  });

  const open = (u: UserRow | 'new') => {
    setEditing(u);
    form.setValues(u === 'new' ? { name: '', email: '', phone: '', department_id: null, job_title: '', role_ids: [] }
      : { name: u.name, email: u.email, phone: u.phone ?? '', department_id: u.department_id, job_title: u.job_title ?? '', role_ids: u.role_ids });
    form.resetDirty();
  };

  const save = useMutation({
    mutationFn: async (v: typeof form.values) =>
      editing === 'new' ? api.post('/users', v) : api.patch(`/users/${(editing as UserRow).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); void qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => { const p = parseError(e); form.setErrors(p.fields); toastError(e); },
  });

  const toggle = useMutation({
    mutationFn: async (u: UserRow) => api.post(`/users/${u.id}/status`, { status: u.status === 'suspended' ? 'active' : 'suspended' }),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: toastError,
  });

  const doImport = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); return (await api.post('/users/import', fd)).data; },
    onSuccess: (r) => { setImportResult(r); void qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: toastError,
  });

  const columns: Column<UserRow>[] = [
    { key: 'name', label: t('common.name'), sortable: true, render: (u) => (
      <Group gap="sm" wrap="nowrap"><UserAvatar userId={u.id} hasAvatar={u.has_avatar} name={u.name} size={32} />
        <div><Text size="sm" fw={600}>{u.name}</Text><Text size="xs" c="dimmed">{u.email}</Text></div></Group>) },
    { key: 'roles', label: t('users.roles'), render: (u) => <Group gap={4}>{u.roles.map((r) => <Badge key={r.id} color={r.color ?? 'gray'} variant="light">{r.name}</Badge>)}</Group> },
    { key: 'department', label: t('users.department'), visibleFrom: 'md', render: (u) => u.department ?? '—' },
    { key: 'status_id', label: t('common.status'), render: (u) => <StatusBadge label={u.status_label} color={u.status_color} /> },
    { key: 'last_login_at', label: t('users.last_login'), sortable: true, visibleFrom: 'lg', render: (u) => fmtDateTime(u.last_login_at, i18n.language) },
  ];

  return (
    <>
      <PageHeader title={t('users.title')} />
      <DataList<UserRow>
        title={t('users.title')} endpoint="/users" queryKey="users" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]}
        toolbar={<>
          {(can('data.import') || can('user.create')) && <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => { setImportResult(null); setImportOpen(true); }}>{t('common.import')}</Button>}
          {can('user.create') && <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('users.new')}</Button>}
        </>}
        rowActions={(u) => <>
          {can('user.update') && <RowIconButton label={t('common.edit')} onClick={() => open(u)}><IconEdit size={18} /></RowIconButton>}
          {can('user.suspend') && u.id !== me?.id && (
            <RowIconButton label={u.status === 'suspended' ? t('users.reactivate') : t('users.suspend')} color={u.status === 'suspended' ? 'green' : 'orange'} onClick={() => toggle.mutate(u)}>
              {u.status === 'suspended' ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
            </RowIconButton>)}
        </>}
      />

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('users.new') : t('users.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            {editing === 'new' && <Alert color="blue" variant="light">{t('users.invite_note')}</Alert>}
            <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            <TextInput label={t('common.email')} type="email" required {...form.getInputProps('email')} />
            <TextInput label={t('common.phone')} {...form.getInputProps('phone')} />
            <Group grow align="flex-start">
              <Select label={t('users.department')} data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} clearable {...form.getInputProps('department_id')} />
              <TextInput label={t('users.job_title')} {...form.getInputProps('job_title')} />
            </Group>
            <MultiSelect label={t('users.roles')} required searchable
              data={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name, disabled: r.level > (me?.level ?? 0) }))}
              {...form.getInputProps('role_ids')} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={importOpen} onClose={() => setImportOpen(false)} title={t('users.import')} centered>
        <Stack>
          <Text size="sm" c="dimmed">{t('users.import_hint')}</Text>
          <FileButton accept=".csv,.xlsx,text/csv" onChange={(f) => f && doImport.mutate(f)}>
            {(props) => <Button {...props} loading={doImport.isPending} leftSection={<IconUpload size={16} />}>{t('common.upload')}</Button>}
          </FileButton>
          {importResult && (
            <Alert color={importResult.errors.length ? 'orange' : 'green'}>
              <Text size="sm" fw={600}>{t('users.import_done', { count: importResult.created })}</Text>
              {importResult.errors.length > 0 && <><Text size="sm" mt={6}>{t('users.import_errors')}:</Text>
                {importResult.errors.slice(0, 10).map((e) => <Text key={e.line} size="xs">#{e.line}: {e.message}</Text>)}</>}
            </Alert>
          )}
        </Stack>
      </Modal>
    </>
  );
}
