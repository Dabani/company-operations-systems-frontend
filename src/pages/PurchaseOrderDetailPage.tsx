import { Alert, Anchor, Badge, Button, Card, Center, Group, Loader, Modal, NumberInput, Progress, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconPackageImport, IconPencil } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { RecordInvoiceModal } from '@/components/RecordInvoiceModal';
import { useAuth } from '@/auth/AuthContext';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { PO_COLOR, deliveredPercent, receiptLineValid, remaining, thousandths } from '@/lib/orders';
import { fmtCents, lineCents, reasonOk, toCents } from '@/lib/procurement';
import { toastError, toastOk } from '@/lib/ui';

interface Line { id: string; line_no: number; description: string; quantity: string; unit: string | null; unit_price: string; line_total: string; accepted_quantity: string; remaining: string }
interface Receipt { id: string; code: string; received_on: string; delivery_note: string | null; note: string | null; received_by: string | null; lines: { order_line_id: string; quantity_received: string; quantity_accepted: string; note: string | null }[] }
interface Detail {
  id: string; code: string; title: string; status: string; terms: string | null; delivery_location: string; needed_by: string; currency_code: string; total_amount: string; status_note: string | null; issued_at: string | null;
  approval_request_id: string | null; supplier: { id: string; code: string; name: string }; requisition: { id: string; code: string; requester: string | null; total_amount: string }; created_by: string | null;
  lines: Line[]; receipts: Receipt[]; history: { status: string; by: string | null; note: string | null; at: string }[];
  me: { can_edit: boolean; can_submit: boolean; can_issue: boolean; can_cancel: boolean; can_close: boolean; can_receive: boolean };
}

export function PurchaseOrderDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const key = ['purchase-order', id];
  const [pricing, setPricing] = useState<Record<string, number | string> | null>(null);
  const [confirm, setConfirm] = useState<'submit' | 'issue' | null>(null);
  const [move, setMove] = useState<'cancelled' | 'closed' | null>(null);
  const [note, setNote] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const { can } = useAuth();
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/purchase-orders/${id}`)).data.data });
  const set = (d: Detail) => qc.setQueryData(key, d);
  const savePrices = useMutation({ mutationFn: async (p: Record<string, number | string>) => (await api.patch<{ data: Detail }>(`/purchase-orders/${id}`, { lines: Object.entries(p).map(([lid, unit_price]) => ({ id: lid, unit_price: Number(unit_price || 0) })) })).data.data,
    onSuccess: (d) => { set(d); setPricing(null); toastOk(); }, onError: toastError });
  const act = useMutation({ mutationFn: async (a: 'submit' | 'issue') => (await api.post<{ data: Detail }>(`/purchase-orders/${id}/${a}`, {})).data.data, onSuccess: (d) => { set(d); setConfirm(null); toastOk(); }, onError: (e) => { setConfirm(null); toastError(e); } });
  const status = useMutation({ mutationFn: async (v: { to: string; note: string }) => (await api.post<{ data: Detail }>(`/purchase-orders/${id}/status`, { to: v.to, note: v.note || null })).data.data, onSuccess: (d) => { set(d); setMove(null); setNote(''); toastOk(); }, onError: toastError });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const o = q.data;
  const money = (v: string | number) => fmtCents(toCents(v), o.currency_code, i18n.language);
  const pct = deliveredPercent(o.lines);
  const shortClose = o.status === 'partially_received';
  const draftTotal = pricing ? o.lines.reduce((s, l) => s + lineCents(l.quantity, pricing[l.id] ?? l.unit_price), 0) : null;

  return (
    <>
      <PageHeader title={o.title} description={`${o.code} · ${o.supplier.code} ${o.supplier.name}`}
        actions={<>
          <StatusBadge label={t(`po.status.${o.status}`)} color={PO_COLOR[o.status]} />
          {o.me.can_edit && !pricing && <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setPricing(Object.fromEntries(o.lines.map((l) => [l.id, Number(l.unit_price)])))}>{t('po.edit_prices')}</Button>}
          {o.me.can_submit && <Button onClick={() => setConfirm('submit')}>{t('req.submit')}</Button>}
          {o.me.can_issue && <Button onClick={() => setConfirm('issue')}>{t('po.issue')}</Button>}
          {o.me.can_receive && <Button leftSection={<IconPackageImport size={16} />} onClick={() => setReceiving(true)}>{t('po.receive')}</Button>}
          {can('procurement.invoice') && ['issued', 'partially_received', 'received', 'closed'].includes(o.status) && <Button variant="default" onClick={() => setInvoicing(true)}>{t('inv.record')}</Button>}
          {o.me.can_close && <Button variant="light" onClick={() => { setMove('closed'); setNote(''); }}>{t('po.close')}</Button>}
          {o.me.can_cancel && <Button variant="light" color="red" onClick={() => { setMove('cancelled'); setNote(''); }}>{t('po.cancel')}</Button>}
        </>} />
      {o.status === 'pending_approval' && <Alert color="orange" variant="light" mb="md">{t('po.pending_note')} <Anchor component={Link} to="/approvals">{t('sup.open_approvals')}</Anchor></Alert>}
      {o.status_note && ['draft', 'cancelled', 'closed'].includes(o.status) && <Alert color={o.status === 'draft' ? 'orange' : 'gray'} variant="light" mb="md">{o.status_note}</Alert>}
      <Card withBorder padding="md" mb="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <div><Text size="xs" c="dimmed">{t('po.supplier')}</Text><Text size="sm"><Anchor component={Link} to={`/suppliers/${o.supplier.id}`}>{o.supplier.code} {o.supplier.name}</Anchor></Text></div>
          <div><Text size="xs" c="dimmed">{t('po.requisition')}</Text><Text size="sm"><Anchor component={Link} to={`/requisitions/${o.requisition.id}`}>{o.requisition.code}</Anchor> · {o.requisition.requester}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.delivery')}</Text><Text size="sm">{o.delivery_location}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.needed_by')}</Text><Text size="sm">{o.needed_by}</Text></div>
        </SimpleGrid>
        {o.terms && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed">{t('po.terms')}</Text><SafeHtml html={o.terms} /></div>}
        {['issued', 'partially_received', 'received', 'closed'].includes(o.status) && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed" mb={4}>{t('po.delivered', { pct })}</Text><Progress value={pct} color={pct >= 100 ? 'green' : 'blue'} /></div>}
      </Card>
      <Card withBorder padding="md" mb="md">
        <Group justify="space-between" mb="xs"><Title order={5}>{t('req.lines')}</Title>
          {pricing && <Group gap="xs"><Button variant="default" size="compact-sm" onClick={() => setPricing(null)}>{t('common.cancel')}</Button><Button size="compact-sm" loading={savePrices.isPending} onClick={() => savePrices.mutate(pricing)}>{t('common.save')}</Button></Group>}</Group>
        {pricing && <Alert color="blue" variant="light" mb="xs">{t('po.prices_help', { total: money(String((draftTotal ?? 0) / 100)), approved: money(o.requisition.total_amount) })}</Alert>}
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t('req.line_description')}</Table.Th><Table.Th ta="right">{t('req.quantity')}</Table.Th><Table.Th ta="right">{t('req.unit_price')}</Table.Th><Table.Th ta="right">{t('req.total')}</Table.Th><Table.Th ta="right">{t('po.accepted')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {o.lines.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.line_no}</Table.Td><Table.Td>{l.description}</Table.Td><Table.Td ta="right">{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</Table.Td>
                  <Table.Td ta="right">{pricing ? <NumberInput size="xs" w={120} min={0} decimalScale={2} thousandSeparator="," aria-label={t('req.unit_price')} value={pricing[l.id]} onChange={(v) => setPricing({ ...pricing, [l.id]: v })} /> : money(l.unit_price)}</Table.Td>
                  <Table.Td ta="right">{pricing ? money(String(lineCents(l.quantity, pricing[l.id] ?? l.unit_price) / 100)) : money(l.line_total)}</Table.Td>
                  <Table.Td ta="right">{Number(l.accepted_quantity)}</Table.Td>
                </Table.Tr>))}
              <Table.Tr><Table.Td colSpan={4} ta="right"><b>{t('req.total')}</b></Table.Td><Table.Td ta="right"><b>{pricing ? money(String((draftTotal ?? 0) / 100)) : money(o.total_amount)}</b></Table.Td><Table.Td /></Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {o.receipts.length > 0 && (
        <Card withBorder padding="md" mb="md"><Title order={5} mb="xs">{t('po.receipts')}</Title>
          <Stack gap="xs">{o.receipts.map((g) => (
            <div key={g.id}><Group gap="xs"><Badge variant="light">{g.code}</Badge><Text size="sm">{g.received_on}</Text><Text size="xs" c="dimmed">{g.received_by}{g.delivery_note ? ` · ${t('po.delivery_note')} ${g.delivery_note}` : ''}</Text></Group>
              {g.lines.map((gl) => { const l = o.lines.find((x) => x.id === gl.order_line_id); const rejected = thousandths(gl.quantity_received) - thousandths(gl.quantity_accepted);
                return <Text size="xs" key={gl.order_line_id} ml="md">{l ? `#${l.line_no} ` : ''}{t('po.line_received', { received: Number(gl.quantity_received), accepted: Number(gl.quantity_accepted) })}{rejected > 0 ? ` · ${t('po.rejected', { count: rejected / 1000 })}` : ''}{gl.note ? ` (${gl.note})` : ''}</Text>; })}
              {g.note && <Text size="xs" c="dimmed" ml="md">{g.note}</Text>}</div>))}</Stack></Card>)}
      <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
        <Stack gap={4}>{o.history.map((h, i) => <Text size="xs" key={i}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? t('sup.system')}: {t(`po.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>
      <ConfirmModal opened={confirm !== null} onClose={() => setConfirm(null)} loading={act.isPending} title={confirm === 'issue' ? t('po.issue') : t('req.submit')} text={confirm === 'issue' ? t('po.issue_text') : t('po.submit_text')} onConfirm={() => confirm && act.mutate(confirm)} />
      <Modal opened={move !== null} onClose={() => setMove(null)} centered title={move === 'closed' ? t('po.close') : t('po.cancel')}>
        <Stack gap="sm">
          {move === 'closed' && shortClose && <Alert color="orange" variant="light">{t('po.short_close')}</Alert>}
          <TextInput label={t('sup.reason')} required={move === 'cancelled' || shortClose} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setMove(null)}>{t('common.cancel')}</Button>
            <Button color={move === 'cancelled' ? 'red' : undefined} loading={status.isPending} disabled={!move || ((move === 'cancelled' || shortClose) && !reasonOk(note))} onClick={() => move && status.mutate({ to: move, note: note.trim() })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      <RecordInvoiceModal opened={invoicing} onClose={() => setInvoicing(false)} orderId={o.id} currency={o.currency_code} lines={o.lines} />
      <ReceiptModal opened={receiving} onClose={() => setReceiving(false)} order={o} onSaved={(d) => set(d)} />
    </>
  );
}

function ReceiptModal({ opened, onClose, order, onSaved }: { opened: boolean; onClose: () => void; order: Detail; onSaved: (d: Detail) => void }) {
  const { t } = useTranslation();
  const open = order.lines.filter((l) => remaining(l.quantity, l.accepted_quantity) > 0);
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10));
  const [dnote, setDnote] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Record<string, { received: number | string; accepted: number | string; note: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const row = (id: string) => rows[id] ?? { received: '', accepted: '', note: '' };
  const patch = (id: string, p: Partial<{ received: number | string; accepted: number | string; note: string }>) => setRows({ ...rows, [id]: { ...row(id), ...p } });
  const entered = open.filter((l) => Number(row(l.id).received) > 0);
  const valid = entered.length > 0 && entered.every((l) => receiptLineValid(row(l.id).received, row(l.id).accepted === '' ? row(l.id).received : row(l.id).accepted, remaining(l.quantity, l.accepted_quantity)));
  const save = useMutation({
    mutationFn: async () => (await api.post<{ data: Detail }>(`/purchase-orders/${order.id}/receipts`, { received_on: receivedOn, delivery_note: dnote || null, note: note || null,
      lines: entered.map((l) => ({ order_line_id: l.id, quantity_received: Number(row(l.id).received), quantity_accepted: Number(row(l.id).accepted === '' ? row(l.id).received : row(l.id).accepted), note: row(l.id).note || null })) })).data.data,
    onSuccess: (d) => { onSaved(d); setRows({}); setDnote(''); setNote(''); setError(null); toastOk(t('po.receipt_saved')); onClose(); },
    onError: (e) => setError(parseError(e).message),
  });
  return (
    <Modal opened={opened} onClose={onClose} centered size="xl" title={t('po.receive')}>
      <Stack gap="sm">
        <Alert color="blue" variant="light">{t('po.receive_help')}</Alert>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput type="date" label={t('po.received_on')} required value={receivedOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setReceivedOn(e.currentTarget.value)} />
          <TextInput label={t('po.delivery_note')} maxLength={120} value={dnote} onChange={(e) => setDnote(e.currentTarget.value)} />
        </SimpleGrid>
        {open.map((l) => {
          const rem = remaining(l.quantity, l.accepted_quantity); const r = row(l.id);
          const bad = Number(r.received) > 0 && !receiptLineValid(r.received, r.accepted === '' ? r.received : r.accepted, rem);
          return (
            <Card key={l.id} withBorder padding="xs">
              <Text size="sm" fw={500}>#{l.line_no} {l.description}</Text>
              <Text size="xs" c="dimmed" mb={4}>{t('po.still_to_come', { count: rem / 1000, unit: l.unit ?? '' })}</Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                <NumberInput size="xs" label={t('po.qty_received')} min={0} decimalScale={3} value={r.received} error={bad} onChange={(v) => patch(l.id, { received: v })} />
                <NumberInput size="xs" label={t('po.qty_accepted')} description={t('po.accepted_default')} min={0} decimalScale={3} value={r.accepted} error={bad} onChange={(v) => patch(l.id, { accepted: v })} />
                <TextInput size="xs" label={t('po.line_note')} maxLength={500} value={r.note} onChange={(e) => patch(l.id, { note: e.currentTarget.value })} />
              </SimpleGrid>
            </Card>);
        })}
        <TextInput label={t('po.receipt_note')} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {error && <Alert color="red" variant="light">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={!valid} onClick={() => { setError(null); save.mutate(); }}>{t('common.save')}</Button></Group>
      </Stack>
    </Modal>
  );
}
