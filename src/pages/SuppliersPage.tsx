import { Button, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { SupplierFormModal } from '@/components/SupplierFormModal';
import { SUPPLIER_COLOR } from '@/lib/procurement';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; code: string; name: string; country_code: string | null; category: string | null; status: string; email: string | null; contact_name: string | null }

export function SuppliersPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const cats = useLookup('supplier_category');
  const statuses = useLookup('supplier_status');
  const [creating, setCreating] = useState(false);
  const buyer = can('procurement.manage');
  const columns: Column<Row>[] = [
    { key: 'name', label: t('sup.name'), sortable: true, render: (s) => (<div><Text size="sm" fw={600}>{s.name}</Text><Text size="xs" c="dimmed">{s.code}{s.category ? ` · ${t(`sup.cat.${s.category}`, { defaultValue: s.category })}` : ''}</Text></div>) },
    { key: 'country_code', label: t('sup.country'), visibleFrom: 'sm', render: (s) => s.country_code ?? '—' },
    ...(buyer ? [{ key: 'contact_name', label: t('sup.contact'), visibleFrom: 'md', render: (s: Row) => s.contact_name ?? s.email ?? '—' } as Column<Row>] : []),
    { key: 'status', label: t('common.status'), render: (s) => <StatusBadge label={t(`sup.status.${s.status}`)} color={SUPPLIER_COLOR[s.status]} /> },
  ];
  return (
    <>
      <PageHeader title={t('sup.title_page')} description={t('sup.intro')} />
      <DataList<Row> title={t('sup.title_page')} endpoint="/suppliers" queryKey="suppliers" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }} exportable={buyer}
        filters={[{ key: 'category_id', label: t('sup.category'), options: cats.options }, ...(buyer ? [{ key: 'status_id', label: t('common.status'), options: statuses.options }] : [])]}
        onRowClick={(s) => nav(`/suppliers/${s.id}`)}
        toolbar={buyer ? <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('sup.new')}</Button> : undefined} />
      <SupplierFormModal opened={creating} onClose={() => setCreating(false)} onSaved={(id) => nav(`/suppliers/${id}`)} />
    </>
  );
}
