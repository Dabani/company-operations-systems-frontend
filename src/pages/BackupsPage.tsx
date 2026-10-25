import { Alert, Badge, Button, Card, Drawer, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { FileRow, LV } from '@/types';

interface Row { id: string; backup_date: string; location: LV; result: LV; verified_by: string; verified_at: string; notes: string | null }
interface Summary { locations: { id: string; label: string; last_date: string | null; last_result: LV | null; days_since: number | null }[]; weeks: { start: string; end: string; locations: Record<string, boolean> }[] }

export function BackupsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('backup.manage');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Row | null>(null);
  const [uploading, setUploading] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);
  const locs = useLookup('backup_location'); const results = useLookup('backup_result');

  const summary = useQuery({ queryKey: ['backup-summary'], queryFn: async () => (await api.get<{ data: Summary }>('/backup-verifications/summary')).data.data });
  const files = useQuery({ queryKey: ['backup-files', open?.id], enabled: !!open, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/backup-verifications/${open!.id}/attachments`)).data.data });

  const form = useForm({
    initialValues: { backup_date: new Date().toISOString().slice(0, 10), location_id: null as string | null, result_id: null as string | null, notes: '' },
    validate: { location_id: (v) => (v ? null : t('bkp.location')), result_id: (v) => (v ? null : t('bkp.result')) },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['backups'] }); void qc.invalidateQueries({ queryKey: ['backup-summary'] }); void qc.invalidateQueries({ queryKey: ['backup-files'] }); void qc.invalidateQueries({ queryKey: ['obligations'] }); };
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/backup-verifications', v),
    onSuccess: () => { toastOk(); setCreating(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const columns: Column<Row>[] = [
    { key: 'backup_date', label: t('bkp.date'), sortable: true, render: (r) => r.backup_date },
    { key: 'location', label: t('bkp.location'), render: (r) => <Badge variant="light" color={r.location.color ?? 'gray'}>{r.location.label}</Badge> },
    { key: 'result', label: t('bkp.result'), render: (r) => <StatusBadge label={r.result.label} color={r.result.color} /> },
    { key: 'verified_by', label: t('bkp.verified_by'), visibleFrom: 'sm', render: (r) => <div><Text size="sm">{r.verified_by}</Text><Text size="xs" c="dimmed">{fmtDateTime(r.verified_at, i18n.language)}</Text></div> },
  ];

  return (
    <>
      <PageHeader title={t('bkp.title')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('bkp.record')}</Button> : undefined} />
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {(summary.data?.locations ?? []).map((l) => (
            <Card key={l.id} padding="md">
              <Group justify="space-between"><Text fw={700}>{l.label}</Text>{l.last_result ? <StatusBadge label={l.last_result.label} color={l.last_result.color} /> : <Badge color="gray">{t('bkp.never')}</Badge>}</Group>
              <Text size="sm" c="dimmed" mt={4}>{t('bkp.last')}: {l.last_date ?? '—'}{l.days_since !== null ? ` (${t('bkp.days_ago', { n: l.days_since })})` : ''}</Text>
              <Text size="xs" c="dimmed" mt="sm" mb={4}>{t('bkp.coverage')}</Text>
              <Group gap={4}>{(summary.data?.weeks ?? []).map((w) => (
                <Tooltip key={w.start} label={`${w.start} → ${w.end}: ${w.locations[l.id] ? t('bkp.verified') : t('bkp.missing')}`}>
                  <div style={{ width: 22, height: 22, borderRadius: 4, background: w.locations[l.id] ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-2)' }} />
                </Tooltip>))}</Group>
            </Card>))}
        </SimpleGrid>

        <DataList<Row> title={t('bkp.title')} endpoint="/backup-verifications" queryKey="backups" columns={columns} defaultSort={{ key: 'backup_date', direction: 'desc' }} onRowClick={setOpen}
          filters={[{ key: 'location_id', label: t('bkp.location'), options: locs.options }, { key: 'result_id', label: t('bkp.result'), options: results.options }]} />
      </Stack>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="md" title={open ? `${open.backup_date} · ${open.location.label}` : ''}>
        {open && (
          <Stack gap="md">
            <Group gap="xs"><StatusBadge label={open.result.label} color={open.result.color} /><Text size="sm" c="dimmed">{open.verified_by} · {fmtDateTime(open.verified_at, i18n.language)}</Text></Group>
            {open.result.code !== 'verified_ok' && <Alert color="orange" variant="light">{open.result.label}</Alert>}
            {open.notes && <SafeHtml html={open.notes} />}
            <Group justify="space-between"><Text fw={700}>{t('bkp.evidence')}</Text>{manage && can('file.upload') && <Button size="compact-sm" variant="light" onClick={() => setUploading(true)}>{t('files.attach')}</Button>}</Group>
            {(files.data ?? []).length === 0 ? <Text size="sm" c="dimmed">{t('files.no_files')}</Text> : (files.data ?? []).map((f) => (
              <Group key={f.id} gap="sm" wrap="nowrap" style={{ cursor: 'pointer' }} onClick={() => setOpenFile(f.id)}><FileTypeIcon ext={f.extension} size={30} /><div><Text size="sm" fw={600} lineClamp={1}>{f.name}</Text><Text size="xs" c="dimmed">{formatBytes(f.size_bytes)}</Text></div></Group>))}
          </Stack>
        )}
      </Drawer>

      <Modal opened={creating} onClose={() => setCreating(false)} title={t('bkp.record')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start"><TextInput type="date" label={t('bkp.date')} required max={new Date().toISOString().slice(0, 10)} {...form.getInputProps('backup_date')} /><Select label={t('bkp.location')} required data={locs.options} {...form.getInputProps('location_id')} /></Group>
            <Select label={t('bkp.result')} required data={results.options} {...form.getInputProps('result_id')} />
            <RichTextField label={t('bkp.notes')} value={form.values.notes} onChange={(v) => form.setFieldValue('notes', v)} minHeight={90} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <UploadModal opened={uploading} onClose={() => setUploading(false)} endpoint={`/backup-verifications/${open?.id}/attachments`} onDone={refresh} />
      <FileDrawer fileId={openFile} onClose={() => setOpenFile(null)} />
    </>
  );
}
