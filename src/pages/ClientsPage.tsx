import { Badge, Button, Group, Modal, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';

interface Client { id: string; code: string; name: string; email: string | null; phone: string | null; tax_number: string | null; portal_enabled: boolean; status: string }
const blank = { code: '', name: '', email: '', phone: '', tax_number: '', portal_enabled: false };

export function ClientsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('client.manage');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const form = useForm({ initialValues: blank });
  const done = () => void qc.invalidateQueries({ queryKey: ['clients'] });

  const open = (c: Client | 'new') => { setEditing(c); form.setValues(c === 'new' ? blank : { code: c.code, name: c.name, email: c.email ?? '', phone: c.phone ?? '', tax_number: c.tax_number ?? '', portal_enabled: c.portal_enabled }); };
  const save = useMutation({
    mutationFn: async (v: typeof blank) => editing === 'new' ? api.post('/clients', v) : api.patch(`/clients/${(editing as Client).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); done(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const remove = useMutation({ mutationFn: async (c: Client) => api.delete(`/clients/${c.id}`), onSuccess: () => { toastOk(); setDeleting(null); done(); }, onError: (e) => { toastError(e); setDeleting(null); } });

  const columns: Column<Client>[] = [
    { key: 'code', label: t('common.code'), sortable: true, render: (c) => <Badge variant="outline">{c.code}</Badge> },
    { key: 'name', label: t('common.name'), sortable: true, render: (c) => <div><Text size="sm" fw={600}>{c.name}</Text><Text size="xs" c="dimmed">{c.email ?? ''}</Text></div> },
    { key: 'phone', label: t('common.phone'), visibleFrom: 'sm', render: (c) => c.phone ?? '—' },
    { key: 'portal_enabled', label: t('clients.portal'), visibleFrom: 'md', render: (c) => <Badge color={c.portal_enabled ? 'green' : 'gray'} variant="light">{c.portal_enabled ? t('common.yes') : t('common.no')}</Badge> },
  ];
  return (
    <>
      <PageHeader title={t('clients.title')} />
      <DataList<Client> title={t('clients.title')} endpoint="/clients" queryKey="clients" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
        toolbar={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('clients.new')}</Button> : undefined}
        rowActions={manage ? (c) => <><RowIconButton label={t('common.edit')} onClick={() => open(c)}><IconEdit size={18} /></RowIconButton>
          <RowIconButton label={t('common.delete')} color="red" onClick={() => setDeleting(c)}><IconTrash size={18} /></RowIconButton></> : undefined} />
      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('clients.new') : t('clients.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow><TextInput label={t('common.name')} required {...form.getInputProps('name')} /></Group>
            <Group grow><TextInput label={t('common.email')} {...form.getInputProps('email')} /><TextInput label={t('common.phone')} {...form.getInputProps('phone')} /></Group>
            <TextInput label={t('clients.tax')} {...form.getInputProps('tax_number')} />
            <Switch label={t('clients.portal')} description={t('clients.portal_note')} {...form.getInputProps('portal_enabled', { type: 'checkbox' })} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <ConfirmModal opened={!!deleting} onClose={() => setDeleting(null)} loading={remove.isPending} onConfirm={() => deleting && remove.mutate(deleting)} />
    </>
  );
}
