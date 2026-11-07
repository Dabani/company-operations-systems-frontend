import { Badge, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';

export interface InvoiceRow { id: string; number: string | null; project: string; client: string | null; status: string; status_id: string; currency_code: string; due_date: string | null; total: string; balance: string }
export const STATUS_COLOR: Record<string, string> = { draft: 'gray', pending_approval: 'orange', issued: 'blue', partially_paid: 'yellow', paid: 'green', overdue: 'red', cancelled: 'gray' };
export const money = (v: string | number, cur?: string) => `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ''}`;

export function InvoicesPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const statuses = useLookup('invoice_status');
  const columns: Column<InvoiceRow>[] = [
    { key: 'number', label: t('billing.number'), sortable: true, render: (r) => <Text size="sm" fw={600}>{r.number ?? t('billing.draft_label')}</Text> },
    { key: 'project', label: t('time.project'), visibleFrom: 'sm', render: (r) => <div><Text size="sm">{r.project}</Text><Text size="xs" c="dimmed">{r.client ?? ''}</Text></div> },
    { key: 'status', label: t('common.status'), render: (r) => <Badge color={STATUS_COLOR[r.status]} variant="light">{statuses.byId(r.status_id)?.label ?? r.status}</Badge> },
    { key: 'due_date', label: t('billing.due'), sortable: true, visibleFrom: 'md', render: (r) => r.due_date ?? '—' },
    { key: 'total', label: t('billing.total'), sortable: true, render: (r) => money(r.total, r.currency_code) },
    { key: 'balance', label: t('billing.balance'), visibleFrom: 'sm', render: (r) => <Text size="sm" c={Number(r.balance) > 0 && r.status === 'overdue' ? 'red' : undefined}>{money(r.balance, r.currency_code)}</Text> },
  ];
  return (
    <>
      <PageHeader title={t('billing.title')} />
      <DataList<InvoiceRow> title={t('billing.title')} endpoint="/invoices" queryKey="invoices" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(r) => nav(`/invoices/${r.id}`)} />
    </>
  );
}
