import { Badge, Button, Group, Modal, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconCheck, IconDoorEnter, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface Row {
  id: string; record: { id: string; reference: string; title: string; index_code: string }; requester: { id: string; name: string }; purpose: string; status: LV;
  authorized_by: string | null; decision_note: string | null; accessed_at: string | null; due_back_on: string | null; returned_at: string | null; overdue: boolean; created_at: string;
}

/** Physical archive access register (who took which record, authorised by whom, when it came back). */
export function ArchiveAccessPage() {
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const manage = can('archive.manage');
  const [openOnly, setOpenOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState('');
  const [due, setDue] = useState('');
  const [deciding, setDeciding] = useState<{ row: Row; what: 'authorize' | 'deny' } | null>(null);
  const [note, setNote] = useState('');
  const statuses = useLookup('access_log_status');

  const records = useQuery({
    queryKey: ['records-physical'], enabled: creating,
    queryFn: async () => (await api.get<Paginated<{ id: string; reference: string; title: string; format: LV; status: LV }>>('/records', { params: { per_page: 100, sort: 'reference' } })).data.data,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['archive-access'] });

  const create = useMutation({
    mutationFn: async () => api.post('/archive-access', { record_id: recordId, purpose, due_back_on: due || null }),
    onSuccess: () => { toastOk(); setCreating(false); setPurpose(''); setDue(''); setRecordId(null); refresh(); }, onError: toastError,
  });
  const decide = useMutation({
    mutationFn: async () => api.post(`/archive-access/${deciding!.row.id}/${deciding!.what}`, { note }),
    onSuccess: () => { toastOk(); setDeciding(null); setNote(''); refresh(); }, onError: toastError,
  });
  const giveBack = useMutation({ mutationFn: async (id: string) => api.post(`/archive-access/${id}/return`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  const available = (records.data ?? []).filter((r) => ['physical', 'hybrid'].includes(r.format.code) && ['inactive', 'archived'].includes(r.status.code));

  const columns: Column<Row>[] = [
    { key: 'record', label: t('arc.record'), render: (x) => <div><Text size="sm" fw={600} lineClamp={1}>{x.record.title}</Text><Text size="xs" c="dimmed" ff="monospace">{x.record.reference} · {x.record.index_code}</Text></div> },
    { key: 'requester', label: t('movement.requested_by'), render: (x) => <div><Text size="sm">{x.requester.name}</Text><Text size="xs" c="dimmed" lineClamp={1}>{x.purpose}</Text></div> },
    { key: 'status', label: t('common.status'), render: (x) => <StatusBadge label={x.status.label} color={x.status.color} /> },
    { key: 'authorized_by', label: t('access.granted_by'), visibleFrom: 'md', render: (x) => x.authorized_by ?? '—' },
    { key: 'accessed_at', label: t('arc.accessed'), visibleFrom: 'lg', render: (x) => x.accessed_at ? fmtDateTime(x.accessed_at, i18n.language) : '—' },
    { key: 'due_back_on', label: t('arc.due_back'), visibleFrom: 'md', render: (x) => <Group gap={4} wrap="nowrap">{x.due_back_on ?? '—'}{x.overdue && <Badge size="xs" color="red">{t('rec.overdue')}</Badge>}</Group> },
    { key: 'returned_at', label: t('arc.returned'), visibleFrom: 'lg', render: (x) => x.returned_at ? fmtDateTime(x.returned_at, i18n.language) : '—' },
  ];

  return (
    <>
      <PageHeader title={t('arc.title')} />
      <DataList<Row> title={t('arc.title')} endpoint="/archive-access" queryKey="archive-access" columns={columns} extraParams={openOnly ? { open: 1 } : undefined}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]}
        toolbar={<>
          <Switch label={t('arc.open_only')} checked={openOnly} onChange={(e) => setOpenOnly(e.currentTarget.checked)} />
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('arc.request')}</Button>
        </>}
        rowActions={manage ? (x) => <>
          {x.status.code === 'requested' && x.requester.id !== me?.id && <>
            <RowIconButton label={t('arc.authorize')} color="green" onClick={() => { setNote(''); setDeciding({ row: x, what: 'authorize' }); }}><IconCheck size={18} /></RowIconButton>
            <RowIconButton label={t('arc.deny')} color="red" onClick={() => { setNote(''); setDeciding({ row: x, what: 'deny' }); }}><IconX size={18} /></RowIconButton></>}
          {x.status.code === 'authorized' && <RowIconButton label={t('arc.return')} color="blue" onClick={() => giveBack.mutate(x.id)}><IconDoorEnter size={18} /></RowIconButton>}
        </> : undefined} />

      <Modal opened={creating} onClose={() => setCreating(false)} title={t('arc.request')} centered>
        <Stack>
          <Select label={t('arc.record')} required searchable data={available.map((r) => ({ value: r.id, label: `${r.reference} — ${r.title}` }))} value={recordId} onChange={setRecordId} />
          <TextInput label={t('arc.purpose')} required maxLength={500} value={purpose} onChange={(e) => setPurpose(e.currentTarget.value)} />
          <TextInput type="date" label={t('arc.due_back')} value={due} onChange={(e) => setDue(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button disabled={!recordId || !purpose.trim()} loading={create.isPending} onClick={() => create.mutate()}>{t('arc.request')}</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={!!deciding} onClose={() => setDeciding(null)} title={deciding?.what === 'authorize' ? t('arc.authorize') : t('arc.deny')} centered>
        <Stack>
          <Text size="sm">{deciding?.row.record.reference} — {deciding?.row.requester.name}: {deciding?.row.purpose}</Text>
          <TextInput label={t('arc.note')} value={note} maxLength={500} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeciding(null)}>{t('common.cancel')}</Button><Button color={deciding?.what === 'authorize' ? 'green' : 'red'} loading={decide.isPending} onClick={() => decide.mutate()}>{deciding?.what === 'authorize' ? t('arc.authorize') : t('arc.deny')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
