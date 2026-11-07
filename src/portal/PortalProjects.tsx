import { Alert, Anchor, Badge, Button, Card, Divider, FileButton, Group, Progress, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconDownload, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { papi, pdownload } from './portalApi';

interface Row { id: string; code: string; name: string; status: string; start_date: string | null; end_date: string | null; progress: number }
interface Detail { id: string; code: string; name: string; description: string | null; status: string; start_date: string | null; end_date: string | null; progress: { done: number; total: number; percent: number };
  milestones: { id: string; name: string; due_date: string | null; completed: boolean; progress: number }[];
  deliverables: { id: string; name: string; size_bytes: number; added_at: string; mine: boolean }[];
  comments: { id: string; author: string | null; mine: boolean; staff: boolean; body: string; created_at: string }[];
  features: { uploads: boolean; invoices: boolean } }
interface Inv { id: string; number: string; status: string; issue_date: string | null; due_date: string | null; currency_code: string; total: string; paid_total: string; balance: string }
const money = (v: string, c: string) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
const INV_COLOR: Record<string, string> = { issued: 'blue', partially_paid: 'yellow', paid: 'green', overdue: 'red' };

export function PortalProjectsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['portal-projects'], queryFn: async () => (await papi.get<{ data: Row[] }>('/projects')).data.data });
  return (
    <Stack>
      <Title order={2}>{t('portal.your_projects')}</Title>
      {q.data?.length === 0 && <Text c="dimmed">{t('portal.no_projects')}</Text>}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {q.data?.map((p) => (
          <Card key={p.id} withBorder component={Link} to={`/portal/projects/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Group justify="space-between"><Text fw={600}>{p.name}</Text><Badge variant="light">{t(`projects.ps.${p.status}`, { defaultValue: p.status })}</Badge></Group>
            <Text size="xs" c="dimmed" mb="sm">{p.code}{p.end_date ? ` · ${t('portal.target')}: ${p.end_date}` : ''}</Text>
            <Progress value={p.progress} size="lg" radius="xl" />
            <Text size="xs" mt={4}>{p.progress}%</Text>
          </Card>))}
      </SimpleGrid>
    </Stack>
  );
}

export function PortalProjectPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const q = useQuery({ queryKey: ['portal-project', id], queryFn: async () => (await papi.get<{ data: Detail }>(`/projects/${id}`)).data.data });
  const invoices = useQuery({ queryKey: ['portal-invoices', id], enabled: !!q.data?.features.invoices, queryFn: async () => (await papi.get<{ data: Inv[] }>(`/projects/${id}/invoices`)).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['portal-project', id] });
  const send = useMutation({ mutationFn: async () => papi.post(`/projects/${id}/comments`, { body: comment }), onSuccess: () => { setComment(''); refresh(); }, onError: toastError });
  const upload = useMutation({ mutationFn: async (f: File) => { const fd = new FormData(); fd.append('file', f); return papi.post(`/projects/${id}/files`, fd); }, onSuccess: () => { toastOk(t('portal.uploaded')); refresh(); }, onError: toastError });

  if (!q.data) return null;
  const p = q.data;
  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/portal" size="sm">← {t('portal.your_projects')}</Anchor>
      <div><Group justify="space-between"><Title order={2}>{p.name}</Title><Badge size="lg" variant="light">{t(`projects.ps.${p.status}`, { defaultValue: p.status })}</Badge></Group>
        <Text size="sm" c="dimmed">{p.code}{p.start_date ? ` · ${p.start_date}` : ''}{p.end_date ? ` → ${p.end_date}` : ''}</Text>
        {p.description && <Text mt="xs">{p.description}</Text>}</div>

      <Card withBorder><Text fw={600} mb="xs">{t('portal.progress')}</Text><Progress value={p.progress.percent} size="xl" radius="xl" /><Text size="sm" mt={4}>{p.progress.percent}% · {p.progress.done}/{p.progress.total}</Text></Card>

      {p.milestones.length > 0 && <Card withBorder><Text fw={600} mb="xs">{t('projects.milestones')}</Text><Stack gap="xs">
        {p.milestones.map((m) => <div key={m.id}><Group justify="space-between"><Text size="sm" td={m.completed ? 'line-through' : undefined}>{m.name}</Text><Text size="xs" c="dimmed">{m.due_date ?? ''}</Text></Group><Progress value={m.completed ? 100 : m.progress} size="sm" /></div>)}</Stack></Card>}

      <Card withBorder><Group justify="space-between" mb="xs"><Text fw={600}>{t('portal.deliverables')}</Text>
        {p.features.uploads && <FileButton onChange={(f) => f && upload.mutate(f)} accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt,.csv">{(props) => <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />} loading={upload.isPending}>{t('portal.upload')}</Button>}</FileButton>}</Group>
        {p.deliverables.length === 0 && <Text size="sm" c="dimmed">{t('portal.no_files')}</Text>}
        {p.deliverables.map((f) => <Group key={f.id} justify="space-between"><Text size="sm">{f.name} {f.mine && <Badge size="xs" variant="light">{t('portal.yours')}</Badge>}</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconDownload size={14} />} onClick={() => pdownload(`/projects/${p.id}/files/${f.id}/download`, f.name).catch(toastError)}>{t('portal.download')}</Button></Group>)}</Card>

      {p.features.invoices && <Card withBorder><Text fw={600} mb="xs">{t('billing.title')}</Text>
        {invoices.data?.length === 0 && <Text size="sm" c="dimmed">—</Text>}
        {invoices.data?.map((i) => <Group key={i.id} justify="space-between"><div><Text size="sm" fw={600}>{i.number}</Text><Text size="xs" c="dimmed">{i.issue_date} → {i.due_date}</Text></div>
          <Group gap="xs"><Badge color={INV_COLOR[i.status]} variant="light">{t(`billing.s.${i.status}`)}</Badge><Text size="sm">{money(i.total, i.currency_code)}</Text>
            <Button size="compact-xs" variant="subtle" onClick={() => pdownload(`/projects/${p.id}/invoices/${i.id}/pdf`, `${i.number}.pdf`).catch(toastError)}>PDF</Button></Group></Group>)}</Card>}

      <Card withBorder><Text fw={600} mb="xs">{t('portal.messages')}</Text><Stack gap="sm">
        {p.comments.length === 0 && <Text size="sm" c="dimmed">{t('portal.no_messages')}</Text>}
        {p.comments.map((c) => <div key={c.id}><Text size="xs" c="dimmed">{c.mine ? t('portal.you') : c.author ?? t('portal.team')} · {new Date(c.created_at).toLocaleString()}</Text><Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{c.body}</Text></div>)}
        <Divider /><Textarea placeholder={t('portal.write_message')} autosize minRows={2} value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
        <Group justify="flex-end"><Button disabled={!comment.trim()} loading={send.isPending} onClick={() => send.mutate()}>{t('projects.send')}</Button></Group></Stack></Card>
    </Stack>
  );
}

export function PortalError({ error }: { error: unknown }) { return <Alert color="red" variant="light">{parseError(error).message}</Alert>; }
