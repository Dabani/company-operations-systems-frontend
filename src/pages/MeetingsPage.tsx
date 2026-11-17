import { Badge, Button, Group, SegmentedControl, Text } from '@mantine/core';
import { IconLock, IconPlus, IconRepeat } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { MeetingFormModal } from '@/components/MeetingFormModal';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MEETING_COLOR, RSVP_COLOR, fmtRange } from '@/lib/meetings';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; title: string; status: string; confidential: boolean; starts_at: string; ends_at: string; timezone: string; room: string | null; venue: string | null; organizer: string | null; recurring: boolean; my_response: string | null }

export function MeetingsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const types = useLookup('meeting_type');
  const [view, setView] = useState('upcoming');
  const [creating, setCreating] = useState(false);
  const now = useMemo(() => new Date().toISOString(), [view]);   // eslint-disable-line react-hooks/exhaustive-deps

  const params: Record<string, unknown> = view === 'upcoming' ? { from: now } : view === 'mine' ? { mine: 1, from: now } : view === 'past' ? { to: now } : {};
  const asc = view !== 'past';

  const columns: Column<Row>[] = [
    { key: 'title', label: t('meet.title'), sortable: true, render: (m) => (
      <div>
        <Group gap={6} wrap="nowrap">{m.confidential && <IconLock size={14} />}<Text size="sm" fw={600}>{m.title}</Text>{m.recurring && <IconRepeat size={14} color="var(--mantine-color-dimmed)" />}</Group>
        <Text size="xs" c="dimmed">{m.code}</Text>
      </div>) },
    { key: 'starts_at', label: t('meet.when'), sortable: true, render: (m) => <Text size="sm">{fmtRange(m.starts_at, m.ends_at, m.timezone, i18n.language)}</Text> },
    { key: 'room', label: t('meet.where'), visibleFrom: 'md', render: (m) => m.room ?? m.venue ?? '—' },
    { key: 'organizer', label: t('meet.organizer'), visibleFrom: 'lg', render: (m) => m.organizer ?? '—' },
    { key: 'status', label: t('common.status'), render: (m) => <StatusBadge label={t(`meet.status.${m.status}`)} color={MEETING_COLOR[m.status]} /> },
    { key: 'my_response', label: t('meet.my_answer'), visibleFrom: 'sm', render: (m) => m.my_response ? <Badge variant="light" color={RSVP_COLOR[m.my_response]}>{t(`meet.rsvp.${m.my_response}`)}</Badge> : null },
  ];

  return (
    <>
      <PageHeader title={t('meet.title_page')} description={t('meet.intro')} />
      <Group mb="md"><SegmentedControl value={view} onChange={setView} data={['upcoming', 'mine', 'past', 'all'].map((x) => ({ value: x, label: t(`meet.view.${x}`) }))} /></Group>
      <DataList<Row> title={t('meet.title_page')} endpoint="/meetings" queryKey="meetings" columns={columns} extraParams={params} defaultSort={{ key: 'starts_at', direction: asc ? 'asc' : 'desc' }} key={view}
        filters={[{ key: 'type_id', label: t('common.type'), options: types.options }]} onRowClick={(m) => nav(`/meetings/${m.id}`)}
        toolbar={can('meeting.create') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('meet.new')}</Button> : undefined} />
      <MeetingFormModal opened={creating} onClose={() => setCreating(false)} onSaved={(id) => nav(`/meetings/${id}`)} />
    </>
  );
}
