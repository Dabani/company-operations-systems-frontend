import { Alert, Anchor, Badge, Button, Card, Center, Group, Loader, Modal, MultiSelect, NumberInput, Radio, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { AttachmentsPanel } from '@/components/AttachmentsPanel';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtCents, toCents } from '@/lib/procurement';
import { QUOTE_COLOR, RFQ_COLOR, inviteesOk, overLowestPercent, quoteTotal, rfqReasonOk } from '@/lib/rfq';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Quote { id: string; supplier: { id: string; code: string; name: string }; status: string; lead_days: number | null; valid_until: string | null; notes: string | null; total_amount: string | null; decline_reason: string | null; complete: boolean; eligible: boolean; lowest: boolean; prices: Record<string, string> }
interface Detail {
  id: string; code: string; title: string; instructions: string | null; status: string; closing_date: string; sole_source_reason: string | null; award_reason: string | null; awarded_quote_id: string | null; status_note: string | null; currency_code: string; min_suppliers: number;
  requisition: { id: string; code: string; total_amount: string }; order: { id: string; code: string } | null;
  lines: { id: string; line_no: number; description: string; quantity: string; unit: string | null; estimated_price: string }[]; quotes: Quote[];
  history: { status: string; by: string | null; note: string | null; at: string }[];
  me: { can_edit: boolean; can_open: boolean; can_close: boolean; can_cancel: boolean; can_quote: boolean; can_award: boolean; can_create_order: boolean };
}

export function RfqDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const key = ['rfq', id];
  const [dialog, setDialog] = useState<'open' | 'cancel' | 'award' | 'invite' | null>(null);
  const [note, setNote] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [quoting, setQuoting] = useState<Quote | null>(null);
  const [invitees, setInvitees] = useState<string[]>([]);
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/rfqs/${id}`)).data.data });
  const supplierOptions = useQuery({ queryKey: ['supplier-options-approved'], enabled: dialog === 'invite',
    queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string; status: string }>>('/suppliers', { params: { per_page: 100 } })).data.data.filter((s) => s.status === 'approved') });
  const done = (d: Detail) => { qc.setQueryData(key, d); qc.invalidateQueries({ queryKey: ['rfqs'] }); setDialog(null); setNote(''); toastOk(); };
  const status = useMutation({ mutationFn: async (v: { to: string; note?: string; sole_source_reason?: string }) => (await api.post<{ data: Detail }>(`/rfqs/${id}/status`, v)).data.data, onSuccess: done, onError: toastError });
  const award = useMutation({ mutationFn: async () => (await api.post<{ data: Detail }>(`/rfqs/${id}/award`, { quote_id: pick, reason: note.trim() || null })).data.data, onSuccess: done, onError: toastError });
  const invite = useMutation({ mutationFn: async () => (await api.patch<{ data: Detail }>(`/rfqs/${id}`, { supplier_ids: invitees })).data.data, onSuccess: done, onError: toastError });
  const order = useMutation({ mutationFn: async () => (await api.post<{ data: { id: string } }>(`/rfqs/${id}/order`, {})).data.data, onSuccess: (o) => { toastOk(); nav(`/purchase-orders/${o.id}`); }, onError: toastError });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const r = q.data;
  const money = (v: string | number) => fmtCents(toCents(v), r.currency_code, i18n.language);
  const eligible = r.quotes.filter((x) => x.eligible);
  const lowestCents = Math.min(...eligible.map((x) => toCents(x.total_amount)));
  const pickQuote = r.quotes.find((x) => x.id === pick);
  const needsReason = !!pickQuote && !pickQuote.lowest;
  const fewInvited = r.quotes.length < r.min_suppliers;
  const openNeedsReason = r.status === 'draft' && fewInvited;

  return (
    <>
      <PageHeader title={r.title} description={`${r.code} · ${r.requisition.code}`}
        actions={<>
          <StatusBadge label={t(`rfq.status.${r.status}`)} color={RFQ_COLOR[r.status]} />
          {r.me.can_edit && <Button variant="default" onClick={() => { setInvitees(r.quotes.map((x) => x.supplier.id)); setDialog('invite'); }}>{t('rfq.edit_invitees')}</Button>}
          {r.me.can_open && <Button onClick={() => { setNote(r.sole_source_reason ?? ''); setDialog('open'); }}>{r.status === 'draft' ? t('rfq.send') : t('rfq.reopen')}</Button>}
          {r.me.can_close && <Button variant="light" loading={status.isPending} onClick={() => status.mutate({ to: 'closed' })}>{t('rfq.close')}</Button>}
          {r.me.can_award && <Button onClick={() => { setPick(eligible.find((x) => x.lowest)?.id ?? null); setNote(''); setDialog('award'); }}>{t('rfq.award')}</Button>}
          {r.me.can_create_order && <Button loading={order.isPending} onClick={() => order.mutate()}>{t('rfq.create_order')}</Button>}
          {r.me.can_cancel && <Button variant="light" color="red" onClick={() => { setNote(''); setDialog('cancel'); }}>{t('common.cancel')}</Button>}
        </>} />
      {r.status === 'draft' && fewInvited && <Alert color="orange" variant="light" mb="md">{t('rfq.few_invited', { min: r.min_suppliers })}</Alert>}
      {r.status === 'cancelled' && r.status_note && <Alert color="gray" variant="light" mb="md">{r.status_note}</Alert>}
      {r.sole_source_reason && <Alert color="yellow" variant="light" mb="md">{t('rfq.sole_source')}: {r.sole_source_reason}</Alert>}
      {r.status === 'awarded' && <Alert color="green" variant="light" mb="md">{t('rfq.awarded_to', { name: r.quotes.find((x) => x.id === r.awarded_quote_id)?.supplier.name ?? '' })}{r.award_reason ? ` — ${r.award_reason}` : ''}{r.order && <> · <Anchor component={Link} to={`/purchase-orders/${r.order.id}`}>{r.order.code}</Anchor></>}</Alert>}
      <Card withBorder padding="md" mb="md">
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div><Text size="xs" c="dimmed">{t('po.requisition')}</Text><Text size="sm"><Anchor component={Link} to={`/requisitions/${r.requisition.id}`}>{r.requisition.code}</Anchor> · {money(r.requisition.total_amount)}</Text></div>
          <div><Text size="xs" c="dimmed">{t('rfq.closing_date')}</Text><Text size="sm">{r.closing_date}</Text></div>
        </SimpleGrid>
        {r.instructions && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed">{t('rfq.instructions')}</Text><SafeHtml html={r.instructions} /></div>}
      </Card>
      <Card withBorder padding="md" mb="md">
        <Title order={5} mb="xs">{t('rfq.comparison')}</Title>
        <Table.ScrollContainer minWidth={640}>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('req.line_description')}</Table.Th><Table.Th ta="right">{t('req.quantity')}</Table.Th>
              {r.quotes.map((x) => <Table.Th key={x.id} ta="right">{x.supplier.name}</Table.Th>)}</Table.Tr></Table.Thead>
            <Table.Tbody>
              {r.lines.map((l) => (
                <Table.Tr key={l.id}><Table.Td>#{l.line_no} {l.description}</Table.Td><Table.Td ta="right">{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</Table.Td>
                  {r.quotes.map((x) => <Table.Td key={x.id} ta="right">{x.prices[l.id] ? money(x.prices[l.id]) : '—'}</Table.Td>)}</Table.Tr>))}
              <Table.Tr><Table.Td colSpan={2} ta="right"><b>{t('req.total')}</b></Table.Td>
                {r.quotes.map((x) => (
                  <Table.Td key={x.id} ta="right">{x.total_amount && x.status === 'received' ? <b>{money(x.total_amount)}</b> : '—'}
                    {x.eligible && x.lowest && <Badge ml={4} size="xs" color="green">{t('rfq.lowest')}</Badge>}
                    {x.eligible && !x.lowest && <Text size="xs" c="dimmed">+{overLowestPercent(toCents(x.total_amount), lowestCents)} %</Text>}
                    {x.status === 'received' && !x.complete && <Text size="xs" c="orange">{t('rfq.incomplete')}</Text>}
                    {x.status === 'received' && x.complete && !x.eligible && <Text size="xs" c="orange">{t('rfq.expired')}</Text>}</Table.Td>))}</Table.Tr>
              <Table.Tr><Table.Td colSpan={2} ta="right">{t('rfq.lead_days')}</Table.Td>{r.quotes.map((x) => <Table.Td key={x.id} ta="right">{x.lead_days ?? '—'}</Table.Td>)}</Table.Tr>
              <Table.Tr><Table.Td colSpan={2} ta="right">{t('rfq.valid_until')}</Table.Td>{r.quotes.map((x) => <Table.Td key={x.id} ta="right">{x.valid_until ?? '—'}</Table.Td>)}</Table.Tr>
              <Table.Tr><Table.Td colSpan={2} ta="right">{t('common.status')}</Table.Td>
                {r.quotes.map((x) => <Table.Td key={x.id} ta="right"><Badge variant="light" color={QUOTE_COLOR[x.status]}>{t(`rfq.quote.${x.status}`)}</Badge>
                  {r.me.can_quote && <div><Anchor size="xs" component="button" type="button" onClick={() => setQuoting(x)}>{t('rfq.record_quote')}</Anchor></div>}</Table.Td>)}</Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {r.quotes.some((x) => x.status === 'received') && <Card withBorder padding="md" mb="md"><Title order={5} mb="xs">{t('att.quote_docs')}</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>{r.quotes.filter((x) => x.status === 'received').map((x) => <AttachmentsPanel key={x.id} title={x.supplier.name} endpoint={`/rfq-quote-files/${x.id}`} canUpload={['open', 'closed'].includes(r.status)} />)}</SimpleGrid></Card>}
      <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
        <Stack gap={4}>{r.history.map((h, i) => <Text size="xs" key={i}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? t('sup.system')}: {t(`rfq.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>

      <Modal opened={dialog === 'open' || dialog === 'cancel'} onClose={() => setDialog(null)} centered title={dialog === 'cancel' ? t('rfq.cancel') : r.status === 'draft' ? t('rfq.send') : t('rfq.reopen')}>
        <Stack gap="sm">
          {dialog === 'open' && <Text size="sm">{t('rfq.send_text')}</Text>}
          {dialog === 'open' && openNeedsReason && <TextInput label={t('rfq.sole_source_reason', { min: r.min_suppliers })} required maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />}
          {dialog === 'cancel' && <TextInput label={t('sup.reason')} required maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />}
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button color={dialog === 'cancel' ? 'red' : undefined} loading={status.isPending} disabled={dialog === 'cancel' ? note.trim().length < 3 : !inviteesOk(r.quotes.length, r.status === 'draft' ? r.min_suppliers : 1, note)}
              onClick={() => status.mutate(dialog === 'cancel' ? { to: 'cancelled', note: note.trim() } : { to: 'open', sole_source_reason: openNeedsReason ? note.trim() : undefined })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      <Modal opened={dialog === 'invite'} onClose={() => setDialog(null)} centered title={t('rfq.edit_invitees')}>
        <Stack gap="sm">
          <MultiSelect label={t('rfq.suppliers')} searchable data={(supplierOptions.data ?? []).map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} value={invitees} onChange={setInvitees} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button><Button loading={invite.isPending} disabled={invitees.length === 0} onClick={() => invite.mutate()}>{t('common.save')}</Button></Group>
        </Stack>
      </Modal>
      <Modal opened={dialog === 'award'} onClose={() => setDialog(null)} centered size="lg" title={t('rfq.award')}>
        <Stack gap="sm">
          <Radio.Group value={pick} onChange={setPick}><Stack gap="xs">{eligible.map((x) => <Radio key={x.id} value={x.id} label={`${x.supplier.name} — ${money(x.total_amount ?? 0)}${x.lowest ? ` (${t('rfq.lowest')})` : ''}`} />)}</Stack></Radio.Group>
          {needsReason && <Alert color="orange" variant="light">{t('rfq.not_lowest')}</Alert>}
          <TextInput label={t('rfq.award_reason')} required={needsReason} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button loading={award.isPending} disabled={!pick || (needsReason && !rfqReasonOk(note))} onClick={() => award.mutate()}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      {quoting && <QuoteModal rfq={r} quote={quoting} onClose={() => setQuoting(null)} onSaved={(d) => { qc.setQueryData(key, d); setQuoting(null); toastOk(); }} />}
    </>
  );
}

function QuoteModal({ rfq, quote, onClose, onSaved }: { rfq: Detail; quote: Quote; onClose: () => void; onSaved: (d: Detail) => void }) {
  const { t, i18n } = useTranslation();
  const [prices, setPrices] = useState<Record<string, number | string>>(Object.fromEntries(Object.entries(quote.prices).map(([k, v]) => [k, Number(v)])));
  const [lead, setLead] = useState<number | string>(quote.lead_days ?? '');
  const [valid, setValid] = useState(quote.valid_until ?? '');
  const [notes, setNotes] = useState(quote.notes ?? '');
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tot = quoteTotal(rfq.lines, prices);
  const save = useMutation({
    mutationFn: async () => (await api.post<{ data: Detail }>(`/rfqs/${rfq.id}/quotes`, declining
      ? { supplier_id: quote.supplier.id, declined: true, decline_reason: declineReason || null }
      : { supplier_id: quote.supplier.id, lead_days: lead === '' ? null : Number(lead), valid_until: valid || null, notes: notes || null, prices: Object.fromEntries(Object.entries(prices).filter(([, v]) => v !== '' && v !== undefined).map(([k, v]) => [k, Number(v)])) })).data.data,
    onSuccess: onSaved, onError: (e) => setError(parseError(e).message),
  });
  return (
    <Modal opened onClose={onClose} centered size="lg" title={`${t('rfq.record_quote')}: ${quote.supplier.name}`}>
      <Stack gap="sm">
        {!declining && rfq.lines.map((l) => (
          <Group key={l.id} align="flex-end" wrap="wrap">
            <Text size="sm" style={{ flex: '1 1 180px' }}>#{l.line_no} {l.description} ({Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''})</Text>
            <NumberInput size="xs" w={140} label={t('req.unit_price')} min={0} decimalScale={2} value={prices[l.id] ?? ''} onChange={(v) => setPrices({ ...prices, [l.id]: v })} />
          </Group>))}
        {!declining && <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput label={t('rfq.lead_days')} min={0} value={lead} onChange={setLead} />
          <TextInput type="date" label={t('rfq.valid_until')} value={valid} onChange={(e) => setValid(e.currentTarget.value)} />
        </SimpleGrid>}
        {!declining && <TextInput label={t('po.line_note')} maxLength={2000} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />}
        {!declining && <Text size="sm" fw={600}>{t('req.total')}: {fmtCents(tot.cents, rfq.currency_code, i18n.language)}{!tot.complete && <Text span size="xs" c="orange"> · {t('rfq.incomplete')}</Text>}</Text>}
        {declining && <TextInput label={t('sup.reason')} maxLength={500} value={declineReason} onChange={(e) => setDeclineReason(e.currentTarget.value)} />}
        {error && <Alert color="red" variant="light">{error}</Alert>}
        <Group justify="space-between"><Button variant="subtle" color="red" onClick={() => setDeclining(!declining)}>{declining ? t('common.cancel') : t('rfq.decline')}</Button>
          <Group><Button variant="default" onClick={onClose}>{t('common.close')}</Button><Button loading={save.isPending} disabled={!declining && tot.priced === 0} onClick={() => { setError(null); save.mutate(); }}>{declining ? t('rfq.decline') : t('common.save')}</Button></Group></Group>
      </Stack>
    </Modal>
  );
}
