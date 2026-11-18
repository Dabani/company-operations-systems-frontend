import { Badge, Button, Group, SegmentedControl, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { PurchaseRequisitionFormModal } from '@/components/PurchaseRequisitionFormModal';
import { StatusBadge } from '@/components/StatusBadge';
import { REQ_COLOR, fmtCents, toCents } from '@/lib/procurement';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; title: string; type: string | null; status: string; department: string | null; requester: string | null; needed_by: string; currency_code: string; total_amount: string; over_budget: boolean; split_suspected: boolean }

export function PurchaseRequisitionsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const buyer = can('procurement.manage');
  const types = useLookup('procurement_type');
  const statuses = useLookup('requisition_status');
  const [view, setView] = useState(buyer ? 'all' : 'mine');
  const [creating, setCreating] = useState(false);
  const params = useMemo(() => (view === 'mine' ? { mine: 1 } : {}), [view]);
  const columns: Column<Row>[] = [
    { key: 'title', label: t('req.title_field'), sortable: false, render: (r) => (<div><Text size="sm" fw={600}>{r.title}</Text><Text size="xs" c="dimmed">{r.code}{r.type ? ` · ${t(`req.type.${r.type}`, { defaultValue: r.type })}` : ''}</Text></div>) },
    ...(buyer ? [{ key: 'requester', label: t('req.requester'), visibleFrom: 'md', render: (r: Row) => r.requester } as Column<Row>] : []),
    { key: 'needed_by', label: t('req.needed_by'), sortable: true, visibleFrom: 'sm', render: (r) => r.needed_by },
    { key: 'total_amount', label: t('req.total'), sortable: true, render: (r) => <Group gap={6} wrap="nowrap"><Text size="sm">{fmtCents(toCents(r.total_amount), r.currency_code, i18n.language)}</Text>{r.over_budget && <Badge size="xs" color="red" variant="light">{t('req.over_budget')}</Badge>}{r.split_suspected && <Badge size="xs" color="orange" variant="light">{t('req.split')}</Badge>}</Group> },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={t(`req.status.${r.status}`)} color={REQ_COLOR[r.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('req.title_page')} description={t('req.intro')} />
      {buyer && <Group mb="md"><SegmentedControl value={view} onChange={setView} data={['all', 'mine'].map((x) => ({ value: x, label: t(`req.view.${x}`) }))} /></Group>}
      <DataList<Row> title={t('req.title_page')} endpoint="/purchase-requisitions" queryKey="requisitions" columns={columns} extraParams={params} key={view} defaultSort={{ key: 'created_at', direction: 'desc' }} exportable={buyer}
        filters={[{ key: 'procurement_type_id', label: t('common.type'), options: types.options }, { key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(r) => nav(`/requisitions/${r.id}`)}
        toolbar={can('procurement.requisition.create') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('req.new')}</Button> : undefined} />
      <PurchaseRequisitionFormModal opened={creating} onClose={() => setCreating(false)} onSaved={(id) => nav(`/requisitions/${id}`)} />
    </>
  );
}
