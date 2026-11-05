import { Alert, Badge, Button, Card, Drawer, Group, Modal, Stack, Tabs, Text, Textarea, Timeline } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';

interface Action { step_order: number; decision: string; actor: string; on_behalf_of: string | null; comment: string | null; acted_at: string }
interface Req {
  id: string; title: string; subject_type: string; status: string; current_step: number; steps_total: number; step_label: string | null; flow: string;
  used_default_flow: boolean; requester: string; requester_id: string; amount: string | null; currency_code: string | null; submitted_at: string; actions?: Action[];
}
const COLOR: Record<string, string> = { pending: 'orange', approved: 'green', rejected: 'red', returned: 'yellow', cancelled: 'gray' };

export function ApprovalsPage() {
  const { t } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const [deciding, setDeciding] = useState<{ r: Req; decision: 'approve' | 'reject' | 'return' } | null>(null);
  const [comment, setComment] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const inbox = useQuery({ queryKey: ['approvals-inbox'], enabled: can('approval.act'), queryFn: async () => (await api.get<{ data: Req[] }>('/approvals/inbox')).data.data });
  const detail = useQuery({ queryKey: ['approval', openId], enabled: !!openId, queryFn: async () => (await api.get<{ data: Req }>(`/approvals/${openId}`)).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['approvals-inbox'] }); void qc.invalidateQueries({ queryKey: ['approvals-mine'] }); void qc.invalidateQueries({ queryKey: ['approvals-all'] }); void qc.invalidateQueries({ queryKey: ['approval'] }); };

  const decide = useMutation({
    mutationFn: async () => api.post(`/approvals/${deciding!.r.id}/act`, { decision: deciding!.decision, comment }),
    onSuccess: () => { toastOk(); setDeciding(null); setComment(''); refresh(); }, onError: toastError,
  });
  const simple = useMutation({ mutationFn: async (v: { id: string; verb: 'cancel' | 'resubmit' }) => api.post(`/approvals/${v.id}/${v.verb}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  const columns: Column<Req>[] = [
    { key: 'title', label: t('approvals.title_col'), sortable: true, render: (r) => <div><Text size="sm" fw={600}>{r.title}</Text><Text size="xs" c="dimmed">{t(`approvals.subject.${r.subject_type}`, { defaultValue: r.subject_type })}</Text></div> },
    { key: 'status', label: t('common.status'), render: (r) => <Badge color={COLOR[r.status]} variant="light">{t(`approvals.s.${r.status}`)}</Badge> },
    { key: 'step', label: t('approvals.step'), visibleFrom: 'sm', render: (r) => r.status === 'pending' ? `${r.current_step}/${r.steps_total} · ${r.step_label ?? ''}` : '—' },
    { key: 'requester', label: t('approvals.requester'), visibleFrom: 'md', render: (r) => r.requester },
    { key: 'submitted_at', label: t('approvals.submitted'), sortable: true, visibleFrom: 'md', render: (r) => new Date(r.submitted_at).toLocaleString() },
  ];
  const mineActions = (r: Req) => (
    <Group gap={4} wrap="nowrap">
      <Button size="compact-xs" variant="subtle" onClick={() => setOpenId(r.id)}>{t('approvals.details')}</Button>
      {r.status === 'returned' && <Button size="compact-xs" onClick={() => simple.mutate({ id: r.id, verb: 'resubmit' })}>{t('approvals.resubmit')}</Button>}
      {['pending', 'returned'].includes(r.status) && r.requester_id === me?.id && <Button size="compact-xs" color="red" variant="subtle" onClick={() => simple.mutate({ id: r.id, verb: 'cancel' })}>{t('approvals.cancel')}</Button>}
    </Group>
  );

  return (
    <>
      <PageHeader title={t('approvals.title')} />
      <Tabs defaultValue={can('approval.act') ? 'inbox' : 'mine'}>
        <Tabs.List mb="md">
          {can('approval.act') && <Tabs.Tab value="inbox">{t('approvals.inbox')}{inbox.data?.length ? ` (${inbox.data.length})` : ''}</Tabs.Tab>}
          <Tabs.Tab value="mine">{t('approvals.mine')}</Tabs.Tab>
          {can('approval.view_all') && <Tabs.Tab value="all">{t('approvals.all')}</Tabs.Tab>}
        </Tabs.List>

        {can('approval.act') && <Tabs.Panel value="inbox">
          <Stack gap="sm">
            {inbox.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('approvals.empty')}</Text>}
            {inbox.data?.map((r) => (
              <Card key={r.id} withBorder padding="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <div>
                    <Text fw={600}>{r.title}</Text>
                    <Text size="xs" c="dimmed">{t(`approvals.subject.${r.subject_type}`, { defaultValue: r.subject_type })} · {r.requester} · {r.step_label} ({r.current_step}/{r.steps_total}){r.amount ? ` · ${r.amount} ${r.currency_code ?? ''}` : ''}</Text>
                    {r.used_default_flow && <Text size="xs" c="orange">{t('approvals.default_flow_note')}</Text>}
                  </div>
                  <Group gap="xs">
                    <Button size="xs" variant="default" onClick={() => setOpenId(r.id)}>{t('approvals.details')}</Button>
                    <Button size="xs" color="green" onClick={() => setDeciding({ r, decision: 'approve' })}>{t('approvals.approve')}</Button>
                    <Button size="xs" color="yellow" variant="light" onClick={() => setDeciding({ r, decision: 'return' })}>{t('approvals.return')}</Button>
                    <Button size="xs" color="red" variant="light" onClick={() => setDeciding({ r, decision: 'reject' })}>{t('approvals.reject')}</Button>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Tabs.Panel>}

        <Tabs.Panel value="mine"><DataList<Req> title={t('approvals.mine')} endpoint="/approvals/mine" queryKey="approvals-mine" columns={columns} defaultSort={{ key: 'submitted_at', direction: 'desc' }} exportable={false} rowActions={mineActions} /></Tabs.Panel>
        {can('approval.view_all') && <Tabs.Panel value="all"><DataList<Req> title={t('approvals.all')} endpoint="/approvals" queryKey="approvals-all" columns={columns} defaultSort={{ key: 'submitted_at', direction: 'desc' }} onRowClick={(r) => setOpenId(r.id)} /></Tabs.Panel>}
      </Tabs>

      <Modal opened={!!deciding} onClose={() => setDeciding(null)} title={deciding ? `${t(`approvals.${deciding.decision}`)} — ${deciding.r.title}` : ''} centered>
        <Stack>
          <Textarea label={t('approvals.comment')} description={deciding?.decision === 'approve' ? t('common.optional') : t('approvals.comment_required')} minRows={3} autosize value={comment} onChange={(e) => setComment(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeciding(null)}>{t('common.cancel')}</Button>
            <Button loading={decide.isPending} color={deciding?.decision === 'reject' ? 'red' : deciding?.decision === 'return' ? 'yellow' : 'green'} onClick={() => decide.mutate()}>{t('approvals.decide')}</Button></Group>
        </Stack>
      </Modal>

      <Drawer opened={!!openId} onClose={() => setOpenId(null)} position="right" size="md" title={detail.data?.title ?? t('approvals.details')}>
        {detail.data && <Stack>
          <Group gap="xs"><Badge color={COLOR[detail.data.status]} variant="light">{t(`approvals.s.${detail.data.status}`)}</Badge><Text size="sm" c="dimmed">{detail.data.flow}</Text></Group>
          {detail.data.used_default_flow && <Alert color="orange" variant="light">{t('approvals.default_flow_note')}</Alert>}
          <Text fw={600} size="sm">{t('approvals.history')}</Text>
          <Timeline bulletSize={14} lineWidth={2}>
            {(detail.data.actions ?? []).map((a, i) => (
              <Timeline.Item key={i} title={`${a.actor} — ${t(`approvals.${a.decision}`)}`}>
                {a.on_behalf_of && <Text size="xs" c="dimmed">{t('approvals.on_behalf', { name: a.on_behalf_of })}</Text>}
                {a.comment && <Text size="sm">{a.comment}</Text>}
                <Text size="xs" c="dimmed">{t('approvals.step')} {a.step_order} · {new Date(a.acted_at).toLocaleString()}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Stack>}
      </Drawer>
    </>
  );
}
