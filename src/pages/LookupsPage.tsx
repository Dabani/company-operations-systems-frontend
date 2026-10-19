import { Alert, Badge, Button, ColorSwatch, Group, Modal, NumberInput, Paper, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RowIconButton } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { LANGS } from '@/i18n';
import { MANTINE_COLORS, toastError, toastOk } from '@/lib/ui';
import type { LookupValue } from '@/types';

interface LType { id: string; code: string; name: string; is_system: boolean }

export function LookupsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('lookup.manage');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LookupValue | 'new' | null>(null);
  const [deleting, setDeleting] = useState<LookupValue | null>(null);

  const types = useQuery({ queryKey: ['lookup-types'], queryFn: async () => (await api.get<{ data: LType[] }>('/lookup-types')).data.data });
  const type = types.data?.find((x) => x.id === typeId);
  const values = useQuery({
    queryKey: ['lookup-admin', type?.code], enabled: !!type,
    queryFn: async () => (await api.get<{ data: LookupValue[] }>('/lookups', { params: { type: type!.code, all: 1 } })).data.data,
  });

  const form = useForm({ initialValues: { code: '', color: 'gray', sort_order: 0, is_active: true, labels: { en: '', fr: '', rw: '', sw: '' } as Record<string, string> } });

  const open = (v: LookupValue | 'new') => {
    setEditing(v);
    form.setValues(v === 'new' ? { code: '', color: 'gray', sort_order: (values.data?.length ?? 0), is_active: true, labels: { en: '', fr: '', rw: '', sw: '' } }
      : { code: v.code, color: v.color ?? 'gray', sort_order: v.sort_order, is_active: v.is_active, labels: { en: '', fr: '', rw: '', sw: '', ...v.labels } });
  };

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['lookup-admin'] }); void qc.invalidateQueries({ queryKey: ['lookup'] }); };

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => editing === 'new' ? api.post('/lookup-values', { ...v, lookup_type_id: typeId }) : api.patch(`/lookup-values/${(editing as LookupValue).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (v: LookupValue) => api.delete(`/lookup-values/${v.id}`), onSuccess: () => { toastOk(); setDeleting(null); refresh(); }, onError: (e) => { toastError(e); setDeleting(null); } });

  const codeLocked = editing !== 'new' && editing !== null && (editing.is_system || editing.is_global);

  return (
    <>
      <PageHeader title={t('lookups.title')} actions={manage && type ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('lookups.new')}</Button> : undefined} />
      <Stack>
        <Select label={t('lookups.type')} placeholder={t('common.select')} searchable data={(types.data ?? []).map((x) => ({ value: x.id, label: x.name }))} value={typeId} onChange={setTypeId} maw={380} />
        <Alert variant="light" icon={<IconInfoCircle size={16} />}>{t('lookups.hint')}</Alert>
        {type && (
          <Paper withBorder>
            <Table.ScrollContainer minWidth={560}>
              <Table verticalSpacing="sm" striped="odd">
                <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t('common.code')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {(values.data ?? []).map((v) => (
                    <Table.Tr key={v.id}>
                      <Table.Td>{v.sort_order}</Table.Td>
                      <Table.Td><Group gap={6} wrap="nowrap"><ColorSwatch size={12} color={`var(--mantine-color-${v.color ?? 'gray'}-6)`} /><Text size="sm" ff="monospace">{v.code}</Text></Group></Table.Td>
                      <Table.Td><Text size="sm">{v.label}</Text></Table.Td>
                      <Table.Td><Group gap={4}><Badge color={v.is_active ? 'green' : 'gray'} variant="light">{v.is_active ? t('common.active') : t('common.inactive')}</Badge>
                        <Badge variant="outline" color="gray">{v.is_global ? t('lookups.global') : 'Org'}</Badge></Group></Table.Td>
                      <Table.Td>{manage && <Group gap={4} wrap="nowrap"><RowIconButton label={t('common.edit')} onClick={() => open(v)}><IconEdit size={18} /></RowIconButton>
                        {!v.is_global && !v.is_system && <RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(v)}><IconTrash size={18} /></RowIconButton>}</Group>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('lookups.new') : t('common.edit')} centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('common.code')} required disabled={codeLocked} {...form.getInputProps('code')} />
            <Text size="sm" fw={600}>{t('lookups.labels')}</Text>
            {LANGS.map((l) => <TextInput key={l.code} label={l.label} required={l.code === 'en'} {...form.getInputProps(`labels.${l.code}`)} />)}
            <Group grow align="flex-start">
              <Select label={t('common.color')} data={MANTINE_COLORS} {...form.getInputProps('color')} />
              <NumberInput label="#" min={0} {...form.getInputProps('sort_order')} />
            </Group>
            <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <ConfirmModal opened={!!deleting} onClose={() => setDeleting(null)} loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}
