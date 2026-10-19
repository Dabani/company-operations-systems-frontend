import { Badge, Box, Button, Checkbox, ColorSwatch, Group, Modal, MultiSelect, NumberInput, Paper, ScrollArea, Select, Stack, Switch, Table, Tabs, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconLayoutGrid, IconList, IconLock, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { stripHtml } from '@/lib/format';
import { MANTINE_COLORS, toastError, toastOk } from '@/lib/ui';
import type { PermissionRow, Paginated, RoleRow } from '@/types';

export function RolesPage() {
  const { t } = useTranslation();
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const manage = can('role.manage');
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);

  const roles = useQuery({ queryKey: ['roles-all'], queryFn: async () => (await api.get<Paginated<RoleRow>>('/roles', { params: { per_page: 100, sort: 'level', direction: 'asc' } })).data.data });
  const perms = useQuery({ queryKey: ['permissions'], queryFn: async () => (await api.get<{ data: PermissionRow[] }>('/permissions')).data.data });
  const widgets = useQuery({ queryKey: ['widgets'], queryFn: async () => (await api.get<{ data: { id: string; code: string; name_key: string }[] }>('/dashboard-widgets')).data.data });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['roles-all'] }); void qc.invalidateQueries({ queryKey: ['roles'] }); void qc.invalidateQueries({ queryKey: ['roles-options'] }); };

  const form = useForm({ initialValues: { code: '', name: '', description: '', level: 20, color: 'gray', is_active: true, widget_ids: [] as string[] } });

  const open = (r: RoleRow | 'new') => {
    setEditing(r);
    form.setValues(r === 'new' ? { code: '', name: '', description: '', level: 20, color: 'gray', is_active: true, widget_ids: [] }
      : { code: r.code, name: r.name, description: r.description ?? '', level: r.level, color: r.color ?? 'gray', is_active: r.is_active, widget_ids: r.widget_ids ?? [] });
  };

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => editing === 'new' ? api.post('/roles', v) : api.patch(`/roles/${(editing as RoleRow).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const remove = useMutation({
    mutationFn: async (r: RoleRow) => api.delete(`/roles/${r.id}`),
    onSuccess: () => { toastOk(); setDeleting(null); refresh(); },
    onError: (e) => { toastError(e); setDeleting(null); },
  });

  const toggle = useMutation({
    mutationFn: async ({ role, permissionId, on }: { role: RoleRow; permissionId: string; on: boolean }) => {
      const cur = new Set(role.permission_ids ?? []);
      on ? cur.add(permissionId) : cur.delete(permissionId);
      return api.patch(`/roles/${role.id}`, { code: role.code, name: role.name, level: role.level, color: role.color, is_active: role.is_active, permission_ids: [...cur] });
    },
    onSuccess: refresh,
    onError: toastError,
  });

  const grouped = useMemo(() => {
    const m = new Map<string, { label: string; items: PermissionRow[] }>();
    (perms.data ?? []).forEach((p) => { if (!m.has(p.group)) m.set(p.group, { label: p.group_label, items: [] }); m.get(p.group)!.items.push(p); });
    return [...m.values()];
  }, [perms.data]);

  const sorted = [...(roles.data ?? [])].sort((a, b) => a.level - b.level);
  const lockedFor = (r: RoleRow) => !manage || r.level > (me?.level ?? 0);

  const columns: Column<RoleRow>[] = [
    { key: 'name', label: t('common.name'), sortable: true, render: (r) => (
      <Group gap="xs" wrap="nowrap"><ColorSwatch color={`var(--mantine-color-${r.color ?? 'gray'}-6)`} size={14} /><div><Text size="sm" fw={600}>{r.name}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>{stripHtml(r.description)}</Text></div>{r.is_system && <Badge size="xs" variant="outline">{t('roles.system')}</Badge>}</Group>) },
    { key: 'code', label: t('common.code'), sortable: true, visibleFrom: 'sm' },
    { key: 'level', label: t('roles.level'), sortable: true },
    { key: 'users_count', label: t('roles.users_count') },
    { key: 'is_active', label: t('common.status'), render: (r) => <Badge color={r.is_active ? 'green' : 'gray'} variant="light">{r.is_active ? t('common.active') : t('common.inactive')}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t('roles.title')} description={t('roles.level_hint')}
        actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('roles.new')}</Button> : undefined} />

      <Tabs defaultValue="matrix" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="matrix" leftSection={<IconLayoutGrid size={16} />}>{t('roles.matrix')}</Tabs.Tab>
          <Tabs.Tab value="list" leftSection={<IconList size={16} />}>{t('roles.list')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="matrix">
          <Text size="sm" c="dimmed" mb="sm">{t('roles.matrix_hint')}</Text>
          <Paper withBorder>
            <ScrollArea type="auto" offsetScrollbars>
              <Table verticalSpacing={6} miw={Math.max(640, 260 + sorted.length * 110)}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 2, minWidth: 260 }}>{t('roles.permission')}</Table.Th>
                    {sorted.map((r) => (
                      <Table.Th key={r.id} ta="center" style={{ minWidth: 110 }}>
                        <Stack gap={2} align="center">
                          <Badge color={r.color ?? 'gray'} variant="filled" size="sm">{r.name}</Badge>
                          <Text size="10px" c="dimmed">{t('common.level')} {r.level}</Text>
                          {lockedFor(r) && <Tooltip label={t('roles.locked')}><IconLock size={12} /></Tooltip>}
                        </Stack>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {grouped.map((g) => (
                    <GroupRows key={g.label} group={g} roles={sorted} lockedFor={lockedFor} onToggle={(role, permissionId, on) => toggle.mutate({ role, permissionId, on })} can={can} />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="list">
          <DataList<RoleRow> title={t('roles.title')} endpoint="/roles" queryKey="roles" columns={columns} defaultSort={{ key: 'level', direction: 'desc' }}
            rowActions={(r) => <>
              {manage && r.level <= (me?.level ?? 0) && <RowIconButton label={t('common.edit')} onClick={() => open(r)}><IconEdit size={18} /></RowIconButton>}
              {manage && !r.is_system && r.level <= (me?.level ?? 0) && <RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(r)}><IconTrash size={18} /></RowIconButton>}
            </>} />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('roles.new') : t('roles.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start">
              <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
              <TextInput label={t('common.code')} required disabled={editing !== 'new' && (editing as RoleRow)?.is_system} {...form.getInputProps('code')} />
            </Group>
            <Group grow align="flex-start">
              <NumberInput label={t('roles.level')} min={1} max={me?.level ?? 100} required {...form.getInputProps('level')} />
              <Select label={t('common.color')} data={MANTINE_COLORS} {...form.getInputProps('color')} />
            </Group>
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} error={form.errors.description as string} />
            <MultiSelect label={t('roles.widgets')} searchable
              data={(widgets.data ?? []).map((w) => ({ value: w.id, label: t(w.name_key) }))} {...form.getInputProps('widget_ids')} />
            <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={save.isPending}>{t('common.save')}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <ConfirmModal opened={!!deleting} onClose={() => setDeleting(null)} loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}

function GroupRows({ group, roles, lockedFor, onToggle, can }: {
  group: { label: string; items: PermissionRow[] }; roles: RoleRow[]; lockedFor: (r: RoleRow) => boolean;
  onToggle: (role: RoleRow, permissionId: string, on: boolean) => void; can: (p: string) => boolean;
}) {
  return (
    <>
      <Table.Tr bg="var(--mantine-color-default-hover)">
        <Table.Td colSpan={roles.length + 1} style={{ position: 'sticky', left: 0 }}><Text size="xs" fw={700} tt="uppercase" c="brand.7">{group.label}</Text></Table.Td>
      </Table.Tr>
      {group.items.map((p) => (
        <Table.Tr key={p.id}>
          <Table.Td style={{ position: 'sticky', left: 0, background: 'var(--mantine-color-body)', zIndex: 1 }}>
            <Text size="sm">{p.name}</Text><Text size="10px" c="dimmed">{p.code}</Text>
          </Table.Td>
          {roles.map((r) => (
            <Table.Td key={r.id} ta="center">
              <Box display="inline-block">
                <Checkbox checked={r.permission_ids?.includes(p.id) ?? false} disabled={lockedFor(r) || !can(p.code)} aria-label={`${r.name}: ${p.name}`}
                  onChange={(e) => onToggle(r, p.id, e.currentTarget.checked)} />
              </Box>
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}
