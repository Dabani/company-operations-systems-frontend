import { ActionIcon, Badge, Button, Group, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; kind: string; name: string; starts_on: string; ends_on: string; leave_type: string | null }

/** Blackout periods (leave not possible) and recommended periods (a suggestion shown to staff). */
export function LeavePeriodsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const kinds = useLookup('leave_period_kind');
  const types = useLookup('leave_type');
  const [modal, setModal] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const form = useForm({ initialValues: { kind_id: '', name: '', starts_on: '', ends_on: '', leave_type_id: '' } });
  const q = useQuery({ queryKey: ['leave-periods'], queryFn: async () => (await api.get<{ data: Row[] }>('/leave/periods')).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['leave-periods'] });
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/leave/periods', { ...v, leave_type_id: v.leave_type_id || undefined, is_active: true }),
    onSuccess: () => { toastOk(); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/leave/periods/${id}`), onSuccess: () => { toastOk(); setDel(null); refresh(); }, onError: toastError });
  return (
    <>
      <Group justify="space-between" mb="sm"><Text size="sm" c="dimmed">{t('leave.periods_hint')}</Text><Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button></Group>
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('leave.period')}</Table.Th><Table.Th>{t('leave.type')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}><Table.Td fw={500}>{r.name}</Table.Td>
              <Table.Td><Badge color={r.kind === 'blackout' ? 'red' : 'green'} variant="light">{kinds.items.find((k) => k.code === r.kind)?.label ?? r.kind}</Badge></Table.Td>
              <Table.Td>{r.starts_on} → {r.ends_on}</Table.Td><Table.Td>{r.leave_type ? (types.items.find((l) => l.code === r.leave_type)?.label ?? r.leave_type) : t('leave.all_types')}</Table.Td>
              <Table.Td ta="right"><ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => setDel(r)}><IconTrash size={16} /></ActionIcon></Table.Td></Table.Tr>))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('common.no_data')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={modal} onClose={() => setModal(false)} title={t('leave.add_period')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Select label={t('common.type')} required data={kinds.options} {...form.getInputProps('kind_id')} />
          <TextInput label={t('common.name')} required maxLength={150} {...form.getInputProps('name')} />
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.from')} required {...form.getInputProps('starts_on')} /><TextInput type="date" label={t('leave.to')} required {...form.getInputProps('ends_on')} /></Group>
          <Select label={t('leave.type')} description={t('leave.period_type_hint')} clearable data={types.options} {...form.getInputProps('leave_type_id')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!del} onClose={() => setDel(null)} loading={remove.isPending} onConfirm={() => del && remove.mutate(del.id)} />
    </>
  );
}
