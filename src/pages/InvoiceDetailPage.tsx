import { Alert, Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Textarea } from '@mantine/core';
import { IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, downloadBlob } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import { STATUS_COLOR, money } from './InvoicesPage';

interface Line { id: string; line_no: number; kind: string; description: string; quantity: string; unit: string; unit_price: string; amount: string }
interface Payment { id: string; amount: string; paid_on: string; method: string; reference: string | null; notes: string | null; reversal_of_id: string | null }
interface Credit { id: string; number: string | null; status: string; total: string; reason: string }
interface Inv { id: string; number: string | null; status: string; project: string; project_id: string; project_code: string; client: string | null; currency_code: string; issue_date: string | null; due_date: string | null;
  payment_terms_days: number; notes: string | null; tax_rate_id: string | null; tax_name: string | null; tax_percent: string | null; tax_exempt: boolean; tax_verified: boolean;
  subtotal: string; tax_total: string; total: string; paid_total: string; credited_total: string; balance: string; approval_request_id: string | null;
  lines: Line[]; payments: Payment[]; credit_notes: Credit[]; can: { edit: boolean; issue: boolean; pay: boolean; credit: boolean } }

export function InvoiceDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const methods = useLookup('payment_method');
  const [line, setLine] = useState<{ description: string; quantity: number | string; unit_price: number | string } | null>(null);
  const [pay, setPay] = useState<{ amount: number | string; paid_on: string; method_id: string | null; reference: string } | null>(null);
  const [credit, setCredit] = useState<{ amount: number | string; reason: string } | null>(null);
  const [reverse, setReverse] = useState<{ id: string; reason: string } | null>(null);

  const q = useQuery({ queryKey: ['invoice', id], queryFn: async () => (await api.get<{ data: Inv }>(`/invoices/${id}`)).data.data });
  const taxes = useQuery({ queryKey: ['tax-rates'], queryFn: async () => (await api.get<{ data: { id: string; name: string; rate_percent: string; verification: string }[] }>('/tax-rates')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['invoice', id] }); void qc.invalidateQueries({ queryKey: ['invoices'] }); };
  const run = useMutation({ mutationFn: async (v: { method: 'post' | 'patch' | 'delete'; path: string; body?: unknown }) => api.request({ method: v.method, url: v.path, data: v.body }),
    onSuccess: () => { toastOk(); setLine(null); setPay(null); setCredit(null); setReverse(null); refresh(); }, onError: toastError });

  if (!q.data) return null;
  const i = q.data;
  const draft = i.status === 'draft';

  return (
    <>
      <PageHeader title={`${i.number ?? t('billing.draft_label')} · ${i.project}`} description={i.client ?? undefined}
        actions={<Group gap="xs"><Badge size="lg" color={STATUS_COLOR[i.status]} variant="light">{t(`billing.s.${i.status}`)}</Badge>
          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => downloadBlob(`/invoices/${i.id}/pdf`, `${i.number ?? 'draft'}.pdf`).catch(toastError)}>PDF</Button></Group>} />
      <Stack gap="md">
        {i.status === 'pending_approval' && <Alert color="orange" variant="light">{t('billing.pending_note')} <Text component={Link} to="/approvals" size="sm" td="underline">{t('menu.approvals')}</Text></Alert>}
        {draft && !i.tax_exempt && (!i.tax_rate_id || !i.tax_verified) && <Alert color="red" variant="light">{i.tax_rate_id ? t('billing.tax_unverified') : t('billing.tax_missing')}</Alert>}

        <Card withBorder><Table verticalSpacing="xs"><Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t('billing.description')}</Table.Th><Table.Th ta="right">{t('billing.qty')}</Table.Th><Table.Th ta="right">{t('billing.unit_price')}</Table.Th><Table.Th ta="right">{t('billing.amount')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>{i.lines.map((l) => (
            <Table.Tr key={l.id}><Table.Td>{l.line_no}</Table.Td><Table.Td>{l.description}</Table.Td><Table.Td ta="right">{Number(l.quantity)} {l.unit}</Table.Td><Table.Td ta="right">{money(l.unit_price)}</Table.Td><Table.Td ta="right">{money(l.amount)}</Table.Td>
              <Table.Td>{i.can.edit && l.kind === 'manual' && <Button size="compact-xs" color="red" variant="subtle" leftSection={<IconTrash size={12} />} onClick={() => run.mutate({ method: 'delete', path: `/invoices/${i.id}/lines/${l.id}` })}>{t('common.delete')}</Button>}</Table.Td></Table.Tr>))}</Table.Tbody></Table>
          {i.can.edit && <Button mt="sm" size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setLine({ description: '', quantity: 1, unit_price: '' })}>{t('billing.add_line')}</Button>}
          <Stack gap={2} mt="md" align="flex-end">
            <Text size="sm">{t('billing.subtotal')}: {money(i.subtotal, i.currency_code)}</Text>
            <Text size="sm">{i.tax_exempt || i.tax_percent === null ? t('billing.no_tax') : `${i.tax_name} (${Number(i.tax_percent)}%)`}: {money(i.tax_total, i.currency_code)}</Text>
            <Text fw={700}>{t('billing.total')}: {money(i.total, i.currency_code)}</Text>
            {Number(i.credited_total) !== 0 && <Text size="sm">{t('billing.credited')}: -{money(i.credited_total)}</Text>}
            {Number(i.paid_total) !== 0 && <Text size="sm">{t('billing.paid')}: -{money(i.paid_total)}</Text>}
            <Text fw={700} c={Number(i.balance) > 0 ? undefined : 'green'}>{t('billing.balance')}: {money(i.balance, i.currency_code)}</Text>
          </Stack></Card>

        {draft && i.can.edit && <Card withBorder><Stack gap="sm">
          <Group grow align="flex-end">
            <Select label={t('billing.tax_rate')} clearable disabled={i.tax_exempt} data={(taxes.data ?? []).map((x) => ({ value: x.id, label: `${x.name} (${Number(x.rate_percent)}%)${x.verification === 'verified' ? '' : ` — ${t('billing.unverified')}`}` }))} value={i.tax_rate_id} onChange={(v) => run.mutate({ method: 'patch', path: `/invoices/${i.id}`, body: { tax_rate_id: v } })} />
            <NumberInput label={t('billing.terms_days')} min={0} max={365} defaultValue={i.payment_terms_days} onBlur={(e) => run.mutate({ method: 'patch', path: `/invoices/${i.id}`, body: { payment_terms_days: Number(e.currentTarget.value) } })} />
          </Group>
          <Switch label={t('billing.tax_exempt')} checked={i.tax_exempt} onChange={(e) => run.mutate({ method: 'patch', path: `/invoices/${i.id}`, body: { tax_exempt: e.currentTarget.checked } })} />
          <Textarea label={t('billing.notes')} autosize minRows={2} defaultValue={i.notes ?? ''} onBlur={(e) => run.mutate({ method: 'patch', path: `/invoices/${i.id}`, body: { notes: e.currentTarget.value } })} />
          <Group justify="flex-end">
            <Button variant="default" color="red" onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/cancel` })}>{t('billing.cancel_draft')}</Button>
            {i.can.issue && <Button loading={run.isPending} onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/issue` })}>{t('billing.submit_issue')}</Button>}
          </Group></Stack></Card>}

        {!draft && <Card withBorder><Group justify="space-between" mb="xs"><Text fw={600}>{t('billing.payments')}</Text>
          <Group gap="xs">{i.can.pay && <Button size="xs" onClick={() => setPay({ amount: Number(i.balance), paid_on: new Date().toISOString().slice(0, 10), method_id: null, reference: '' })}>{t('billing.record_payment')}</Button>}
            {i.can.credit && <Button size="xs" variant="light" onClick={() => setCredit({ amount: '', reason: '' })}>{t('billing.credit_note')}</Button>}</Group></Group>
          {i.payments.length === 0 && <Text size="sm" c="dimmed">—</Text>}
          {i.payments.map((p) => (<Group key={p.id} justify="space-between"><Text size="sm" c={Number(p.amount) < 0 ? 'red' : undefined}>{p.paid_on} · {t(`billing.m.${p.method}`, { defaultValue: p.method })}{p.reference ? ` · ${p.reference}` : ''}{p.notes ? ` · ${p.notes}` : ''}</Text>
            <Group gap="xs"><Text size="sm" fw={600}>{money(p.amount, i.currency_code)}</Text>{i.can.pay && Number(p.amount) > 0 && !i.payments.some((x) => x.reversal_of_id === p.id) && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setReverse({ id: p.id, reason: '' })}>{t('billing.reverse')}</Button>}</Group></Group>))}
          {i.credit_notes.map((c) => <Text key={c.id} size="sm" mt={4}>{c.number ?? t('billing.pending')} · <Badge size="xs" variant="light">{t(`billing.cs.${c.status}`)}</Badge> · -{money(c.total, i.currency_code)} · {c.reason}</Text>)}</Card>}
      </Stack>

      <Modal opened={!!line} onClose={() => setLine(null)} title={t('billing.add_line')} centered>
        {line && <Stack><TextInput label={t('billing.description')} value={line.description} onChange={(e) => setLine({ ...line, description: e.currentTarget.value })} />
          <Group grow><NumberInput label={t('billing.qty')} min={0.0001} decimalScale={4} value={line.quantity} onChange={(v) => setLine({ ...line, quantity: v })} /><NumberInput label={t('billing.unit_price')} min={0} decimalScale={2} thousandSeparator value={line.unit_price} onChange={(v) => setLine({ ...line, unit_price: v })} /></Group>
          <Group justify="flex-end"><Button disabled={!line.description || line.unit_price === ''} loading={run.isPending} onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/lines`, body: line })}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
      <Modal opened={!!pay} onClose={() => setPay(null)} title={t('billing.record_payment')} centered>
        {pay && <Stack><Group grow><NumberInput label={t('billing.amount')} min={0.01} decimalScale={2} thousandSeparator value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} /><TextInput type="date" label={t('billing.paid_on')} value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.currentTarget.value })} /></Group>
          <Select label={t('billing.method')} data={methods.options} value={pay.method_id} onChange={(v) => setPay({ ...pay, method_id: v })} /><TextInput label={t('billing.reference')} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.currentTarget.value })} />
          <Group justify="flex-end"><Button disabled={!pay.method_id || !pay.amount} loading={run.isPending} onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/payments`, body: pay })}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
      <Modal opened={!!credit} onClose={() => setCredit(null)} title={t('billing.credit_note')} centered>
        {credit && <Stack><Text size="sm" c="dimmed">{t('billing.credit_note_help')}</Text><NumberInput label={t('billing.credit_amount')} min={0.01} decimalScale={2} thousandSeparator value={credit.amount} onChange={(v) => setCredit({ ...credit, amount: v })} />
          <Textarea label={t('time.reason')} autosize minRows={2} value={credit.reason} onChange={(e) => setCredit({ ...credit, reason: e.currentTarget.value })} />
          <Group justify="flex-end"><Button disabled={!credit.amount || credit.reason.trim().length < 5} loading={run.isPending} onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/credit-notes`, body: credit })}>{t('billing.request_credit')}</Button></Group></Stack>}
      </Modal>
      <Modal opened={!!reverse} onClose={() => setReverse(null)} title={t('billing.reverse')} centered>
        {reverse && <Stack><Textarea label={t('time.reason')} autosize minRows={2} value={reverse.reason} onChange={(e) => setReverse({ ...reverse, reason: e.currentTarget.value })} />
          <Group justify="flex-end"><Button color="red" disabled={reverse.reason.trim().length < 5} loading={run.isPending} onClick={() => run.mutate({ method: 'post', path: `/invoices/${i.id}/payments/${reverse.id}/reverse`, body: { reason: reverse.reason } })}>{t('billing.reverse')}</Button></Group></Stack>}
      </Modal>
    </>
  );
}
