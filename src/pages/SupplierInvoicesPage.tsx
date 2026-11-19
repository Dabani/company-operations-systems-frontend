import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { INVOICE_COLOR } from '@/lib/invoices';
import { fmtCents, toCents } from '@/lib/procurement';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; invoice_number: string; status: string; supplier: string | null; order: string | null; invoice_date: string; due_date: string | null; currency_code: string; total_amount: string }

export function SupplierInvoicesPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const statuses = useLookup('supplier_invoice_status');
  const columns: Column<Row>[] = [
    { key: 'invoice_number', label: t('inv.invoice'), render: (i) => (<div><Text size="sm" fw={600}>{i.invoice_number}</Text><Text size="xs" c="dimmed">{i.code}{i.order ? ` · ${i.order}` : ''}</Text></div>) },
    { key: 'supplier', label: t('po.supplier'), visibleFrom: 'sm', render: (i) => i.supplier },
    { key: 'due_date', label: t('inv.due_date'), sortable: true, visibleFrom: 'md', render: (i) => i.due_date ?? '—' },
    { key: 'total_amount', label: t('req.total'), sortable: true, render: (i) => fmtCents(toCents(i.total_amount), i.currency_code, i18n.language) },
    { key: 'status', label: t('common.status'), render: (i) => <StatusBadge label={t(`inv.status.${i.status}`)} color={INVOICE_COLOR[i.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('inv.title_page')} description={t('inv.intro')} />
      <DataList<Row> title={t('inv.title_page')} endpoint="/supplier-invoices" queryKey="supplier-invoices" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(i) => nav(`/supplier-invoices/${i.id}`)} />
    </>
  );
}
