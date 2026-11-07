import { Alert, Badge, Button, Group, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import type { FileRow } from '@/types';

interface Cfg { client_id: string | null; portal_visible: boolean; portal_invoices: boolean; portal_uploads: boolean; client_portal_enabled: boolean;
  shares: { file_id: string; name: string | null; by_client: boolean }[];
  comments: { id: string; author: string | null; from_client: boolean; body: string; is_client_visible: boolean; created_at: string }[] }

/** What the project's client can see in the portal, the files shared with them, and the client conversation (internal unless marked visible). */
export function ProjectClientPanel({ projectId, isManager, canComment }: { projectId: string; isManager: boolean; canComment: boolean }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(false);
  const cfg = useQuery({ queryKey: ['project-portal', projectId], queryFn: async () => (await api.get<{ data: Cfg }>(`/projects/${projectId}/portal`)).data.data });
  const files = useQuery({ queryKey: ['project-files', projectId], queryFn: async () => (await api.get<{ data: FileRow[] }>(`/project-files/${projectId}`)).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['project-portal', projectId] });
  const flag = useMutation({ mutationFn: async (v: Record<string, boolean>) => api.put(`/projects/${projectId}/portal`, v), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const share = useMutation({ mutationFn: async (v: { id: string; shared: boolean }) => api.put(`/projects/${projectId}/portal-shares/${v.id}`, { shared: v.shared }), onSuccess: refresh, onError: toastError });
  const post = useMutation({ mutationFn: async () => api.post(`/projects/${projectId}/client-comments`, { body, is_client_visible: visible }), onSuccess: () => { setBody(''); setVisible(false); refresh(); }, onError: toastError });

  const c = cfg.data;
  if (!c) return null;
  if (!c.client_id) return <Alert color="gray" variant="light">{t('cportal.project_no_client')}</Alert>;
  const shared = new Set(c.shares.map((s) => s.file_id));
  return (
    <Stack gap="md">
      {!c.client_portal_enabled && <Alert color="orange" variant="light">{t('cportal.client_portal_off')}</Alert>}
      {isManager && <Stack gap="xs">
        <Switch label={t('cportal.show_project')} description={t('cportal.show_project_note')} checked={c.portal_visible} onChange={(e) => flag.mutate({ portal_visible: e.currentTarget.checked })} />
        <Switch label={t('cportal.invoices')} checked={c.portal_invoices} onChange={(e) => flag.mutate({ portal_invoices: e.currentTarget.checked })} />
        <Switch label={t('cportal.uploads')} checked={c.portal_uploads} onChange={(e) => flag.mutate({ portal_uploads: e.currentTarget.checked })} />
      </Stack>}

      <Stack gap={4}><Text fw={600}>{t('cportal.shared_files')}</Text>
        {files.data?.map((f) => <Group key={f.id} justify="space-between"><Text size="sm">{f.name}</Text>
          <Switch size="sm" disabled={!isManager} checked={shared.has(f.id)} onChange={(e) => share.mutate({ id: f.id, shared: e.currentTarget.checked })} /></Group>)}
        {c.shares.filter((s) => s.by_client).map((s) => <Group key={s.file_id}><Text size="sm">{s.name}</Text><Badge size="xs" variant="light">{t('cportal.from_client')}</Badge></Group>)}
        {files.data?.length === 0 && <Text size="sm" c="dimmed">{t('cportal.no_files')}</Text>}</Stack>

      <Stack gap="xs"><Text fw={600}>{t('cportal.conversation')}</Text>
        {c.comments.map((m) => <div key={m.id}><Group gap={6}><Text size="xs" c="dimmed">{m.author} · {new Date(m.created_at).toLocaleString()}</Text>
          {m.from_client ? <Badge size="xs" color="blue" variant="light">{t('cportal.from_client')}</Badge> : <Badge size="xs" color={m.is_client_visible ? 'green' : 'gray'} variant="light">{m.is_client_visible ? t('cportal.visible') : t('cportal.internal')}</Badge>}</Group>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{m.body}</Text></div>)}
        {canComment && <><Textarea autosize minRows={2} placeholder={t('portal.write_message')} value={body} onChange={(e) => setBody(e.currentTarget.value)} />
          <Group justify="space-between"><Switch label={t('cportal.visible_to_client')} checked={visible} onChange={(e) => setVisible(e.currentTarget.checked)} />
            <Button disabled={!body.trim()} loading={post.isPending} onClick={() => post.mutate()}>{t('projects.send')}</Button></Group></>}</Stack>
    </Stack>
  );
}
