import { Badge, Button, Group, SegmentedControl, Stack, Table, Tabs, Text, Paper } from '@mantine/core';
import { IconCloudUpload, IconFiles, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { FileDrawer } from '@/components/FileDrawer';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadModal } from '@/components/UploadModal';
import { fmtDateTime, formatBytes, stripHtml } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { FileRow } from '@/types';

interface Req {
  id: string; file_id: string; file_name: string | null; file_deleted: boolean; legal_hold: boolean; owner: string | null; requested_by: string | null; reason: string | null;
  status: { code: string; label: string; color: string | null }; decided_by: string | null; decision_note: string | null; created_at: string; can_decide: boolean;
}

export function FilesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [reqStatus, setReqStatus] = useState('pending');
  const classes = useLookup('file_classification'); const statuses = useLookup('file_status');

  // Deep link from notifications: /files?open={id}
  useEffect(() => { const id = params.get('open'); if (id) { setOpen(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);

  const reqs = useQuery({ queryKey: ['deletion-requests', reqStatus], queryFn: async () => (await api.get<{ data: Req[] }>('/file-deletion-requests', { params: { status: reqStatus } })).data.data });
  const decide = useMutation({
    mutationFn: async (a: { id: string; what: 'approve' | 'reject' }) => api.post(`/file-deletion-requests/${a.id}/${a.what}`, {}),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['deletion-requests'] }); void qc.invalidateQueries({ queryKey: ['files'] }); },
    onError: toastError,
  });

  const columns: Column<FileRow>[] = [
    { key: 'name', label: t('common.name'), sortable: true, render: (f) => (
      <Group gap="sm" wrap="nowrap"><FileTypeIcon ext={f.extension} /><div style={{ minWidth: 0 }}><Text size="sm" fw={600} lineClamp={1}>{f.name}</Text><Text size="xs" c="dimmed">{f.owner?.name}</Text></div>
        {f.legal_hold && <Badge size="xs" color="red">{t('files.legal_hold')}</Badge>}</Group>) },
    { key: 'classification', label: t('files.classification'), visibleFrom: 'sm', render: (f) => <StatusBadge label={f.classification.label} color={f.classification.color} /> },
    { key: 'size_bytes', label: t('files.size'), sortable: true, visibleFrom: 'md', render: (f) => formatBytes(f.size_bytes) },
    { key: 'version_count', label: t('files.version'), visibleFrom: 'lg', render: (f) => `v${f.version_count}` },
    { key: 'status', label: t('common.status'), render: (f) => <StatusBadge label={f.status.label} color={f.status.color} /> },
    { key: 'created_at', label: t('common.created_at'), sortable: true, visibleFrom: 'lg', render: (f) => fmtDateTime(f.created_at, i18n.language) },
  ];

  return (
    <>
      <PageHeader title={t('files.title')} actions={can('file.upload') ? <Button leftSection={<IconCloudUpload size={16} />} onClick={() => setUploading(true)}>{t('files.upload')}</Button> : undefined} />

      <Tabs defaultValue="library" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="library" leftSection={<IconFiles size={16} />}>{t('files.library')}</Tabs.Tab>
          <Tabs.Tab value="requests" leftSection={<IconTrash size={16} />} rightSection={reqStatus === 'pending' && (reqs.data?.length ?? 0) > 0 ? <Badge size="xs" color="orange" circle>{reqs.data?.length}</Badge> : null}>{t('files.deletion_requests')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="library">
          <DataList<FileRow> title={t('files.title')} endpoint="/files" queryKey="files" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
            extraParams={scope === 'mine' ? { mine: 1 } : undefined} onRowClick={(f) => setOpen(f.id)}
            filters={[{ key: 'classification_id', label: t('files.classification'), options: classes.options }, { key: 'status_id', label: t('common.status'), options: statuses.options }]}
            toolbar={<SegmentedControl value={scope} onChange={(v) => setScope(v as 'all' | 'mine')} data={[{ value: 'all', label: t('files.all') }, { value: 'mine', label: t('files.mine') }]} />} />
        </Tabs.Panel>

        <Tabs.Panel value="requests">
          <Stack>
            <SegmentedControl w="fit-content" value={reqStatus} onChange={setReqStatus} data={[{ value: 'pending', label: t('files.pending') }, { value: 'approved', label: t('files.approved') }, { value: 'rejected', label: t('files.rejected') }]} />
            <Paper withBorder>
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" striped="odd">
                  <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('files.requested_by')}</Table.Th><Table.Th>{t('files.reason')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {(reqs.data ?? []).map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td><Text size="sm" fw={600} style={{ cursor: r.file_deleted ? 'default' : 'pointer' }} onClick={() => !r.file_deleted && setOpen(r.file_id)}>{r.file_name}</Text><Text size="xs" c="dimmed">{t('files.owner')}: {r.owner}</Text></Table.Td>
                        <Table.Td><Text size="sm">{r.requested_by}</Text><Text size="xs" c="dimmed">{fmtDateTime(r.created_at, i18n.language)}</Text></Table.Td>
                        <Table.Td maw={280}><Text size="sm" lineClamp={2}>{stripHtml(r.reason)}</Text></Table.Td>
                        <Table.Td><StatusBadge label={r.status.label} color={r.status.color} />{r.legal_hold && <Badge ml={4} size="xs" color="red">{t('files.legal_hold')}</Badge>}</Table.Td>
                        <Table.Td>{r.can_decide && <Group gap={4} wrap="nowrap">
                          <Button size="compact-xs" color="red" disabled={r.legal_hold} loading={decide.isPending} onClick={() => decide.mutate({ id: r.id, what: 'approve' })}>{t('files.approve')}</Button>
                          <Button size="compact-xs" variant="default" onClick={() => decide.mutate({ id: r.id, what: 'reject' })}>{t('files.reject')}</Button></Group>}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {(reqs.data ?? []).length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">{t('files.pending_none')}</Text>}
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <FileDrawer fileId={open} onClose={() => setOpen(null)} />
      <UploadModal opened={uploading} onClose={() => setUploading(false)} endpoint="/files" onDone={() => void qc.invalidateQueries({ queryKey: ['files'] })} />
    </>
  );
}
