import { Alert, Badge, Button, Drawer, FileButton, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArchive, IconDoorEnter, IconEdit, IconGavel, IconMapPin, IconPlayerPause, IconPlus, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { FileDrawer } from '@/components/FileDrawer';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadModal } from '@/components/UploadModal';
import { fmtDateTime, formatBytes } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { FileRow, LV, Paginated } from '@/types';

interface RecordRow {
  id: string; reference: string; title: string; format: LV; category: LV; status: LV; classification: LV; department_id: string | null; department: string | null;
  custodian: { id: string; name: string } | null; location_id: string | null; location: string | null; record_date: string; client_name: string | null; project_name: string | null;
  index_code: string; digital_name: string | null; became_inactive_on: string | null; transfer_due_on: string | null; archived_on: string | null; retention_until: string | null;
  transfer_overdue: boolean; disposal_due: boolean; legal_hold: boolean; hold_reason: string | null; description?: string | null;
}
interface RecordDetail extends RecordRow {
  retention_years: number; checked_out_to: { name: string; since: string | null; due_back_on: string | null } | null;
  events: { id: number; type: string; type_label: string; user: string | null; note: string | null; from: string | null; to: string | null; created_at: string }[];
}

const empty = { title: '', format_id: null as string | null, category_id: null as string | null, classification_id: null as string | null, department_id: null as string | null, custodian_id: null as string | null,
  location_id: null as string | null, record_date: new Date().toISOString().slice(0, 10), client_name: '', project_name: '', status_code: 'active', description: '' };

export function RecordsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('archive.manage');
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<string>(params.get('due') === 'transfer' ? 'transfer' : 'all');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecordRow | 'new' | null>(null);
  const [dialog, setDialog] = useState<'inactive' | 'transfer' | 'move' | 'hold' | 'access' | 'import' | 'upload' | null>(null);
  const [locId, setLocId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; errors: { line: number; message: string }[] } | null>(null);

  useEffect(() => { if (params.has('due')) { params.delete('due'); setParams(params, { replace: true }); } }, [params, setParams]);

  const formats = useLookup('record_format'); const cats = useLookup('record_category'); const statuses = useLookup('record_status'); const classes = useLookup('file_classification');
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const locs = useQuery({ queryKey: ['loc-options'], enabled: can('location.view'), queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/locations', { params: { per_page: 100 } })).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: manage && can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });
  const detail = useQuery({ queryKey: ['record', open], enabled: !!open, queryFn: async () => (await api.get<{ data: RecordDetail }>(`/records/${open}`)).data.data });
  const files = useQuery({ queryKey: ['record-files', open], enabled: !!open, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/records/${open}/attachments`)).data.data });
  const r = detail.data;
  const locOptions = (locs.data ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }));

  const form = useForm({ initialValues: empty, validate: { title: (v) => (v.trim() ? null : t('case.subject')), format_id: (v) => (v ? null : t('rec.format')), category_id: (v) => (v ? null : t('rec.category')) } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['records'] }); void qc.invalidateQueries({ queryKey: ['record'] }); void qc.invalidateQueries({ queryKey: ['record-files'] }); };

  const startEdit = (x: RecordRow | 'new') => {
    setEditing(x);
    form.setValues(x === 'new' ? { ...empty, classification_id: classes.items.find((c) => c.code === 'internal')?.id ?? null } : {
      title: x.title, format_id: x.format.id, category_id: x.category.id, classification_id: x.classification.id, department_id: x.department_id, custodian_id: x.custodian?.id ?? null,
      location_id: x.location_id, record_date: x.record_date, client_name: x.client_name ?? '', project_name: x.project_name ?? '', status_code: 'active', description: x.description ?? '' });
  };

  const save = useMutation({
    mutationFn: async (v: typeof empty) => editing === 'new' ? api.post('/records', v) : api.patch(`/records/${(editing as RecordRow).id}`, v),
    onSuccess: () => { toastOk(); setEditing(null); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const act = useMutation({
    mutationFn: async (a: { path: string; body?: Record<string, unknown> }) => api.post(`/records/${open}/${a.path}`, a.body ?? {}),
    onSuccess: () => { toastOk(); setDialog(null); setText(''); refresh(); }, onError: toastError,
  });
  const requestAccess = useMutation({
    mutationFn: async () => api.post('/archive-access', { record_id: open, purpose: text, due_back_on: due || null }),
    onSuccess: () => { toastOk(); setDialog(null); setText(''); setDue(''); void qc.invalidateQueries({ queryKey: ['archive-access'] }); }, onError: toastError,
  });
  const doImport = useMutation({
    mutationFn: async (file: File) => { const fd = new FormData(); fd.append('file', file); return (await api.post('/records/import', fd)).data; },
    onSuccess: (x) => { setImportResult(x); refresh(); }, onError: toastError,
  });

  const physical = r && ['physical', 'hybrid'].includes(r.format.code);
  const columns: Column<RecordRow>[] = [
    { key: 'reference', label: t('case.reference'), sortable: true, render: (x) => <Badge variant="outline" ff="monospace">{x.reference}</Badge> },
    { key: 'title', label: t('case.subject'), sortable: true, render: (x) => <div><Group gap={6} wrap="nowrap"><Text size="sm" fw={600} lineClamp={1}>{x.title}</Text>{x.legal_hold && <Badge size="xs" color="red">{t('files.legal_hold')}</Badge>}</Group><Text size="xs" c="dimmed" ff="monospace">{x.index_code}</Text></div> },
    { key: 'category', label: t('rec.category'), visibleFrom: 'md', render: (x) => <Badge variant="light" color={x.category.color ?? 'gray'}>{x.category.label}</Badge> },
    { key: 'format', label: t('rec.format'), visibleFrom: 'lg', render: (x) => x.format.label },
    { key: 'status', label: t('common.status'), render: (x) => <StatusBadge label={x.status.label} color={x.status.color} /> },
    { key: 'retention_until', label: t('rec.retention_until'), sortable: true, visibleFrom: 'md', render: (x) => <Text size="sm" c={x.disposal_due ? 'orange' : undefined} fw={x.disposal_due ? 700 : 400}>{x.retention_until ?? '—'}</Text> },
    { key: 'location', label: t('asset.location'), visibleFrom: 'lg', render: (x) => <Text size="xs">{x.location ?? '—'}{x.transfer_overdue && <Badge ml={4} size="xs" color="red">{t('rec.overdue')}</Badge>}</Text> },
  ];
  const extra = view === 'transfer' ? { due: 'transfer' } : view === 'disposal' ? { due: 'disposal' } : view === 'hold' ? { hold: 1 } : undefined;

  return (
    <>
      <PageHeader title={t('rec.title')} />
      <DataList<RecordRow> title={t('rec.title')} endpoint="/records" queryKey="records" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }} extraParams={extra} onRowClick={(x) => setOpen(x.id)}
        filters={[{ key: 'category_id', label: t('rec.category'), options: cats.options }, { key: 'format_id', label: t('rec.format'), options: formats.options }, { key: 'status_id', label: t('common.status'), options: statuses.options },
          { key: 'department_id', label: t('users.department'), options: (depts.data ?? []).map((d) => ({ value: d.id, label: d.name })) }, { key: 'location_id', label: t('asset.location'), options: locOptions }]}
        toolbar={<>
          <SegmentedControl value={view} onChange={setView} data={[{ value: 'all', label: t('rec.filter_all') }, { value: 'transfer', label: t('rec.filter_transfer') }, { value: 'disposal', label: t('rec.filter_disposal') }, { value: 'hold', label: t('rec.filter_hold') }]} />
          {manage && <Button variant="default" leftSection={<IconUpload size={16} />} onClick={() => { setImportResult(null); setDialog('import'); }}>{t('common.import')}</Button>}
          {manage && <Button leftSection={<IconPlus size={16} />} onClick={() => startEdit('new')}>{t('rec.new')}</Button>}
        </>} />

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={r ? <Group gap="xs"><Badge variant="outline" ff="monospace">{r.reference}</Badge><StatusBadge label={r.status.label} color={r.status.color} />{r.legal_hold && <Badge color="red" leftSection={<IconGavel size={12} />}>{t('files.legal_hold')}</Badge>}</Group> : ''}>
        {r && (
          <Stack gap="md">
            <Text fz="lg" fw={700}>{r.title}</Text>
            {r.checked_out_to && <Alert color="orange" variant="light">{t('rec.checked_out', { name: r.checked_out_to.name })}{r.checked_out_to.due_back_on ? ` · ${r.checked_out_to.due_back_on}` : ''}</Alert>}
            {r.legal_hold && <Alert color="red" variant="light">{r.hold_reason}</Alert>}
            <Group gap="xs">
              {manage && r.status.code !== 'disposed' && r.status.code !== 'disposal_pending' && <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => startEdit(r)}>{t('common.edit')}</Button>}
              {manage && r.status.code === 'active' && <Button variant="default" leftSection={<IconPlayerPause size={16} />} onClick={() => { setDue(''); setDialog('inactive'); }}>{t('rec.mark_inactive')}</Button>}
              {manage && r.status.code === 'inactive' && <Button leftSection={<IconArchive size={16} />} onClick={() => { setLocId(r.location_id); setDialog('transfer'); }}>{t('rec.transfer')}</Button>}
              {manage && physical && ['inactive', 'archived'].includes(r.status.code) && <Button variant="default" leftSection={<IconMapPin size={16} />} onClick={() => { setLocId(r.location_id); setDialog('move'); }}>{t('rec.move')}</Button>}
              {manage && r.status.code !== 'disposed' && !r.legal_hold && <Button color="red" variant="light" leftSection={<IconGavel size={16} />} onClick={() => { setText(''); setDialog('hold'); }}>{t('rec.hold')}</Button>}
              {can('archive.approve_disposal') && r.legal_hold && <Button variant="default" onClick={() => act.mutate({ path: 'release' })}>{t('rec.release')}</Button>}
              {physical && ['inactive', 'archived'].includes(r.status.code) && !r.checked_out_to && <Button variant="light" leftSection={<IconDoorEnter size={16} />} onClick={() => { setText(''); setDue(''); setDialog('access'); }}>{t('rec.request_access')}</Button>}
            </Group>

            <Stack gap={6}>
              {[[t('rec.index_code'), r.index_code], [t('rec.category'), r.category.label], [t('rec.format'), r.format.label], [t('files.classification'), r.classification.label], [t('users.department'), r.department],
                [t('rec.custodian'), r.custodian?.name], [t('asset.location'), r.location], [t('rec.date'), r.record_date], [t('rec.client'), r.client_name], [t('rec.project'), r.project_name], [t('rec.digital_name'), r.digital_name],
                [t('rec.inactive_since'), r.became_inactive_on], [t('rec.transfer_due'), r.transfer_due_on], [t('rec.archived_on'), r.archived_on], [t('rec.retention_until'), r.retention_until ? `${r.retention_until} (${t('rec.retention_years', { years: r.retention_years })})` : null]]
                .filter(([, v]) => v).map(([l, v]) => <Group key={String(l)} gap="xs" wrap="nowrap" align="flex-start"><Text size="xs" c="dimmed" tt="uppercase" fw={700} w={150} style={{ flexShrink: 0 }}>{l}</Text><Text size="sm" ff={l === t('rec.index_code') || l === t('rec.digital_name') ? 'monospace' : undefined}>{v}</Text></Group>)}
            </Stack>
            {r.description && <SafeHtml html={r.description} />}

            <Group justify="space-between"><Text fw={700}>{t('rec.attachments')}</Text>{manage && can('file.upload') && r.status.code !== 'disposed' && <Button size="compact-sm" variant="light" onClick={() => setDialog('upload')}>{t('files.attach')}</Button>}</Group>
            {(files.data ?? []).length === 0 ? <Text size="sm" c="dimmed">{t('files.no_files')}</Text> : (files.data ?? []).map((f) => (
              <Group key={f.id} gap="sm" wrap="nowrap" style={{ cursor: 'pointer' }} onClick={() => setOpenFile(f.id)}><FileTypeIcon ext={f.extension} size={30} /><div><Text size="sm" fw={600} lineClamp={1}>{f.name}</Text><Text size="xs" c="dimmed">{formatBytes(f.size_bytes)} · {timeAgo(f.created_at)}</Text></div></Group>
            ))}

            <Text fw={700}>{t('rec.history')}</Text>
            <Stack gap="xs">{r.events.map((e) => (
              <Group key={e.id} justify="space-between" wrap="nowrap" align="flex-start"><div><Text size="sm" fw={600}>{e.type_label}</Text><Text size="xs" c="dimmed">{[e.from, e.to].filter(Boolean).join(' → ')}{e.note ? ` · ${e.note}` : ''}</Text></div>
                <Text size="xs" c="dimmed" ta="right" title={fmtDateTime(e.created_at, i18n.language)}>{e.user ?? '—'} · {timeAgo(e.created_at)}</Text></Group>))}</Stack>
          </Stack>
        )}
      </Drawer>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('rec.new') : t('rec.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('case.subject')} required {...form.getInputProps('title')} />
            <Group grow align="flex-start"><Select label={t('rec.format')} required data={formats.options} {...form.getInputProps('format_id')} /><Select label={t('rec.category')} required data={cats.options} {...form.getInputProps('category_id')} /></Group>
            <Group grow align="flex-start"><TextInput type="date" label={t('rec.date')} required max={new Date().toISOString().slice(0, 10)} {...form.getInputProps('record_date')} /><Select label={t('files.classification')} data={classes.options} {...form.getInputProps('classification_id')} /></Group>
            <Group grow align="flex-start"><TextInput label={t('rec.client')} {...form.getInputProps('client_name')} /><TextInput label={t('rec.project')} {...form.getInputProps('project_name')} /></Group>
            <Group grow align="flex-start">
              <Select label={t('users.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
              <Select label={t('rec.custodian')} clearable searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...form.getInputProps('custodian_id')} />
            </Group>
            <Select label={t('asset.location')} clearable searchable data={locOptions} {...form.getInputProps('location_id')} />
            {editing === 'new' && <Select label={t('rec.initial_status')} description={t('rec.legacy_hint')} allowDeselect={false} data={['active', 'inactive', 'archived'].map((c) => ({ value: c, label: statuses.items.find((s) => s.code === c)?.label ?? c }))} {...form.getInputProps('status_code')} />}
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} minHeight={80} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={dialog === 'inactive'} onClose={() => setDialog(null)} title={t('rec.mark_inactive')} centered>
        <Stack><TextInput type="date" label={t('rec.inactive_since')} value={due} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={act.isPending} onClick={() => act.mutate({ path: 'inactive', body: due ? { date: due } : {} })}>{t('common.confirm')}</Button></Group></Stack>
      </Modal>
      <Modal opened={dialog === 'transfer' || dialog === 'move'} onClose={() => setDialog(null)} title={dialog === 'move' ? t('rec.move') : t('rec.transfer')} centered>
        <Stack><Select label={t('rec.transfer_location')} searchable clearable data={locOptions} value={locId} onChange={setLocId} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={act.isPending} disabled={!!physical && !locId} onClick={() => act.mutate({ path: dialog === 'move' ? 'move' : 'transfer', body: { location_id: locId } })}>{t('common.confirm')}</Button></Group></Stack>
      </Modal>
      <Modal opened={dialog === 'hold'} onClose={() => setDialog(null)} title={t('rec.hold')} centered>
        <Stack><TextInput label={t('rec.hold_reason')} required value={text} maxLength={500} onChange={(e) => setText(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button color="red" disabled={!text.trim()} loading={act.isPending} onClick={() => act.mutate({ path: 'hold', body: { reason: text } })}>{t('rec.hold')}</Button></Group></Stack>
      </Modal>
      <Modal opened={dialog === 'access'} onClose={() => setDialog(null)} title={t('rec.request_access')} centered>
        <Stack><TextInput label={t('arc.purpose')} required value={text} maxLength={500} onChange={(e) => setText(e.currentTarget.value)} /><TextInput type="date" label={t('arc.due_back')} value={due} onChange={(e) => setDue(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button disabled={!text.trim()} loading={requestAccess.isPending} onClick={() => requestAccess.mutate()}>{t('arc.request')}</Button></Group></Stack>
      </Modal>
      <Modal opened={dialog === 'import'} onClose={() => setDialog(null)} title={t('common.import')} centered>
        <Stack><Text size="sm" c="dimmed">{t('rec.import_hint')}</Text>
          <FileButton accept=".csv,.xlsx,text/csv" onChange={(f) => f && doImport.mutate(f)}>{(p) => <Button {...p} loading={doImport.isPending} leftSection={<IconUpload size={16} />}>{t('common.upload')}</Button>}</FileButton>
          {importResult && <Alert color={importResult.errors.length ? 'orange' : 'green'}><Text size="sm" fw={600}>{t('users.import_done', { count: importResult.created })}</Text>{importResult.errors.slice(0, 10).map((e) => <Text key={e.line} size="xs">#{e.line}: {e.message}</Text>)}</Alert>}</Stack>
      </Modal>
      <UploadModal opened={dialog === 'upload'} onClose={() => setDialog(null)} endpoint={`/records/${open}/attachments`} onDone={refresh} />
      <FileDrawer fileId={openFile} onClose={() => setOpenFile(null)} />
    </>
  );
}
