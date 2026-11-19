import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { PO_COLOR } from '@/lib/orders';
import { fmtCents, toCents } from '@/lib/procurement';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; title: string; status: string; supplier: string | null; requisition: string | null; needed_by: string; currency_code: string; total_amount: string }

export function PurchaseOrdersPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const statuses = useLookup('po_status');
  const columns: Column<Row>[] = [
    { key: 'title', label: t('po.order'), render: (o) => (<div><Text size="sm" fw={600}>{o.title}</Text><Text size="xs" c="dimmed">{o.code}{o.requisition ? ` · ${o.requisition}` : ''}</Text></div>) },
    { key: 'supplier', label: t('po.supplier'), visibleFrom: 'sm', render: (o) => o.supplier },
    { key: 'needed_by', label: t('req.needed_by'), sortable: true, visibleFrom: 'md', render: (o) => o.needed_by },
    { key: 'total_amount', label: t('req.total'), sortable: true, render: (o) => fmtCents(toCents(o.total_amount), o.currency_code, i18n.language) },
    { key: 'status', label: t('common.status'), render: (o) => <StatusBadge label={t(`po.status.${o.status}`)} color={PO_COLOR[o.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('po.title_page')} description={t('po.intro')} />
      <DataList<Row> title={t('po.title_page')} endpoint="/purchase-orders" queryKey="purchase-orders" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(o) => nav(`/purchase-orders/${o.id}`)} />
    </>
  );
}
