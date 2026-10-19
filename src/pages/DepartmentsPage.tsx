import { Badge, Button, Group, Modal, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { stripHtml } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Dept { id: string; code: string; name: string; description: string | null; parent_id: string | null; parent: string | null; is_active: boolean }
const empty = { code: '', name: '', description: '', parent_id: null as string | null, is_active: true };

export function DepartmentsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('department.manage');
  const [editing, setEditing] = useState<Dept | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Dept | null>(null);
  const form = useForm({ initialValues: empty });
  const all = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<Dept>>('/departments', { params: { per_page: 100 } })).data.data });
  const done = () => { void qc.invalidateQueries({ queryKey: ['departments'] }); void qc.invalidateQueries({ queryKey: ['dept-options'] }); };

  const open = (d: Dept | 'new') => { setEditing(d); form.setValues(d === 'new' ? empty : { code: d.code, name: d.name, description: d.description ?? '', parent_id: d.parent_id, is_active: d.is_active }); };

  const save = useMutation({
    mutationFn: async (v: typeof empty) => editing === 'new' ? api.post('/departments', v) : api.patch(`/departments/${(editing as Dept).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); done(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (d: Dept) => api.delete(`/departments/${d.id}`), onSuccess: () => { toastOk(); setDeleting(null); done(); }, onError: (e) => { toastError(e); setDeleting(null); } });

  const columns: Column<Dept>[] = [
    { key: 'code', label: t('common.code'), sortable: true, render: (d) => <Badge variant="outline">{d.code}</Badge> },
    { key: 'name', label: t('common.name'), sortable: true, render: (d) => <div><Text size="sm" fw={600}>{d.name}</Text><Text size="xs" c="dimmed" lineClamp={1}>{stripHtml(d.description)}</Text></div> },
    { key: 'parent', label: t('common.parent'), visibleFrom: 'sm', render: (d) => d.parent ?? '—' },
    { key: 'is_active', label: t('common.status'), render: (d) => <Badge color={d.is_active ? 'green' : 'gray'} variant="light">{d.is_active ? t('common.active') : t('common.inactive')}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t('departments.title')} />
      <DataList<Dept> title={t('departments.title')} endpoint="/departments" queryKey="departments" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
        toolbar={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('departments.new')}</Button> : undefined}
        rowActions={manage ? (d) => <><RowIconButton label={t('common.edit')} onClick={() => open(d)}><IconEdit size={18} /></RowIconButton>
          <RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(d)}><IconTrash size={18} /></RowIconButton></> : undefined} />

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('departments.new') : t('departments.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start">
              <TextInput label={t('common.code')} required {...form.getInputProps('code')} />
              <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            </Group>
            <Select label={t('common.parent')} clearable data={(all.data ?? []).filter((d) => editing === 'new' || d.id !== (editing as Dept)?.id).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('parent_id')} />
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} />
            <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <ConfirmModal opened={!!deleting} onClose={() => setDeleting(null)} loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}
