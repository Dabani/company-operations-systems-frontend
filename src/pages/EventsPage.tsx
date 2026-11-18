import { Badge, Button, Group, SegmentedControl, Text } from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { EventFormModal } from '@/components/EventFormModal';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { EVENT_COLOR, REG_COLOR } from '@/lib/events';
import { fmtRange } from '@/lib/meetings';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; title: string; status: string; type: string | null; starts_at: string; ends_at: string; timezone: string; venue: string | null; online: boolean; organizer: string | null; capacity: number | null; registered: number; my_status: string | null }

export function EventsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const types = useLookup('event_type');
  const [view, setView] = useState('upcoming');
  const [creating, setCreating] = useState(false);
  const params: Record<string, unknown> = useMemo(() => (view === 'upcoming' ? { upcoming: 1 } : view === 'mine' ? { mine: 1 } : {}), [view]);

  const columns: Column<Row>[] = [
    { key: 'title', label: t('ev.name'), sortable: true, render: (e) => (<div><Text size="sm" fw={600}>{e.title}</Text><Text size="xs" c="dimmed">{e.code}{e.type ? ` · ${t(`ev.type.${e.type}`, { defaultValue: e.type })}` : ''}</Text></div>) },
    { key: 'starts_at', label: t('meet.when'), sortable: true, render: (e) => <Text size="sm">{fmtRange(e.starts_at, e.ends_at, e.timezone, i18n.language)}</Text> },
    { key: 'venue', label: t('ev.venue'), visibleFrom: 'md', render: (e) => e.venue ?? (e.online ? t('ev.online') : '—') },
    { key: 'registered', label: t('ev.registered'), visibleFrom: 'sm', render: (e) => <Group gap={4} wrap="nowrap"><IconUsers size={14} /><Text size="sm">{e.capacity ? `${e.registered} / ${e.capacity}` : e.registered}</Text></Group> },
    { key: 'status', label: t('common.status'), render: (e) => <StatusBadge label={t(`ev.status.${e.status}`)} color={EVENT_COLOR[e.status]} /> },
    { key: 'my_status', label: t('ev.my_registration'), visibleFrom: 'sm', render: (e) => e.my_status ? <Badge variant="light" color={REG_COLOR[e.my_status]}>{t(`ev.reg.${e.my_status}`)}</Badge> : null },
  ];

  return (
    <>
      <PageHeader title={t('ev.title_page')} description={t('ev.intro')} />
      <Group mb="md"><SegmentedControl value={view} onChange={setView} data={['upcoming', 'mine', 'all'].map((x) => ({ value: x, label: t(`ev.view.${x}`) }))} /></Group>
      <DataList<Row> title={t('ev.title_page')} endpoint="/events" queryKey="events" columns={columns} extraParams={params} defaultSort={{ key: 'starts_at', direction: view === 'all' ? 'desc' : 'asc' }} key={view}
        filters={[{ key: 'type_id', label: t('common.type'), options: types.options }]} onRowClick={(e) => nav(`/events/${e.id}`)}
        toolbar={can('event.create') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('ev.new')}</Button> : undefined} />
      <EventFormModal opened={creating} onClose={() => setCreating(false)} onSaved={(id) => nav(`/events/${id}`)} />
    </>
  );
}
