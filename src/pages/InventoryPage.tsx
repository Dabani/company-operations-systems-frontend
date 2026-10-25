import { Alert, Badge, Button, Drawer, Group, Modal, Pagination, Progress, SegmentedControl, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import type { LV, Paginated } from '@/types';

interface Count { id: string; title: string; status: LV; location: string | null; started_by: string | null; started_at: string; completed_at: string | null; total_expected: number; total_found: number; total_missing: number; checked: number | null; notes: string | null }
interface Item { id: number; found: boolean | null; note: string | null; record: { id: string; reference: string; title: string; index_code: string; location: string | null } }

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [title, setTitle] = useState('');
  const [loc, setLoc] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [state, setState] = useState('unchecked');
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState('');

  const list = useQuery({ queryKey: ['inventories'], queryFn: async () => (await api.get<{ data: Count[] }>('/inventory-counts')).data.data });
  const locs = useQuery({ queryKey: ['loc-options'], queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/locations', { params: { per_page: 100 } })).data.data });
  const detail = useQuery({ queryKey: ['inventory', open], enabled: !!open, queryFn: async () => (await api.get<{ data: Count }>(`/inventory-counts/${open}`)).data.data });
  const items = useQuery({ queryKey: ['inventory-items', open, state, page], enabled: !!open, queryFn: async () => (await api.get<Paginated<Item>>(`/inventory-counts/${open}/items`, { params: { state: state === 'all' ? undefined : state, page, per_page: 20 } })).data });
  useEffect(() => { setPage(1); }, [state, open]);
  const d = detail.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['inventories'] }); void qc.invalidateQueries({ queryKey: ['inventory'] }); void qc.invalidateQueries({ queryKey: ['inventory-items'] }); };

  const start = useMutation({
    mutationFn: async () => (await api.post<{ data: { id: string } }>('/inventory-counts', { title, location_id: loc })).data.data,
    onSuccess: (r) => { toastOk(); setStarting(false); setTitle(''); setLoc(null); refresh(); setOpen(r.id); }, onError: toastError,
  });
  const mark = useMutation({
    mutationFn: async (a: { id: number; found: boolean }) => api.post(`/inventory-counts/${open}/items/${a.id}`, { found: a.found }),
    onSuccess: refresh, onError: toastError,
  });
  const complete = useMutation({
    mutationFn: async () => api.post(`/inventory-counts/${open}/complete`, { notes }),
    onSuccess: () => { toastOk(); refresh(); }, onError: toastError,
  });

  const inProgress = d?.status.code === 'in_progress';
  const pct = d && d.total_expected ? Math.round(((d.checked ?? 0) / d.total_expected) * 100) : 0;

  return (
    <>
      <PageHeader title={t('inv.title')} actions={<Button leftSection={<IconPlus size={16} />} onClick={() => setStarting(true)}>{t('inv.start')}</Button>} />
      <Table.ScrollContainer minWidth={560}>
        <Table highlightOnHover striped="odd" verticalSpacing="sm" withTableBorder>
          <Table.Thead><Table.Tr><Table.Th>{t('inv.name')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('asset.location')}</Table.Th><Table.Th>{t('common.total')}</Table.Th><Table.Th>{t('common.created_at')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{(list.data ?? []).map((c) => (
            <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(c.id)}>
              <Table.Td><Text size="sm" fw={600}>{c.title}</Text><Text size="xs" c="dimmed">{c.started_by}</Text></Table.Td>
              <Table.Td><StatusBadge label={c.status.label} color={c.status.color} /></Table.Td>
              <Table.Td>{c.location ?? '—'}</Table.Td>
              <Table.Td>{c.status.code === 'completed' ? t('inv.summary', { found: c.total_found, missing: c.total_missing }) : t('inv.progress', { checked: c.checked ?? 0, total: c.total_expected })}</Table.Td>
              <Table.Td>{fmtDateTime(c.started_at, i18n.language)}</Table.Td>
            </Table.Tr>))}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="xl" title={d ? <Group gap="xs"><Text fw={700}>{d.title}</Text><StatusBadge label={d.status.label} color={d.status.color} /></Group> : ''}>
        {d && (
          <Stack gap="md">
            <Progress.Root size="lg"><Progress.Section value={pct} color="green"><Progress.Label>{pct}%</Progress.Label></Progress.Section></Progress.Root>
            <Text size="sm" c="dimmed">{d.status.code === 'completed' ? t('inv.summary', { found: d.total_found, missing: d.total_missing }) : t('inv.progress', { checked: d.checked ?? 0, total: d.total_expected })}</Text>
            {inProgress && <Alert variant="light" color="blue">{t('inv.discrepancy_info')}</Alert>}
            {d.total_missing > 0 && d.status.code === 'completed' && <Alert color="red" title={`${t('inv.missing')}: ${d.total_missing}`} />}
            <SegmentedControl value={state} onChange={setState} data={[{ value: 'unchecked', label: t('inv.unchecked') }, { value: 'missing', label: t('inv.missing') }, { value: 'found', label: t('inv.found') }, { value: 'all', label: t('rec.filter_all') }]} />
            <Stack gap="xs">
              {(items.data?.data ?? []).map((i) => (
                <Group key={i.id} justify="space-between" wrap="nowrap" p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
                  <div style={{ minWidth: 0 }}><Text size="sm" fw={600} lineClamp={1}>{i.record.title}</Text><Text size="xs" c="dimmed" ff="monospace">{i.record.reference} · {i.record.index_code}</Text><Text size="xs" c="dimmed">{i.record.location ?? '—'}</Text></div>
                  {inProgress ? (
                    <Group gap={4} wrap="nowrap">
                      <Button size="compact-sm" color="green" variant={i.found === true ? 'filled' : 'light'} leftSection={<IconCheck size={14} />} onClick={() => mark.mutate({ id: i.id, found: true })}>{t('inv.found')}</Button>
                      <Button size="compact-sm" color="red" variant={i.found === false ? 'filled' : 'light'} leftSection={<IconX size={14} />} onClick={() => mark.mutate({ id: i.id, found: false })}>{t('inv.missing')}</Button>
                    </Group>
                  ) : <Badge color={i.found ? 'green' : 'red'} variant="light">{i.found ? t('inv.found') : t('inv.missing')}</Badge>}
                </Group>))}
              {items.data && items.data.meta.last_page > 1 && <Pagination value={page} onChange={setPage} total={items.data.meta.last_page} size="sm" />}
            </Stack>
            {inProgress && <Stack gap="xs"><TextInput label={t('arc.note')} value={notes} maxLength={1000} onChange={(e) => setNotes(e.currentTarget.value)} /><Button loading={complete.isPending} disabled={(d.checked ?? 0) < d.total_expected} onClick={() => complete.mutate()}>{t('inv.complete')}</Button></Stack>}
          </Stack>
        )}
      </Drawer>

      <Modal opened={starting} onClose={() => setStarting(false)} title={t('inv.start')} centered>
        <Stack>
          <TextInput label={t('inv.name')} required value={title} onChange={(e) => setTitle(e.currentTarget.value)} placeholder={`${new Date().getFullYear()} Q${Math.ceil((new Date().getMonth() + 1) / 3)}`} />
          <Select label={t('inv.scope')} clearable searchable data={(locs.data ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} value={loc} onChange={setLoc} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setStarting(false)}>{t('common.cancel')}</Button><Button disabled={!title.trim()} loading={start.isPending} onClick={() => start.mutate()}>{t('inv.start')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
