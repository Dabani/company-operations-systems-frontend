import { Alert, Button, Group, Modal, NumberInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { invoiceSubtotal } from '@/lib/invoices';
import { fmtCents, toCents } from '@/lib/procurement';
import { toastOk } from '@/lib/ui';

interface OrderLine { id: string; line_no: number; description: string; unit: string | null; unit_price: string; accepted_quantity: string }

/** Records a supplier invoice against an order. Quantities start at what was accepted and prices at the order price; the server matches and may put the invoice on hold. */
export function RecordInvoiceModal({ opened, onClose, orderId, currency, lines }: { opened: boolean; onClose: () => void; orderId: string; currency: string; lines: OrderLine[] }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today);
  const [due, setDue] = useState('');
  const [tax, setTax] = useState<number | string>(0);
  const [rows, setRows] = useState<Record<string, { on: boolean; quantity: number | string; price: number | string }>>({});
  const [error, setError] = useState<string | null>(null);
  const row = (l: OrderLine) => rows[l.id] ?? { on: Number(l.accepted_quantity) > 0, quantity: Number(l.accepted_quantity), price: Number(l.unit_price) };
  const patch = (l: OrderLine, p: Partial<{ on: boolean; quantity: number | string; price: number | string }>) => setRows({ ...rows, [l.id]: { ...row(l), ...p } });
  const chosen = lines.filter((l) => row(l).on && Number(row(l).quantity) > 0);
  const sub = invoiceSubtotal(chosen.map((l) => ({ quantity: row(l).quantity, unit_price: row(l).price })));
  const save = useMutation({
    mutationFn: async () => (await api.post<{ data: { id: string } }>('/supplier-invoices', { order_id: orderId, invoice_number: number.trim(), invoice_date: date, due_date: due || null, tax_amount: Number(tax) || 0,
      lines: chosen.map((l) => ({ order_line_id: l.id, quantity: Number(row(l).quantity), unit_price: Number(row(l).price) })) })).data.data,
    onSuccess: (i) => { toastOk(t('inv.recorded')); onClose(); nav(`/supplier-invoices/${i.id}`); },
    onError: (e) => setError(parseError(e).message),
  });
  return (
    <Modal opened={opened} onClose={onClose} centered size="xl" title={t('inv.record')}>
      <Stack gap="sm">
        <Alert color="blue" variant="light">{t('inv.record_help')}</Alert>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label={t('inv.number')} required maxLength={80} value={number} onChange={(e) => setNumber(e.currentTarget.value)} />
          <TextInput type="date" label={t('inv.invoice_date')} required max={today} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          <TextInput type="date" label={t('inv.due_date')} min={date} value={due} onChange={(e) => setDue(e.currentTarget.value)} />
        </SimpleGrid>
        {lines.map((l) => { const r = row(l); return (
          <Group key={l.id} align="flex-end" wrap="wrap">
            <Button size="compact-xs" variant={r.on ? 'filled' : 'default'} onClick={() => patch(l, { on: !r.on })}>{r.on ? '✓' : '+'}</Button>
            <Text size="sm" style={{ flex: '1 1 160px' }}>#{l.line_no} {l.description}</Text>
            <NumberInput size="xs" w={110} label={t('req.quantity')} min={0} decimalScale={3} disabled={!r.on} value={r.quantity} onChange={(v) => patch(l, { quantity: v })} />
            <NumberInput size="xs" w={130} label={t('req.unit_price')} min={0} decimalScale={2} disabled={!r.on} value={r.price} onChange={(v) => patch(l, { price: v })} />
          </Group>); })}
        <Group justify="space-between" align="flex-end">
          <NumberInput label={t('inv.tax')} w={160} min={0} decimalScale={2} value={tax} onChange={setTax} />
          <Text size="sm" fw={600}>{t('inv.total')}: {fmtCents(sub + toCents(tax), currency, i18n.language)}</Text>
        </Group>
        {error && <Alert color="red" variant="light">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={save.isPending} disabled={!number.trim() || chosen.length === 0} onClick={() => { setError(null); save.mutate(); }}>{t('common.save')}</Button></Group>
      </Stack>
    </Modal>
  );
}
