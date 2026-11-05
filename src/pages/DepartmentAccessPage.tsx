import { Badge, Button, Group, Modal, Select, Stack, Switch, Table, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { RowIconButton } from '@/components/DataList';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Row { id: string; user: string; department: string | null; scope_level: string; is_head: boolean }

export function DepartmentAccessPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const levels = useLookup('scope_level');
  const rows = useQuery({ queryKey: ['dept-access'], queryFn: async () => (await api.get<{ data: Row[] }>('/department-access')).data.data });
  const users = useQuery({ queryKey: ['user-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100 } })).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const form = useForm({ initialValues: { user_id: '', department_id: null as string | null, scope_level_id: '', is_head: false } });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['dept-access'] });
  const save = useMutation({ mutationFn: async (v: typeof form.values) => api.post('/department-access', v), onSuccess: () => { toastOk(); setOpen(false); refresh(); }, onError: toastError });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/department-access/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('access.title')} description={t('access.intro')} actions={<Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>{t('access.new')}</Button>} />
      <Table.ScrollContainer minWidth={560}><Table withTableBorder striped><Table.Thead><Table.Tr><Table.Th>{t('common.user')}</Table.Th><Table.Th>{t('employees.department')}</Table.Th><Table.Th>{t('access.scope')}</Table.Th><Table.Th>{t('access.head')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>{rows.data?.map((r) => (
          <Table.Tr key={r.id}><Table.Td>{r.user}</Table.Td><Table.Td>{r.department ?? '—'}</Table.Td><Table.Td><Badge variant="light" color={r.scope_level === 'organization' ? 'red' : 'blue'}>{levels.items.find((l) => l.code === r.scope_level)?.label ?? r.scope_level}</Badge></Table.Td>
            <Table.Td>{r.is_head ? <Badge color="green" variant="light">{t('common.yes')}</Badge> : '—'}</Table.Td>
            <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => del.mutate(r.id)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>))}</Table.Tbody></Table></Table.ScrollContainer>
      {rows.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('access.none')}</Text>}

      <Modal opened={open} onClose={() => setOpen(false)} title={t('access.new')} centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <Select label={t('common.user')} required searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...form.getInputProps('user_id')} />
          <Select label={t('access.scope')} required data={levels.options} {...form.getInputProps('scope_level_id')} />
          <Select label={t('employees.department')} clearable searchable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
          <Switch label={t('access.head')} description={t('access.head_note')} {...form.getInputProps('is_head', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
