import { Alert, Badge, Button, Drawer, FileButton, Group, Image, Modal, Select, Skeleton, Stack, Switch, Table, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconArchive, IconArchiveOff, IconDownload, IconEdit, IconEye, IconGavel, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, downloadFile } from '@/api/client';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime, formatBytes } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { FileDetail } from '@/types';

interface Comment { id: string; kind: 'comment' | 'deletion_request' | 'decision'; body: string; created_at: string; user: { id: string; name: string } }
interface Act { id: string; action: string; user: string | null; created_at: string }

/** Everything you can do with one file, gated by the abilities the server computed (`can`). */
export function FileDrawer({ fileId, onClose, onChanged }: { fileId: string | null; onClose: () => void; onChanged?: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string | null>('details');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const classes = useLookup('file_classification');

  useEffect(() => { if (fileId) setTab('details'); }, [fileId]);

  const q = useQuery({ queryKey: ['file', fileId], enabled: !!fileId, queryFn: async () => (await api.get<{ data: FileDetail }>(`/files/${fileId}`)).data.data });
  const comments = useQuery({ queryKey: ['file-comments', fileId], enabled: !!fileId && tab === 'comments', queryFn: async () => (await api.get<{ data: Comment[] }>(`/files/${fileId}/comments`)).data.data });
  const activity = useQuery({ queryKey: ['file-activity', fileId], enabled: !!fileId && tab === 'activity', queryFn: async () => (await api.get<{ data: Act[] }>(`/files/${fileId}/activity`)).data.data });
  const f = q.data;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['file', fileId] });
    void qc.invalidateQueries({ queryKey: ['files'] });
    void qc.invalidateQueries({ queryKey: ['case-files'] });
    void qc.invalidateQueries({ queryKey: ['deletion-requests'] });
    void qc.invalidateQueries({ queryKey: ['file-activity', fileId] });
    onChanged?.();
  };
  const act = useMutation({
    mutationFn: async (a: { fn: () => Promise<unknown>; after?: () => void }) => { await a.fn(); return a.after; },
    onSuccess: (after) => { toastOk(); refresh(); after?.(); },
    onError: toastError,
  });

  const form = useForm({ initialValues: { name: '', description: '', classification_id: '' } });
  useEffect(() => { if (f && editing) form.setValues({ name: f.name, description: f.description ?? '', classification_id: f.classification.id }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [editing]);

  const post = useMutation({
    mutationFn: async () => api.post(`/files/${fileId}/comments`, { body: comment }),
    onSuccess: () => { setComment(''); void qc.invalidateQueries({ queryKey: ['file-comments', fileId] }); },
    onError: toastError,
  });

  return (
    <>
      <Drawer opened={!!fileId} onClose={onClose} position="right" size="lg" title={f ? <Group gap="sm"><FileTypeIcon ext={f.extension} size={32} /><Text fw={700} lineClamp={1}>{f.name}</Text></Group> : ''}>
        {!f ? <Stack><Skeleton h={24} /><Skeleton h={120} /></Stack> : (
          <Stack gap="md">
            <Group gap="xs">
              <StatusBadge label={f.classification.label} color={f.classification.color} />
              <StatusBadge label={f.status.label} color={f.status.color} />
              {f.legal_hold && <Badge color="red" leftSection={<IconGavel size={12} />}>{t('files.legal_hold')}</Badge>}
              <Text size="xs" c="dimmed">{formatBytes(f.size_bytes)} · v{f.version_count}</Text>
            </Group>

            {f.pending_deletion && (
              <Alert color="orange" title={t('files.deletion_pending', { name: f.pending_deletion.requested_by })}>
                <SafeHtml html={f.pending_deletion.reason} />
                {f.can.decide_deletion && (
                  <Group mt="sm" gap="xs">
                    <Button size="compact-sm" color="red" onClick={() => setDeciding('approve')}>{t('files.approve')}</Button>
                    <Button size="compact-sm" variant="default" onClick={() => setDeciding('reject')}>{t('files.reject')}</Button>
                  </Group>
                )}
              </Alert>
            )}
            {f.legal_hold && <Alert color="red" variant="light">{t('files.legal_hold_note')}</Alert>}

            <Group gap="xs">
              {f.can.download && <Button leftSection={<IconDownload size={16} />} onClick={() => downloadFile(f.id, f.name).catch(toastError)}>{t('files.download')}</Button>}
              {f.previewable && !f.is_image && <Button variant="default" leftSection={<IconEye size={16} />} component="a" href={`/api/v1/files/${f.id}/preview`} target="_blank" rel="noopener">{t('files.preview')}</Button>}
              {f.can.replace && (
                <FileButton onChange={(file) => file && act.mutate({ fn: () => { const fd = new FormData(); fd.append('file', file); return api.post(`/files/${f.id}/versions`, fd); } })}>
                  {(p) => <Button {...p} variant="default" leftSection={<IconUpload size={16} />}>{t('files.replace')}</Button>}
                </FileButton>
              )}
              {f.can.edit && <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setEditing(true)}>{t('files.edit')}</Button>}
              {f.can.archive && <Button variant="default" leftSection={<IconArchive size={16} />} onClick={() => act.mutate({ fn: () => api.post(`/files/${f.id}/archive`) })}>{t('files.archive')}</Button>}
              {f.can.restore && <Button variant="default" leftSection={<IconArchiveOff size={16} />} onClick={() => act.mutate({ fn: () => api.post(`/files/${f.id}/restore`) })}>{t('files.restore')}</Button>}
              {f.can.request_deletion && !f.pending_deletion && <Button color="red" variant="light" leftSection={<IconTrash size={16} />} disabled={f.legal_hold} onClick={() => { setReason(''); setDeleting(true); }}>{t('files.request_deletion')}</Button>}
            </Group>
            {f.can.legal_hold && <Switch label={f.legal_hold ? t('files.legal_hold_off') : t('files.legal_hold_on')} checked={f.legal_hold} onChange={(e) => act.mutate({ fn: () => api.post(`/files/${f.id}/legal-hold`, { on: e.currentTarget.checked }) })} />}

            <Tabs value={tab} onChange={setTab} keepMounted={false}>
              <Tabs.List><Tabs.Tab value="details">{t('common.details')}</Tabs.Tab><Tabs.Tab value="versions">{t('files.versions')}</Tabs.Tab><Tabs.Tab value="comments">{t('files.comments')}</Tabs.Tab><Tabs.Tab value="activity">{t('files.activity')}</Tabs.Tab></Tabs.List>

              <Tabs.Panel value="details" pt="md">
                <Stack gap="sm">
                  {f.is_image && <Image src={`/api/v1/files/${f.id}/preview`} alt={f.name} radius="md" mah={320} fit="contain" />}
                  <Meta label={t('files.owner')}>{f.owner?.name ?? '—'}</Meta>
                  <Meta label={t('common.created_at')}>{fmtDateTime(f.created_at, i18n.language)}</Meta>
                  {f.description && <Meta label={t('common.description')}><SafeHtml html={f.description} /></Meta>}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="versions" pt="md">
                <Table.ScrollContainer minWidth={420}>
                  <Table verticalSpacing="xs" fz="sm">
                    <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('files.size')}</Table.Th><Table.Th>{t('files.uploaded_by')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {f.versions.map((v) => (
                        <Table.Tr key={v.id}>
                          <Table.Td>v{v.number}</Table.Td>
                          <Table.Td><Text size="sm" lineClamp={1}>{v.name}</Text><Text size="10px" c="dimmed" ff="monospace" title={t('files.sha')}>{v.sha256.slice(0, 16)}…</Text></Table.Td>
                          <Table.Td>{formatBytes(v.size_bytes)}</Table.Td>
                          <Table.Td>{v.uploaded_by}<Text size="10px" c="dimmed">{fmtDateTime(v.created_at, i18n.language)}</Text></Table.Td>
                          <Table.Td>{!v.available ? <Badge color="gray" size="xs">{t('files.unavailable')}</Badge> : f.can.download && <Button size="compact-xs" variant="subtle" onClick={() => downloadFile(f.id, v.name, v.id).catch(toastError)}><IconDownload size={14} /></Button>}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>

              <Tabs.Panel value="comments" pt="md">
                <Stack gap="sm">
                  {(comments.data ?? []).map((c) => (
                    <Stack key={c.id} gap={2} p="xs" style={{ borderLeft: `3px solid var(--mantine-color-${c.kind === 'deletion_request' ? 'orange' : c.kind === 'decision' ? 'blue' : 'gray'}-5)` }}>
                      <Group gap="xs"><Text size="sm" fw={600}>{c.user.name}</Text>{c.kind !== 'comment' && <Badge size="xs" color={c.kind === 'decision' ? 'blue' : 'orange'}>{t(`files.kind.${c.kind}`)}</Badge>}<Text size="xs" c="dimmed">{timeAgo(c.created_at)}</Text></Group>
                      <SafeHtml html={c.body} />
                    </Stack>
                  ))}
                  <RichTextField value={comment} onChange={setComment} minHeight={70} />
                  <Group justify="flex-end"><Button disabled={!comment} loading={post.isPending} onClick={() => post.mutate()}>{t('case.send')}</Button></Group>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="activity" pt="md">
                <Stack gap={6}>
                  {(activity.data ?? []).map((a) => <Group key={a.id} justify="space-between" wrap="nowrap"><Text size="sm" ff="monospace">{a.action}</Text><Text size="xs" c="dimmed" ta="right">{a.user ?? '—'} · {fmtDateTime(a.created_at, i18n.language)}</Text></Group>)}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}
      </Drawer>

      <Modal opened={editing} onClose={() => setEditing(false)} title={t('files.edit')} centered size="lg">
        <form onSubmit={form.onSubmit((v) => act.mutate({ fn: () => api.patch(`/files/${fileId}`, v), after: () => setEditing(false) }))}>
          <Stack gap="sm">
            <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            <Select label={t('files.classification')} data={classes.options} allowDeselect={false} {...form.getInputProps('classification_id')} />
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} minHeight={90} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(false)}>{t('common.cancel')}</Button><Button type="submit" loading={act.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleting} onClose={() => setDeleting(false)} title={t('files.request_deletion')} centered size="lg">
        <Stack gap="sm">
          <Alert variant="light" color="orange">{t('files.deletion_info')}</Alert>
          <RichTextField label={t('files.deletion_reason')} required value={reason} onChange={setReason} minHeight={110} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeleting(false)}>{t('common.cancel')}</Button>
            <Button color="red" disabled={!reason} loading={act.isPending} onClick={() => act.mutate({ fn: () => api.post(`/files/${fileId}/deletion-requests`, { body: reason }), after: () => setDeleting(false) })}>{t('files.request_deletion')}</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={!!deciding} onClose={() => setDeciding(null)} title={deciding === 'approve' ? t('files.approve') : t('files.reject')} centered>
        <Stack gap="sm">
          <TextInput label={t('files.decision_note')} value={note} maxLength={500} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeciding(null)}>{t('common.cancel')}</Button>
            <Button color={deciding === 'approve' ? 'red' : 'brand'} loading={act.isPending}
              onClick={() => act.mutate({ fn: () => api.post(`/file-deletion-requests/${f?.pending_deletion?.id}/${deciding}`, { note }), after: () => { setDeciding(null); setNote(''); if (deciding === 'approve') onClose(); } })}>
              {deciding === 'approve' ? t('files.approve') : t('files.reject')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={2}>{label}</Text><Text size="sm" component="div">{children}</Text></div>;
}
