import { Alert, Anchor, Button, Group, Modal, MultiSelect, Stack, TextInput } from '@mantine/core';
import { IconScale } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { RichTextField } from '@/components/RichTextField';
import { toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

/** On an approved requisition: lets a buyer start a request for quotation, or points to the one that exists. */
export function CreateRfqButton({ requisitionId, status }: { requisitionId: string; status: string }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const buyer = can('procurement.manage');
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [closing, setClosing] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rfqs = useQuery({ queryKey: ['requisition-rfqs', requisitionId], enabled: buyer && status === 'approved',
    queryFn: async () => (await api.get<Paginated<{ id: string; code: string; status: string }>>('/rfqs', { params: { 'filter[requisition_id]': requisitionId, per_page: 20 } })).data.data });
  const options = useQuery({ queryKey: ['supplier-options-approved'], enabled: open,
    queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string; status: string }>>('/suppliers', { params: { per_page: 100 } })).data.data.filter((s) => s.status === 'approved') });
  const create = useMutation({
    mutationFn: async () => (await api.post<{ data: { id: string } }>('/rfqs', { requisition_id: requisitionId, supplier_ids: suppliers, closing_date: closing, instructions: instructions || null })).data.data,
    onSuccess: (r) => { toastOk(); setOpen(false); nav(`/rfqs/${r.id}`); },
    onError: (e) => setError(parseError(e).message),
  });
  if (!buyer || status !== 'approved') return null;
  const live = (rfqs.data ?? []).find((r) => r.status !== 'cancelled');
  if (live) return <Anchor component={Link} to={`/rfqs/${live.id}`} size="sm">{t('rfq.open_existing', { code: live.code })}</Anchor>;
  return (
    <>
      <Button variant="default" leftSection={<IconScale size={16} />} onClick={() => { setOpen(true); setError(null); }}>{t('rfq.create')}</Button>
      <Modal opened={open} onClose={() => setOpen(false)} centered size="lg" title={t('rfq.create')}>
        <Stack gap="sm">
          <Alert color="blue" variant="light">{t('rfq.create_help')}</Alert>
          <MultiSelect label={t('rfq.suppliers')} required searchable data={(options.data ?? []).map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} value={suppliers} onChange={setSuppliers} />
          <TextInput type="date" label={t('rfq.closing_date')} required min={new Date().toISOString().slice(0, 10)} value={closing} onChange={(e) => setClosing(e.currentTarget.value)} />
          <RichTextField label={t('rfq.instructions')} value={instructions} onChange={setInstructions} />
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button loading={create.isPending} disabled={suppliers.length === 0 || !closing} onClick={() => { setError(null); create.mutate(); }}>{t('rfq.create')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
