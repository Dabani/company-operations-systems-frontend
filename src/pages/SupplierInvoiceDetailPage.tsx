import { Alert, Anchor, Button, Card, Center, Group, List, Loader, Modal, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { INVOICE_COLOR, exceptionNoteOk } from '@/lib/invoices';
import { fmtCents, reasonOk, toCents } from '@/lib/procurement';
import { toastError, toastOk } from '@/lib/ui';

interface Detail {
  id: string; code: string; invoice_number: string; status: string; invoice_date: string; due_date: string | null; currency_code: string; subtotal: string; tax_amount: string; total_amount: string;
  exception_approved: boolean; exception_note: string | null; decision_note: string | null; paid_on: string | null; payment_reference: string | null; recorded_by: string | null;
  supplier: { id: string; code: string; name: string }; order: { id: string; code: string; title: string; total_amount: string };
  lines: { id: string; order_line_id: string; description: string | null; quantity: string; unit_price: string; line_total: string; ordered_price: string | null; accepted_quantity: string | null }[];
  issues: { order_line_id: string | null; code: string; detail: string | null }[];
  history: { status: string; by: string | null; note: string | null; at: string }[];
  me: { can_rematch: boolean; can_decide_exception: boolean; can_approve: boolean; can_reject: boolean; can_pay: boolean; can_cancel: boolean };
}
type Dialog = 'exception' | 'reject' | 'cancel' | 'pay' | 'approve' | null;

export function SupplierInvoiceDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const key = ['supplier-invoice', id];
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');
  const [accept, setAccept] = useState(true);
  const [ref, setRef] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/supplier-invoices/${id}`)).data.data });
  const done = (d: Detail) => { qc.setQueryData(key, d); qc.invalidateQueries({ queryKey: ['supplier-invoices'] }); setDialog(null); setNote(''); setRef(''); toastOk(); };
  const post = useMutation({ mutationFn: async (v: { path: string; body?: object }) => (await api.post<{ data: Detail }>(`/supplier-invoices/${id}/${v.path}`, v.body ?? {})).data.data, onSuccess: done, onError: (e) => { setDialog(null); toastError(e); } });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const i = q.data;
  const money = (v: string | number) => fmtCents(toCents(v), i.currency_code, i18n.language);
  const open = (d: Dialog, acc = true) => { setDialog(d); setNote(''); setAccept(acc); };
  const noteValid = dialog === 'exception' ? exceptionNoteOk(note) : reasonOk(note);

  return (
    <>
      <PageHeader title={`${t('inv.invoice')} ${i.invoice_number}`} description={`${i.code} · ${i.supplier.code} ${i.supplier.name}`}
        actions={<>
          <StatusBadge label={t(`inv.status.${i.status}`)} color={INVOICE_COLOR[i.status]} />
          {i.me.can_rematch && <Button variant="default" loading={post.isPending} onClick={() => post.mutate({ path: 'rematch' })}>{t('inv.rematch')}</Button>}
          {i.me.can_decide_exception && <Button onClick={() => open('exception', true)}>{t('inv.decide_exception')}</Button>}
          {i.me.can_approve && <Button onClick={() => setDialog('approve')}>{t('inv.approve')}</Button>}
          {i.me.can_reject && <Button variant="light" color="red" onClick={() => open('reject')}>{t('inv.reject')}</Button>}
          {i.me.can_pay && <Button onClick={() => setDialog('pay')}>{t('inv.pay')}</Button>}
          {i.me.can_cancel && <Button variant="light" color="red" onClick={() => open('cancel')}>{t('common.cancel')}</Button>}
        </>} />
      {i.status === 'on_hold' && <Alert color="orange" variant="light" mb="md" title={t('inv.on_hold_title')}>
        <Text size="sm" mb={4}>{t('inv.on_hold_text')}</Text>
        <List size="sm">{i.issues.map((x, n) => <List.Item key={n}>{t(`inv.issue.${x.code}`)}{x.detail ? ` (${x.detail})` : ''}</List.Item>)}</List>
      </Alert>}
      {i.exception_approved && <Alert color="yellow" variant="light" mb="md">{t('inv.exception_note')}: {i.exception_note}</Alert>}
      {i.decision_note && ['rejected', 'cancelled'].includes(i.status) && <Alert color="gray" variant="light" mb="md">{i.decision_note}</Alert>}
      {i.status === 'paid' && <Alert color="green" variant="light" mb="md">{t('inv.paid_info', { date: i.paid_on, ref: i.payment_reference })}</Alert>}
      <Card withBorder padding="md" mb="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div><Text size="xs" c="dimmed">{t('inv.order')}</Text><Text size="sm"><Anchor component={Link} to={`/purchase-orders/${i.order.id}`}>{i.order.code}</Anchor> · {i.order.title}</Text></div>
          <div><Text size="xs" c="dimmed">{t('inv.invoice_date')}</Text><Text size="sm">{i.invoice_date}</Text></div>
          <div><Text size="xs" c="dimmed">{t('inv.due_date')}</Text><Text size="sm">{i.due_date ?? '—'}</Text></div>
          <div><Text size="xs" c="dimmed">{t('inv.recorded_by')}</Text><Text size="sm">{i.recorded_by}</Text></div>
        </SimpleGrid>
      </Card>
      <Card withBorder padding="md" mb="md"><Title order={5} mb="xs">{t('req.lines')}</Title>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('req.line_description')}</Table.Th><Table.Th ta="right">{t('req.quantity')}</Table.Th><Table.Th ta="right">{t('po.accepted')}</Table.Th><Table.Th ta="right">{t('req.unit_price')}</Table.Th><Table.Th ta="right">{t('inv.ordered_price')}</Table.Th><Table.Th ta="right">{t('req.total')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {i.lines.map((l) => { const bad = i.issues.some((x) => x.order_line_id === l.order_line_id);
                return <Table.Tr key={l.id} bg={bad ? 'var(--mantine-color-orange-light)' : undefined}><Table.Td>{l.description}</Table.Td><Table.Td ta="right">{Number(l.quantity)}</Table.Td><Table.Td ta="right">{Number(l.accepted_quantity ?? 0)}</Table.Td>
                  <Table.Td ta="right">{money(l.unit_price)}</Table.Td><Table.Td ta="right">{l.ordered_price ? money(l.ordered_price) : '—'}</Table.Td><Table.Td ta="right">{money(l.line_total)}</Table.Td></Table.Tr>; })}
              <Table.Tr><Table.Td colSpan={5} ta="right">{t('inv.subtotal')}</Table.Td><Table.Td ta="right">{money(i.subtotal)}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td colSpan={5} ta="right">{t('inv.tax')}</Table.Td><Table.Td ta="right">{money(i.tax_amount)}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td colSpan={5} ta="right"><b>{t('inv.total')}</b></Table.Td><Table.Td ta="right"><b>{money(i.total_amount)}</b></Table.Td></Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
        <Stack gap={4}>{i.history.map((h, n) => <Text size="xs" key={n}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? t('sup.system')}: {t(`inv.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>
      <ConfirmModal opened={dialog === 'approve'} onClose={() => setDialog(null)} loading={post.isPending} title={t('inv.approve')} text={t('inv.approve_text')} onConfirm={() => post.mutate({ path: 'approve' })} />
      <Modal opened={dialog === 'exception' || dialog === 'reject' || dialog === 'cancel'} onClose={() => setDialog(null)} centered title={dialog === 'exception' ? t('inv.decide_exception') : dialog === 'reject' ? t('inv.reject') : t('common.cancel')}>
        <Stack gap="sm">
          {dialog === 'exception' && <Group><Button variant={accept ? 'filled' : 'default'} onClick={() => setAccept(true)}>{t('inv.accept_exception')}</Button><Button color="red" variant={!accept ? 'filled' : 'default'} onClick={() => setAccept(false)}>{t('inv.reject')}</Button></Group>}
          <TextInput label={dialog === 'exception' ? t('inv.exception_reason') : t('sup.reason')} required maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button loading={post.isPending} disabled={!noteValid}
              onClick={() => post.mutate(dialog === 'exception' ? { path: 'exception', body: { accept, note: note.trim() } } : { path: dialog === 'reject' ? 'reject' : 'cancel', body: { note: note.trim() } })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      <Modal opened={dialog === 'pay'} onClose={() => setDialog(null)} centered title={t('inv.pay')}>
        <Stack gap="sm">
          <Alert color="blue" variant="light">{t('inv.pay_help')}</Alert>
          <TextInput label={t('inv.payment_reference')} required maxLength={120} value={ref} onChange={(e) => setRef(e.currentTarget.value)} />
          <TextInput type="date" label={t('inv.paid_on')} required max={new Date().toISOString().slice(0, 10)} value={paidOn} onChange={(e) => setPaidOn(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button loading={post.isPending} disabled={ref.trim().length < 2 || !paidOn} onClick={() => post.mutate({ path: 'pay', body: { payment_reference: ref.trim(), paid_on: paidOn } })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
