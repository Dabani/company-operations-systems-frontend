import { Alert, Anchor, Button, Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { IconTruckDelivery } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { RichTextField } from '@/components/RichTextField';
import { toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface OrderRow { id: string; code: string; status: string }

/** On an approved requisition: lets a buyer raise the purchase order, or points to the one that exists. */
export function CreateOrderButton({ requisitionId, status, preferredSupplierId }: { requisitionId: string; status: string; preferredSupplierId?: string | null }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const buyer = can('procurement.manage');
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState<string | null>(preferredSupplierId ?? null);
  const [terms, setTerms] = useState('');
  const [error, setError] = useState<string | null>(null);
  const orders = useQuery({ queryKey: ['requisition-orders', requisitionId], enabled: buyer && status === 'approved',
    queryFn: async () => (await api.get<Paginated<OrderRow>>('/purchase-orders', { params: { 'filter[requisition_id]': requisitionId, per_page: 20 } })).data.data });
  const suppliers = useQuery({ queryKey: ['supplier-options-approved'], enabled: open,
    queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string; status: string }>>('/suppliers', { params: { per_page: 100 } })).data.data.filter((s) => s.status === 'approved') });
  const create = useMutation({
    mutationFn: async () => (await api.post<{ data: { id: string } }>('/purchase-orders', { requisition_id: requisitionId, supplier_id: supplier, terms: terms || null })).data.data,
    onSuccess: (o) => { toastOk(); setOpen(false); nav(`/purchase-orders/${o.id}`); },
    onError: (e) => setError(parseError(e).message),
  });
  if (!buyer || status !== 'approved') return null;
  const live = (orders.data ?? []).find((o) => o.status !== 'cancelled');
  if (live) return <Anchor component={Link} to={`/purchase-orders/${live.id}`} size="sm">{t('po.open_existing', { code: live.code })}</Anchor>;
  return (
    <>
      <Button leftSection={<IconTruckDelivery size={16} />} onClick={() => { setOpen(true); setError(null); }}>{t('po.create')}</Button>
      <Modal opened={open} onClose={() => setOpen(false)} centered size="lg" title={t('po.create')}>
        <Stack gap="sm">
          <Select label={t('po.supplier')} required searchable data={(suppliers.data ?? []).map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} value={supplier} onChange={setSupplier} />
          <RichTextField label={t('po.terms')} value={terms} onChange={setTerms} />
          <TextInput readOnly variant="filled" value={t('po.create_help')} />
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button loading={create.isPending} disabled={!supplier} onClick={() => { setError(null); create.mutate(); }}>{t('po.create')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
