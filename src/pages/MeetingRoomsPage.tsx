import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RowIconButton } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Room { id: string; name: string; location_id: string | null; location: string | null; capacity: number | null; equipment: string | null; is_active: boolean }
const blank = { name: '', location_id: null as string | null, capacity: '' as number | string, equipment: '', is_active: true };

export function MeetingRoomsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Room | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);
  const form = useForm({ initialValues: blank });
  const rooms = useQuery({ queryKey: ['meeting-rooms'], queryFn: async () => (await api.get<{ data: Room[] }>('/meeting-rooms')).data.data });
  const locations = useQuery({ queryKey: ['loc-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/locations', { params: { per_page: 100 } })).data.data });
  const done = () => { void qc.invalidateQueries({ queryKey: ['meeting-rooms'] }); void qc.invalidateQueries({ queryKey: ['meeting-rooms-options'] }); };

  const open = (r: Room | 'new') => { setEditing(r); form.clearErrors(); form.setValues(r === 'new' ? blank : { name: r.name, location_id: r.location_id, capacity: r.capacity ?? '', equipment: r.equipment ?? '', is_active: r.is_active }); };
  const save = useMutation({
    mutationFn: async (v: typeof blank) => { const body = { ...v, capacity: v.capacity === '' ? null : Number(v.capacity), equipment: v.equipment || null }; return editing === 'new' ? api.post('/meeting-rooms', body) : api.patch(`/meeting-rooms/${(editing as Room).id}`, body); },
    onSuccess: () => { toastOk(); setEditing(null); done(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (r: Room) => api.delete(`/meeting-rooms/${r.id}`), onSuccess: () => { toastOk(); setDeleting(null); done(); }, onError: (e) => { setDeleting(null); toastError(e); } });

  return (
    <>
      <PageHeader title={t('meet.rooms_title')} description={t('meet.rooms_intro')} actions={<Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('meet.new_room')}</Button>} />
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('meet.room_location')}</Table.Th><Table.Th>{t('meet.capacity')}</Table.Th><Table.Th visibleFrom="md">{t('meet.equipment')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(rooms.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td><Text size="sm" fw={600}>{r.name}</Text></Table.Td><Table.Td visibleFrom="sm">{r.location ?? '—'}</Table.Td><Table.Td>{r.capacity ?? '—'}</Table.Td><Table.Td visibleFrom="md"><Text size="xs" c="dimmed" lineClamp={1}>{r.equipment ?? '—'}</Text></Table.Td>
              <Table.Td><Badge variant="light" color={r.is_active ? 'green' : 'gray'}>{r.is_active ? t('common.active') : t('common.inactive')}</Badge></Table.Td>
              <Table.Td><Group gap={2} justify="flex-end" wrap="nowrap"><RowIconButton label={t('common.edit')} onClick={() => open(r)}><IconEdit size={18} /></RowIconButton><RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(r)}><IconTrash size={18} /></RowIconButton></Group></Table.Td>
            </Table.Tr>
          ))}
          {rooms.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('meet.no_rooms')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('meet.new_room') : t('meet.edit_room')} centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <TextInput label={t('common.name')} required maxLength={150} {...form.getInputProps('name')} />
          <Select label={t('meet.room_location')} data={(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))} clearable searchable {...form.getInputProps('location_id')} />
          <NumberInput label={t('meet.capacity')} min={1} max={5000} {...form.getInputProps('capacity')} />
          <TextInput label={t('meet.equipment')} description={t('meet.equipment_hint')} maxLength={1000} {...form.getInputProps('equipment')} />
          <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => deleting && remove.mutate(deleting)} loading={remove.isPending} text={t('meet.delete_room_text', { name: deleting?.name })} />
    </>
  );
}
