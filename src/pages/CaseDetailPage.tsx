import { ActionIcon, Badge, Button, Card, Divider, Grid, Group, Select, Skeleton, Stack, Switch, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconArrowLeft, IconArrowsExchange, IconCircleDot, IconMessage2, IconPaperclip, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { FileDrawer } from '@/components/FileDrawer';
import { IncidentPanel } from '@/components/IncidentPanel';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { RichTextField } from '@/components/RichTextField';
import { UploadModal } from '@/components/UploadModal';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { fmtDateTime, formatBytes } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';
import { timeAgo } from '@/lib/time';
import { toastError, toastOk } from '@/lib/ui';
import type { LV, Person } from './CasesPage';
import type { FileRow } from '@/types';

interface Comment { id: string; body: string; is_internal: boolean; created_at: string; user: Person }
interface Evt { id: number; type: string; created_at: string; user: string | null; from: string | null; to: string | null }
interface CaseDetail {
  id: string; reference: string; title: string; description: string | null; type: LV; status: LV; priority: LV; requester: Person;
  assignee: Person | null; department: string | null; due_at: string | null; created_at: string; comments: Comment[]; events: Evt[];
}

export function CaseDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['case', id], queryFn: async () => (await api.get<{ data: CaseDetail }>(`/cases/${id}`)).data.data, refetchInterval: 30_000 });
  const files = useQuery({ queryKey: ['case-files', id], enabled: can('file.view'), queryFn: async () => (await api.get<{ data: FileRow[] }>(`/cases/${id}/attachments`)).data.data });
  const statuses = useLookup('case_status'); const priorities = useLookup('case_priority');
  const agents = useQuery({ queryKey: ['assignees'], enabled: can('case.assign'), queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/cases/assignees')).data.data });

  const c = q.data;
  const staff = can('case.view_all');
  const closed = !!c && ['closed', 'cancelled'].includes(c.status.code);

  const patch = useMutation({
    mutationFn: async (v: Record<string, unknown>) => api.patch(`/cases/${id}`, v),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['case', id] }); void qc.invalidateQueries({ queryKey: ['cases'] }); },
    onError: toastError,
  });
  const comment = useMutation({
    mutationFn: async () => api.post(`/cases/${id}/comments`, { body, is_internal: internal }),
    onSuccess: () => { setBody(''); setInternal(false); void qc.invalidateQueries({ queryKey: ['case', id] }); },
    onError: toastError,
  });

  // One chronological activity feed: tracker events + comments.
  const feed = useMemo(() => {
    if (!c) return [];
    return [
      ...c.events.map((e) => ({ kind: 'event' as const, at: e.created_at, e })),
      ...c.comments.map((m) => ({ kind: 'comment' as const, at: m.created_at, m })),
    ].sort((a, b) => a.at.localeCompare(b.at));
  }, [c]);

  if (q.isLoading || !c) return <Stack><Skeleton h={30} w={260} /><Skeleton h={160} /><Skeleton h={220} /></Stack>;

  return (
    <Stack gap="md">
      <Group gap="xs"><ActionIcon variant="subtle" onClick={() => nav('/cases')} aria-label={t('common.back')}><IconArrowLeft size={20} /></ActionIcon>
        <Badge size="lg" variant="outline" ff="monospace">{c.reference}</Badge><Badge variant="outline" color={c.type.color ?? 'gray'}>{c.type.label}</Badge></Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <Card padding="lg">
              <Group justify="space-between" align="flex-start" wrap="wrap" mb="xs">
                <Text fz="xl" fw={700}>{c.title}</Text>
                <Group gap="xs"><StatusBadge label={c.status.label} color={c.status.color} /><StatusBadge label={c.priority.label} color={c.priority.color} /></Group>
              </Group>
              <SafeHtml html={c.description} />
            </Card>

            {c.type.code === 'incident' && <IncidentPanel caseId={c.id} />}

            {can('file.view') && (
              <Card padding="lg">
                <Group justify="space-between" mb="sm">
                  <Group gap={6}><IconPaperclip size={18} /><Text fw={700}>{t('files.attachments')}</Text></Group>
                  {can('file.upload') && (!closed || staff) && <Button size="compact-sm" variant="light" onClick={() => setAttaching(true)}>{t('files.attach')}</Button>}
                </Group>
                {(files.data ?? []).length === 0 ? <Text size="sm" c="dimmed">{t('files.no_files')}</Text> : (
                  <Stack gap="xs">
                    {(files.data ?? []).map((f) => (
                      <Group key={f.id} gap="sm" wrap="nowrap" style={{ cursor: 'pointer' }} onClick={() => setOpenFile(f.id)}>
                        <FileTypeIcon ext={f.extension} size={30} />
                        <div style={{ minWidth: 0 }}><Text size="sm" fw={600} lineClamp={1}>{f.name}</Text><Text size="xs" c="dimmed">{formatBytes(f.size_bytes)} · {f.owner?.name} · {timeAgo(f.created_at)}</Text></div>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>
            )}

            <Card padding="lg">
              <Text fw={700} mb="md">{t('case.activity')}</Text>
              <Stack gap="md">
                {feed.map((f) => f.kind === 'event' ? (
                  <Group key={`e${f.e.id}`} gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={26} radius="xl" variant="light" color="gray">{f.e.type === 'created' ? <IconCircleDot size={14} /> : <IconArrowsExchange size={14} />}</ThemeIcon>
                    <div><Text size="sm">{t(`case.event.${f.e.type}`, { user: f.e.user ?? '—', from: f.e.from ?? '—', to: f.e.to ?? '—' })}</Text><Text size="xs" c="dimmed">{timeAgo(f.at)}</Text></div>
                  </Group>
                ) : (
                  <Group key={`c${f.m.id}`} gap="sm" wrap="nowrap" align="flex-start">
                    <UserAvatar userId={f.m.user.id} hasAvatar={f.m.user.has_avatar} name={f.m.user.name} size={32} />
                    <Card padding="sm" flex={1} bg={f.m.is_internal ? 'var(--mantine-color-yellow-light)' : undefined}>
                      <Group gap="xs" mb={4}><Text size="sm" fw={600}>{f.m.user.name}</Text>{f.m.is_internal && <Badge size="xs" color="yellow">{t('case.internal_badge')}</Badge>}<Text size="xs" c="dimmed">{timeAgo(f.at)}</Text></Group>
                      <SafeHtml html={f.m.body} />
                    </Card>
                  </Group>
                ))}
              </Stack>

              <Divider my="lg" />
              {closed && !staff ? <Text c="dimmed" size="sm">{t('case.closed_notice')}</Text> : can('case.comment') && (
                <Stack gap="sm">
                  <RichTextField label={t('case.add_comment')} value={body} onChange={setBody} minHeight={90} />
                  <Group justify="space-between">
                    {staff ? <Switch label={t('case.internal')} checked={internal} onChange={(e) => setInternal(e.currentTarget.checked)} /> : <span />}
                    <Button leftSection={<IconMessage2 size={16} />} disabled={!body} loading={comment.isPending} onClick={() => comment.mutate()}>{t('case.send')}</Button>
                  </Group>
                </Stack>
              )}
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card padding="lg">
            <Stack gap="sm">
              <Meta label={t('case.requester')}><Group gap={6}><UserAvatar userId={c.requester.id} hasAvatar={c.requester.has_avatar} name={c.requester.name} size={24} /><Text size="sm">{c.requester.name}{c.requester.id === me?.id ? ' ·' : ''}</Text></Group></Meta>
              <Meta label={t('common.created_at')}><Text size="sm">{fmtDateTime(c.created_at, i18n.language)}</Text></Meta>
              {c.department && <Meta label={t('case.department')}><Text size="sm">{c.department}</Text></Meta>}

              {can('case.update_status') ? (
                <>
                  <Select label={t('common.status')} value={c.status.id} allowDeselect={false}
                    data={statuses.items.map((s) => ({ value: s.id, label: s.label, disabled: ['closed', 'cancelled'].includes(s.code) && !can('case.close') }))}
                    onChange={(v) => v && patch.mutate({ status_id: v })} />
                  <Select label={t('case.priority')} value={c.priority.id} allowDeselect={false} data={priorities.options} onChange={(v) => v && patch.mutate({ priority_id: v })} />
                  <TextInput type="date" label={t('case.due')} defaultValue={c.due_at?.slice(0, 10) ?? ''} onBlur={(e) => { const v = e.currentTarget.value; if ((c.due_at?.slice(0, 10) ?? '') !== v) patch.mutate({ due_at: v || null }); }} />
                </>
              ) : c.due_at && <Meta label={t('case.due')}><Text size="sm">{fmtDateTime(c.due_at, i18n.language)}</Text></Meta>}

              {can('case.assign') ? (
                <Select label={t('case.assignee')} placeholder={t('case.unassigned')} clearable leftSection={<IconUser size={16} />} value={c.assignee?.id ?? null}
                  data={(agents.data ?? []).map((a) => ({ value: a.id, label: a.name }))} onChange={(v) => patch.mutate({ assignee_id: v })} />
              ) : <Meta label={t('case.assignee')}><Text size="sm">{c.assignee?.name ?? t('case.unassigned')}</Text></Meta>}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <UploadModal opened={attaching} onClose={() => setAttaching(false)} endpoint={`/cases/${id}/attachments`} allowRestricted={false}
        onDone={() => void qc.invalidateQueries({ queryKey: ['case-files', id] })} />
      <FileDrawer fileId={openFile} onClose={() => setOpenFile(null)} />
    </Stack>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={2}>{label}</Text>{children}</div>;
}
