import { Card, Group, Progress, SegmentedControl, SimpleGrid, Stack, Switch, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { DataList, type Column } from '@/components/DataList';
import type { FuItem } from '@/components/MeetingFollowUpTab';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { FU_COLOR, fmtDue } from '@/lib/followups';

interface Block { active: number; overdue: number; due_soon: number; finished: number; total: number; rate: number; mine_active: number; mine_overdue: number; by_owner: { name: string | null; count: number }[] }
interface Summary { resolution: Block; action: Block; awaiting_closure: number }

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return <Card withBorder padding="sm"><Text size="xs" c="dimmed">{label}</Text><Text size="xl" fw={700} c={color}>{value}</Text></Card>;
}

/** Follow-up dashboard: what the meetings decided and who still owes what (Guide 6.7). */
export function FollowUpsPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [kind, setKind] = useState<string | null>('action');
  const [scope, setScope] = useState('all');
  const [overdue, setOverdue] = useState(false);
  const s = useQuery({ queryKey: ['followup-summary'], queryFn: async () => (await api.get<{ data: Summary }>('/meeting-followups/summary')).data.data });
  const b = s.data ? s.data[kind === 'resolution' ? 'resolution' : 'action'] : null;
  const columns: Column<FuItem>[] = [
    { key: 'title', label: t('fu.title'), render: (r) => <div><Text size="sm" fw={600}>{r.title}</Text><Text size="xs" c="dimmed">{r.code} · {r.meeting.title}</Text></div> },
    { key: 'who', label: t(kind === 'resolution' ? 'fu.responsible' : 'fu.owner'), visibleFrom: 'sm', render: (r) => (r.kind === 'resolution' ? (r.responsible?.name ?? r.department?.name) : r.owner?.name) ?? '—' },
    { key: 'due_on', label: t('fu.due'), render: (r) => <Text size="sm" c={r.overdue ? 'red' : undefined} fw={r.overdue ? 600 : undefined}>{fmtDue(r.due_on, i18n.language)}{r.overdue ? ` (${t('fu.overdue_days', { n: r.days_overdue })})` : ''}</Text> },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={t(`fu.status.${r.status}`)} color={FU_COLOR[r.status]} /> },
  ];
  return (
    <Stack gap="md">
      <PageHeader title={t('fu.dashboard_title')} description={t('fu.dashboard_intro')} />
      {b && s.data && (
        <>
          <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Tile label={t('fu.tile_active')} value={b.active} />
            <Tile label={t('fu.tile_overdue')} value={b.overdue} color={b.overdue ? 'red' : undefined} />
            <Tile label={t('fu.tile_due_soon')} value={b.due_soon} color={b.due_soon ? 'orange' : undefined} />
            <Tile label={t('fu.tile_mine')} value={`${b.mine_active} (${b.mine_overdue} ${t('fu.late')})`} />
            <Tile label={kind === 'action' ? t('fu.tile_to_verify') : t('fu.tile_finished')} value={kind === 'action' ? s.data.awaiting_closure : b.finished} />
          </SimpleGrid>
          <Card withBorder padding="sm">
            <Group justify="space-between" mb={6}><Text size="sm" fw={600}>{t('fu.completion')}</Text><Text size="sm">{b.rate}%</Text></Group>
            <Progress value={b.rate} color="green" />
            {b.by_owner.length > 0 && <Text size="xs" c="dimmed" mt="xs">{t('fu.overdue_by_owner')}: {b.by_owner.map((o) => `${o.name ?? '—'} (${o.count})`).join(', ')}</Text>}
          </Card>
        </>)}
      <Tabs value={kind} onChange={setKind}>
        <Tabs.List><Tabs.Tab value="action">{t('fu.actions')}</Tabs.Tab><Tabs.Tab value="resolution">{t('fu.resolutions')}</Tabs.Tab></Tabs.List>
      </Tabs>
      <Group>
        <SegmentedControl value={scope} onChange={setScope} data={[{ value: 'all', label: t('fu.scope_all') }, { value: 'mine', label: t('fu.scope_mine') }]} />
        <Switch label={t('fu.only_overdue')} checked={overdue} onChange={(e) => setOverdue(e.currentTarget.checked)} />
      </Group>
      <DataList<FuItem> key={`${kind}-${scope}-${overdue}`} title={t('fu.dashboard_title')} endpoint="/meeting-followups" queryKey="followups" columns={columns} exportable={false}
        extraParams={{ kind, mine: scope === 'mine' ? 1 : undefined, overdue: overdue ? 1 : undefined }} onRowClick={(r) => nav(`/meetings/${r.meeting.id}`)} />
    </Stack>
  );
}
