import { Group, SegmentedControl, Text } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MINUTES_COLOR } from '@/lib/minutes';

interface Row { id: string; version_no: number; status: string; visibility: string | null; published_at: string | null; correction_reason: string | null; meeting: { id: string; code: string; title: string; starts_at: string; confidential: boolean } }

/** Published minutes the user may read, whatever the visibility of the meeting itself (Guide 6.6). */
export function MinutesPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const [view, setView] = useState('latest');
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(iso)) : '—');
  const columns: Column<Row>[] = [
    { key: 'title', label: t('meet.title'), render: (r) => (
      <div><Group gap={6} wrap="nowrap">{r.meeting.confidential && <IconLock size={14} />}<Text size="sm" fw={600}>{r.meeting.title}</Text></Group><Text size="xs" c="dimmed">{r.meeting.code} · v{r.version_no}</Text></div>) },
    { key: 'meeting_date', label: t('meet.when'), visibleFrom: 'sm', render: (r) => fmt(r.meeting.starts_at) },
    { key: 'published_at', label: t('min.published_on'), render: (r) => fmt(r.published_at) },
    { key: 'visibility', label: t('min.visibility'), visibleFrom: 'md', render: (r) => (r.visibility ? t(`min.vis.${r.visibility}`) : '—') },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={t(`min.status.${r.status}`)} color={MINUTES_COLOR[r.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('min.library_title')} description={t('min.library_intro')} />
      <Group mb="md"><SegmentedControl value={view} onChange={setView} data={[{ value: 'latest', label: t('min.view_latest') }, { value: 'all', label: t('min.view_all') }]} /></Group>
      <DataList<Row> title={t('min.library_title')} endpoint="/minutes" queryKey="minutes-library" columns={columns} extraParams={view === 'all' ? { all_versions: 1 } : {}} key={view} exportable={false} onRowClick={(r) => nav(`/minutes/${r.id}`)} />
    </>
  );
}
