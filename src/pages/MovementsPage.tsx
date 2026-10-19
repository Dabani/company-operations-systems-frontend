import { Alert, Badge, Button, Drawer, Group, Modal, MultiSelect, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconFileTypePdf, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, downloadBlob, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV } from '@/types';

interface Row {
  id: string; reference: string; destination: string; status: LV; requester: { id: string; name: string }; approver: string | null;
  departure_date: string; expected_return_date: string | null; is_overdue: boolean; assets_count: number; created_at: string;
}
interface Detail extends Row {
  purpose: string | null; decision_note: string | null; decided_at: string | null; checked_out_at: string | null; returned_at: string | null; return_note: string | null;
  assets: { id: string; asset_tag: string; name: string; serial_number: string | null; condition_out: string | null; condition_in: string | null }[];
}

export function MovementsPage() {
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const statuses = useLookup('movement_status'); const conds = useLookup('asset_condition');
  const [returnConds, setReturnConds] = useState<Record<string, string | null>>({});

  useEffect(() => { const id = params.get('open'); if (id) { setOpen(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);

  const detail = useQuery({ queryKey: ['movement', open], enabled: !!open, queryFn: async () => (await api.get<{ data: Detail }>(`/equipment-movements/${open}`)).data.data });
  const cands = useQuery({ queryKey: ['movement-candidates'], enabled: creating, queryFn: async () => (await api.get<{ data: { id: string; label: string }[] }>('/equipment-movements/candidates')).data.data });
  const m = detail.data;

  const form = useForm({
    initialValues: { asset_ids: [] as string[], destination: '', departure_date: new Date().toISOString().slice(0, 10), expected_return_date: '', description: '' },
    validate: { asset_ids: (v) => (v.length ? null : t('movement.assets')), destination: (v) => (v.trim() ? null : t('movement.destination')) },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['movements'] }); void qc.invalidateQueries({ queryKey: ['movement'] }); void qc.invalidateQueries({ queryKey: ['assets'] }); };

  const create = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post('/equipment-movements', { ...v, expected_return_date: v.expected_return_date || null })).data.data,
    onSuccess: (r) => { toastOk(r.reference); setCreating(false); form.reset(); refresh(); setOpen(r.id); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const act = useMutation({
    mutationFn: async (a: { what: string; body?: Record<string, unknown> }) => api.post(`/equipment-movements/${open}/${a.what}`, a.body ?? {}),
    onSuccess: () => { toastOk(); setNote(''); refresh(); }, onError: toastError,
  });

  const columns: Column<Row>[] = [
    { key: 'reference', label: t('case.reference'), sortable: true, render: (r) => <Badge variant="outline" ff="monospace">{r.reference}</Badge> },
    { key: 'requester', label: t('movement.requested_by'), render: (r) => r.requester.name },
    { key: 'destination', label: t('movement.destination'), visibleFrom: 'sm', render: (r) => <Text size="sm" lineClamp={1}>{r.destination}</Text> },
    { key: 'assets_count', label: t('movement.assets'), visibleFrom: 'md', render: (r) => r.assets_count },
    { key: 'expected_return_date', label: t('movement.return'), sortable: true, visibleFrom: 'md', render: (r) => <Group gap={4} wrap="nowrap">{r.expected_return_date ?? '—'}{r.is_overdue && <Badge size="xs" color="red">{t('movement.overdue')}</Badge>}</Group> },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={r.status.label} color={r.status.color} /> },
  ];

  const mine = m?.requester.id === me?.id;

  return (
    <>
      <PageHeader title={t('movement.title')} />
      <DataList<Row> title={t('movement.title')} endpoint="/equipment-movements" queryKey="movements" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        extraParams={onlyOverdue ? { overdue: 1 } : undefined} onRowClick={(r) => setOpen(r.id)}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]}
        toolbar={<>
          {(can('asset.manage') || can('asset.approve_movement')) && <Switch label={t('movement.only_overdue')} checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.currentTarget.checked)} />}
          {can('asset.request_movement') && <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('movement.new')}</Button>}
        </>} />

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={m ? <Group gap="xs"><Badge variant="outline" ff="monospace">{m.reference}</Badge><StatusBadge label={m.status.label} color={m.status.color} />{m.is_overdue && <Badge color="red">{t('movement.overdue')}</Badge>}</Group> : ''}>
        {m && (
          <Stack gap="md">
            <Group gap="xs">
              <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => downloadBlob(`/equipment-movements/${m.id}/pdf`, `${m.reference}.pdf`).catch(toastError)}>{t('movement.pdf')}</Button>
            </Group>

            <Stack gap={6}>
              <Info l={t('movement.requested_by')} v={m.requester.name} /><Info l={t('movement.destination')} v={m.destination} />
              <Info l={t('movement.departure')} v={m.departure_date} /><Info l={t('movement.return')} v={m.expected_return_date ?? '—'} />
              {m.approver && <Info l={t('movement.approved_by')} v={`${m.approver}${m.decided_at ? ' · ' + fmtDateTime(m.decided_at, i18n.language) : ''}`} />}
              {m.decision_note && <Info l={t('movement.note')} v={m.decision_note} />}
              {m.return_note && <Info l={t('movement.note')} v={m.return_note} />}
            </Stack>
            {m.purpose && <SafeHtml html={m.purpose} />}

            <Table withTableBorder fz="sm"><Table.Thead><Table.Tr><Table.Th>{t('asset.tag')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('asset.condition')}</Table.Th>
              {m.status.code === 'checked_out' && <Table.Th>{t('movement.condition_in')}</Table.Th>}</Table.Tr></Table.Thead>
              <Table.Tbody>{m.assets.map((x) => (
                <Table.Tr key={x.id}><Table.Td ff="monospace">{x.asset_tag}</Table.Td><Table.Td>{x.name}</Table.Td><Table.Td>{x.condition_out}{x.condition_in ? ` → ${x.condition_in}` : ''}</Table.Td>
                  {m.status.code === 'checked_out' && <Table.Td><Select size="xs" data={conds.options} value={returnConds[x.id] ?? null} onChange={(v) => setReturnConds((c) => ({ ...c, [x.id]: v }))} placeholder="—" clearable /></Table.Td>}
                </Table.Tr>))}</Table.Tbody></Table>

            {m.status.code === 'pending' && can('asset.approve_movement') && (
              mine ? <Alert color="gray">{t('movement.four_eyes')}</Alert> : (
                <Stack gap="xs"><TextInput label={t('movement.note')} value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={500} />
                  <Group><Button color="green" loading={act.isPending} onClick={() => act.mutate({ what: 'approve', body: { note } })}>{t('movement.approve')}</Button>
                    <Button variant="default" onClick={() => act.mutate({ what: 'reject', body: { note } })}>{t('movement.reject')}</Button></Group></Stack>
              )
            )}
            {m.status.code === 'pending' && (mine || can('asset.manage')) && <Button variant="subtle" color="gray" w="fit-content" onClick={() => act.mutate({ what: 'cancel' })}>{t('movement.cancel')}</Button>}
            {m.status.code === 'approved' && can('asset.manage') && <Button loading={act.isPending} onClick={() => act.mutate({ what: 'checkout' })}>{t('movement.checkout')}</Button>}
            {m.status.code === 'checked_out' && can('asset.manage') && (
              <Stack gap="xs"><TextInput label={t('movement.note')} value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={500} />
                <Button loading={act.isPending} onClick={() => act.mutate({ what: 'return', body: { return_note: note, conditions: Object.entries(returnConds).filter(([, c]) => c).map(([asset_id, condition_id]) => ({ asset_id, condition_id })) } })}>{t('movement.record_return')}</Button></Stack>
            )}
          </Stack>
        )}
      </Drawer>

      <Modal opened={creating} onClose={() => setCreating(false)} title={t('movement.new')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}>
          <Stack gap="sm">
            <MultiSelect label={t('movement.assets')} required searchable data={(cands.data ?? []).map((c) => ({ value: c.id, label: c.label }))} {...form.getInputProps('asset_ids')} />
            <TextInput label={t('movement.destination')} required {...form.getInputProps('destination')} />
            <Group grow align="flex-start"><TextInput type="date" label={t('movement.departure')} required {...form.getInputProps('departure_date')} /><TextInput type="date" label={t('movement.return')} {...form.getInputProps('expected_return_date')} /></Group>
            <RichTextField label={t('movement.purpose')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} minHeight={90} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('case.send')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}

function Info({ l, v }: { l: string; v: string }) {
  return <Group gap="xs" wrap="nowrap" align="flex-start"><Text size="xs" c="dimmed" tt="uppercase" fw={700} w={130} style={{ flexShrink: 0 }}>{l}</Text><Text size="sm">{v}</Text></Group>;
}
