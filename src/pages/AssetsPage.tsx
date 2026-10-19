import { Alert, Badge, Button, Drawer, FileButton, Grid, Group, Modal, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconArrowsExchange, IconEdit, IconPlus, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface AssetRow {
  id: string; asset_tag: string; name: string; type: LV; status: LV; condition: LV; manufacturer: string | null; model: string | null; serial_number: string | null;
  purchase_date: string | null; purchase_cost: string | null; warranty_expires_on: string | null; warranty_expired: boolean;
  assignee: { id: string; name: string } | null; department_id: string | null; department: string | null; location_id: string | null; location: string | null; notes: string | null;
}
interface AssetDetail extends AssetRow { events: { id: number; type: string; type_label: string; user: string | null; note: string | null; from: string | null; to: string | null; created_at: string }[] }

const empty = { name: '', type_id: null as string | null, condition_id: null as string | null, manufacturer: '', model: '', serial_number: '', purchase_date: '', purchase_cost: '' as number | '', warranty_expires_on: '', department_id: null as string | null, location_id: null as string | null, notes: '' };

export function AssetsPage() {
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const manage = can('asset.manage');
  const [scope, setScope] = useState<'all' | 'mine'>(manage ? 'all' : 'mine');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<AssetRow | 'new' | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [lost, setLost] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { line: number; message: string }[] } | null>(null);
  const [assignUser, setAssignUser] = useState<string | null>(null);
  const [lostKind, setLostKind] = useState<string>('lost');
  const [lostText, setLostText] = useState('');

  const types = useLookup('asset_type'); const statuses = useLookup('asset_status'); const conds = useLookup('asset_condition');
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const locs = useQuery({ queryKey: ['loc-options'], enabled: can('location.view'), queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/locations', { params: { per_page: 100 } })).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: manage && can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });
  const detail = useQuery({ queryKey: ['asset', open], enabled: !!open, queryFn: async () => (await api.get<{ data: AssetDetail }>(`/assets/${open}`)).data.data });
  const a = detail.data;

  const form = useForm({ initialValues: empty, validate: { name: (v) => (v.trim() ? null : t('common.name')), type_id: (v) => (v ? null : t('asset.type')) } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['assets'] }); void qc.invalidateQueries({ queryKey: ['asset'] }); };

  const startEdit = (x: AssetRow | 'new') => {
    setEditing(x);
    form.setValues(x === 'new' ? { ...empty, condition_id: conds.items.find((c) => c.code === 'good')?.id ?? null } : {
      name: x.name, type_id: x.type.id, condition_id: x.condition.id, manufacturer: x.manufacturer ?? '', model: x.model ?? '', serial_number: x.serial_number ?? '',
      purchase_date: x.purchase_date ?? '', purchase_cost: x.purchase_cost ? Number(x.purchase_cost) : '', warranty_expires_on: x.warranty_expires_on ?? '',
      department_id: x.department_id, location_id: x.location_id, notes: x.notes ?? '',
    });
  };

  const save = useMutation({
    mutationFn: async (v: typeof empty) => {
      const body = { ...v, purchase_cost: v.purchase_cost === '' ? null : v.purchase_cost, purchase_date: v.purchase_date || null, warranty_expires_on: v.warranty_expires_on || null, serial_number: v.serial_number || null };
      return editing === 'new' ? api.post('/assets', body) : api.patch(`/assets/${(editing as AssetRow).id}`, body);
    },
    onSuccess: () => { toastOk(); setEditing(null); refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const assign = useMutation({
    mutationFn: async (userId: string | null) => api.post(`/assets/${open}/assign`, { user_id: userId }),
    onSuccess: () => { toastOk(); setAssigning(false); refresh(); }, onError: toastError,
  });
  const report = useMutation({
    mutationFn: async () => (await api.post<{ data: { case_id: string } }>(`/assets/${open}/report-lost`, { kind: lostKind, description: lostText })).data.data,
    onSuccess: (r) => { toastOk(); setLost(false); setLostText(''); refresh(); nav(`/cases/${r.case_id}`); }, onError: toastError,
  });
  const doImport = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); return (await api.post('/assets/import', fd)).data; },
    onSuccess: (r) => { setImportResult(r); refresh(); }, onError: toastError,
  });

  useEffect(() => { if (assigning) setAssignUser(a?.assignee?.id ?? null); }, [assigning, a?.assignee?.id]);

  const columns: Column<AssetRow>[] = [
    { key: 'asset_tag', label: t('asset.tag'), sortable: true, render: (x) => <Badge variant="outline" ff="monospace">{x.asset_tag}</Badge> },
    { key: 'name', label: t('common.name'), sortable: true, render: (x) => <div><Text size="sm" fw={600} lineClamp={1}>{x.name}</Text><Text size="xs" c="dimmed">{[x.manufacturer, x.model].filter(Boolean).join(' ') || x.type.label}</Text></div> },
    { key: 'type', label: t('asset.type'), visibleFrom: 'md', render: (x) => x.type.label },
    { key: 'status', label: t('common.status'), render: (x) => <StatusBadge label={x.status.label} color={x.status.color} /> },
    { key: 'condition', label: t('asset.condition'), visibleFrom: 'lg', render: (x) => <StatusBadge label={x.condition.label} color={x.condition.color} /> },
    { key: 'assignee', label: t('asset.assigned_to'), visibleFrom: 'sm', render: (x) => x.assignee?.name ?? '—' },
    { key: 'location', label: t('asset.location'), visibleFrom: 'lg', render: (x) => x.location ?? '—' },
  ];

  return (
    <>
      <PageHeader title={t('asset.title')} />
      <DataList<AssetRow> title={t('asset.title')} endpoint="/assets" queryKey="assets" columns={columns} defaultSort={{ key: 'asset_tag', direction: 'asc' }}
        extraParams={scope === 'mine' ? { mine: 1 } : undefined} onRowClick={(x) => setOpen(x.id)}
        filters={[
          { key: 'type_id', label: t('asset.type'), options: types.options }, { key: 'status_id', label: t('common.status'), options: statuses.options },
          { key: 'condition_id', label: t('asset.condition'), options: conds.options }, { key: 'department_id', label: t('users.department'), options: (depts.data ?? []).map((d) => ({ value: d.id, label: d.name })) },
        ]}
        toolbar={<>
          {manage && <SegmentedControl value={scope} onChange={(v) => setScope(v as 'all' | 'mine')} data={[{ value: 'all', label: t('asset.all') }, { value: 'mine', label: t('asset.mine') }]} />}
          {manage && <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => { setImportResult(null); setImporting(true); }}>{t('common.import')}</Button>}
          {manage && <Button leftSection={<IconPlus size={16} />} onClick={() => startEdit('new')}>{t('asset.new')}</Button>}
        </>} />

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={a ? <Group gap="xs"><Badge variant="outline" ff="monospace">{a.asset_tag}</Badge><Text fw={700}>{a.name}</Text></Group> : ''}>
        {a && (
          <Stack gap="md">
            <Group gap="xs"><StatusBadge label={a.status.label} color={a.status.color} /><StatusBadge label={a.condition.label} color={a.condition.color} /><Badge variant="light" color="gray">{a.type.label}</Badge>
              {a.warranty_expired && <Badge color="orange" variant="light">{t('asset.warranty_expired')}</Badge>}</Group>
            <Group gap="xs">
              {manage && <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => startEdit(a)}>{t('common.edit')}</Button>}
              {manage && !['lost', 'stolen', 'retired', 'off_site'].includes(a.status.code) && <Button variant="default" leftSection={<IconArrowsExchange size={16} />} onClick={() => setAssigning(true)}>{t('asset.assign')}</Button>}
              {!['lost', 'stolen', 'retired'].includes(a.status.code) && (manage || a.assignee?.id === me?.id) && <Button color="red" variant="light" leftSection={<IconAlertTriangle size={16} />} onClick={() => setLost(true)}>{t('asset.report_lost')}</Button>}
            </Group>
            <Grid gap="sm">
              {[[t('asset.serial'), a.serial_number], [t('asset.assigned_to'), a.assignee?.name], [t('users.department'), a.department], [t('asset.location'), a.location],
                [t('asset.purchase_date'), a.purchase_date], [t('asset.purchase_cost'), a.purchase_cost], [t('asset.warranty'), a.warranty_expires_on]].map(([l, v]) => (
                <Grid.Col key={String(l)} span={6}><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{l}</Text><Text size="sm">{v || '—'}</Text></Grid.Col>
              ))}
            </Grid>
            {a.notes && <SafeHtml html={a.notes} />}
            <Text fw={700}>{t('asset.history')}</Text>
            <Stack gap="xs">
              {a.events.map((e) => (
                <Group key={e.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div><Text size="sm" fw={600}>{e.type_label}</Text><Text size="xs" c="dimmed">{[e.from, e.to].filter(Boolean).join(' → ')}{e.note ? ` · ${e.note}` : ''}</Text></div>
                  <Text size="xs" c="dimmed" ta="right" title={fmtDateTime(e.created_at, i18n.language)}>{e.user ?? '—'} · {timeAgo(e.created_at)}</Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        )}
      </Drawer>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('asset.new') : t('asset.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            <Group grow align="flex-start"><Select label={t('asset.type')} required data={types.options} {...form.getInputProps('type_id')} /><Select label={t('asset.condition')} data={conds.options} {...form.getInputProps('condition_id')} /></Group>
            <Group grow align="flex-start"><TextInput label={t('asset.manufacturer')} {...form.getInputProps('manufacturer')} /><TextInput label={t('asset.model')} {...form.getInputProps('model')} /></Group>
            <TextInput label={t('asset.serial')} {...form.getInputProps('serial_number')} />
            <Group grow align="flex-start"><TextInput type="date" label={t('asset.purchase_date')} {...form.getInputProps('purchase_date')} /><NumberInput label={t('asset.purchase_cost')} min={0} decimalScale={2} {...form.getInputProps('purchase_cost')} /><TextInput type="date" label={t('asset.warranty')} {...form.getInputProps('warranty_expires_on')} /></Group>
            <Group grow align="flex-start">
              <Select label={t('users.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
              <Select label={t('asset.location')} clearable searchable data={(locs.data ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))} {...form.getInputProps('location_id')} />
            </Group>
            <RichTextField label={t('common.description')} value={form.values.notes} onChange={(v) => form.setFieldValue('notes', v)} minHeight={80} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={assigning} onClose={() => setAssigning(false)} title={t('asset.assign')} centered>
        <Stack>
          <Select label={t('asset.assigned_to')} searchable clearable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} value={assignUser} onChange={setAssignUser} />
          <Group justify="space-between">
            <Button variant="subtle" color="gray" loading={assign.isPending} onClick={() => assign.mutate(null)}>{t('asset.return_stock')}</Button>
            <Button disabled={!assignUser} loading={assign.isPending} onClick={() => assign.mutate(assignUser)}>{t('common.save')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={lost} onClose={() => setLost(false)} title={t('asset.report_lost')} size="lg" centered>
        <Stack>
          <Alert color="red" variant="light">{t('asset.lost_hint')}</Alert>
          <Select label={t('asset.kind')} allowDeselect={false} value={lostKind} onChange={(v) => setLostKind(v ?? 'lost')} data={[{ value: 'lost', label: t('asset.kind_lost') }, { value: 'stolen', label: t('asset.kind_stolen') }]} />
          <RichTextField label={t('incident.what')} required value={lostText} onChange={setLostText} minHeight={110} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setLost(false)}>{t('common.cancel')}</Button><Button color="red" disabled={!lostText} loading={report.isPending} onClick={() => report.mutate()}>{t('asset.report_lost')}</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={importing} onClose={() => setImporting(false)} title={t('common.import')} centered>
        <Stack>
          <Text size="sm" c="dimmed">{t('asset.import_hint')}</Text>
          <FileButton accept=".csv,.xlsx,text/csv" onChange={(f) => f && doImport.mutate(f)}>{(p) => <Button {...p} loading={doImport.isPending} leftSection={<IconUpload size={16} />}>{t('common.upload')}</Button>}</FileButton>
          {importResult && <Alert color={importResult.errors.length ? 'orange' : 'green'}><Text size="sm" fw={600}>{t('users.import_done', { count: importResult.created })}</Text>
            {importResult.errors.slice(0, 10).map((e) => <Text key={e.line} size="xs">#{e.line}: {e.message}</Text>)}</Alert>}
        </Stack>
      </Modal>
    </>
  );
}
