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
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Loc { id: string; code: string; name: string; description: string | null; parent_id: string | null; parent: string | null; location_type_id: string; location_type: string; is_active: boolean }
const empty = { code: '', name: '', description: '', parent_id: null as string | null, location_type_id: null as string | null, is_active: true };

export function LocationsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('location.manage');
  const types = useLookup('location_type');
  const [editing, setEditing] = useState<Loc | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Loc | null>(null);
  const form = useForm({ initialValues: empty });
  const all = useQuery({ queryKey: ['loc-options'], queryFn: async () => (await api.get<Paginated<Loc>>('/locations', { params: { per_page: 100 } })).data.data });
  const done = () => { void qc.invalidateQueries({ queryKey: ['locations'] }); void qc.invalidateQueries({ queryKey: ['loc-options'] }); };

  const open = (l: Loc | 'new') => { setEditing(l); form.setValues(l === 'new' ? empty : { code: l.code, name: l.name, description: l.description ?? '', parent_id: l.parent_id, location_type_id: l.location_type_id, is_active: l.is_active }); };

  const save = useMutation({
    mutationFn: async (v: typeof empty) => editing === 'new' ? api.post('/locations', v) : api.patch(`/locations/${(editing as Loc).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); done(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (l: Loc) => api.delete(`/locations/${l.id}`), onSuccess: () => { toastOk(); setDeleting(null); done(); }, onError: (e) => { toastError(e); setDeleting(null); } });

  const columns: Column<Loc>[] = [
    { key: 'code', label: t('common.code'), sortable: true, render: (l) => <Badge variant="outline">{l.code}</Badge> },
    { key: 'name', label: t('common.name'), sortable: true, render: (l) => <div><Text size="sm" fw={600}>{l.name}</Text><Text size="xs" c="dimmed" lineClamp={1}>{stripHtml(l.description)}</Text></div> },
    { key: 'location_type', label: t('common.type'), render: (l) => l.location_type },
    { key: 'parent', label: t('common.parent'), visibleFrom: 'sm', render: (l) => l.parent ?? '—' },
    { key: 'is_active', label: t('common.status'), render: (l) => <Badge color={l.is_active ? 'green' : 'gray'} variant="light">{l.is_active ? t('common.active') : t('common.inactive')}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t('locations.title')} />
      <DataList<Loc> title={t('locations.title')} endpoint="/locations" queryKey="locations" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
        filters={[{ key: 'location_type_id', label: t('common.type'), options: types.options }]}
        toolbar={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('locations.new')}</Button> : undefined}
        rowActions={manage ? (l) => <><RowIconButton label={t('common.edit')} onClick={() => open(l)}><IconEdit size={18} /></RowIconButton>
          <RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(l)}><IconTrash size={18} /></RowIconButton></> : undefined} />

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('locations.new') : t('locations.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start">
              <TextInput label={t('common.code')} required {...form.getInputProps('code')} />
              <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            </Group>
            <Group grow align="flex-start">
              <Select label={t('common.type')} required data={types.options} {...form.getInputProps('location_type_id')} />
              <Select label={t('common.parent')} clearable searchable data={(all.data ?? []).filter((l) => editing === 'new' || l.id !== (editing as Loc)?.id).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} {...form.getInputProps('parent_id')} />
            </Group>
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
