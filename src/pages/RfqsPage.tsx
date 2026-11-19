import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { RFQ_COLOR } from '@/lib/rfq';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; title: string; status: string; requisition: string | null; closing_date: string; invited: number | null }

export function RfqsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const statuses = useLookup('rfq_status');
  const columns: Column<Row>[] = [
    { key: 'title', label: t('rfq.request'), render: (r) => (<div><Text size="sm" fw={600}>{r.title}</Text><Text size="xs" c="dimmed">{r.code}{r.requisition ? ` · ${r.requisition}` : ''}</Text></div>) },
    { key: 'invited', label: t('rfq.invited'), visibleFrom: 'sm', render: (r) => r.invited ?? 0 },
    { key: 'closing_date', label: t('rfq.closing_date'), sortable: true, visibleFrom: 'md', render: (r) => r.closing_date },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={t(`rfq.status.${r.status}`)} color={RFQ_COLOR[r.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('rfq.title_page')} description={t('rfq.intro')} />
      <DataList<Row> title={t('rfq.title_page')} endpoint="/rfqs" queryKey="rfqs" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(r) => nav(`/rfqs/${r.id}`)} />
    </>
  );
}
