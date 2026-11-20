import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title, Tooltip } from '@mantine/core';
import { IconCheck, IconFileText, IconPaperclip, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LinkedFilesModal } from '@/components/LinkedFilesModal';
import { PageHeader } from '@/components/PageHeader';
import { TripExpenseModal } from '@/components/trips/TripExpenseModal';
import { TripSettleModal } from '@/components/trips/TripSettleModal';
import { ADVANCE_COLOR, canCancelTrip, canRecordExpenses, EXPENSE_COLOR, expenseTotals, fmtMoney, overBudget, TRIP_COLOR, type TripExpense } from '@/lib/trips';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Advance { id: string; employee_id: string; employee: string | null; amount: string; status: string; paid_on: string | null; due_on: string | null; overdue: boolean; days_late: number }
interface Booking { id: string; kind: string; provider: string; reference: string | null; starts_on: string | null; ends_on: string | null; amount: string | null; notes: string | null }
interface Settlement { employee_id: string; accepted_total: string; advance_total: string; balance: string; resolution: string; has_consent: boolean; note: string | null }
interface Trip {
  id: string; code: string; purpose: string; destination: string; zone: string; start_date: string; end_date: string; currency: string; budget_estimate: string; status: string; requested_by: string | null;
  authorization_number: string | null; project: { id: string; name: string } | null; approval_request_id: string | null; travelers: { employee_id: string; name: string | null }[];
  itinerary: string | null; linked_meeting: string | null; report_text: string | null; cancel_reason: string | null; advances: Advance[]; bookings: Booking[]; expenses: TripExpense[]; settlements: Settlement[];
}

export function TripDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const finance = can('hr.trip.finance');
  const kinds = useLookup('trip_booking_kind');
  const cats = useLookup('trip_expense_category');
  const res = useLookup('trip_settlement_resolution');
  const [expModal, setExpModal] = useState(false);
  const [receipt, setReceipt] = useState<TripExpense | null>(null);
  const [paying, setPaying] = useState<Advance | null>(null);
  const [paidOn, setPaidOn] = useState('');
  const [rejecting, setRejecting] = useState<TripExpense | null>(null);
  const [note, setNote] = useState('');
  const [delExp, setDelExp] = useState<TripExpense | null>(null);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [bookModal, setBookModal] = useState(false);
  const [book, setBook] = useState({ kind_id: '', provider: '', reference: '', starts_on: '', ends_on: '', amount: '' });
  const [report, setReport] = useState('');
  const [settle, setSettle] = useState<{ id: string; name: string } | null>(null);
  const [perDiemInfo, setPerDiemInfo] = useState<{ created: number; missing_rate: string[]; locked: string[] } | null>(null);

  const q = useQuery({ queryKey: ['trip', id], queryFn: async () => (await api.get<{ data: Trip }>(`/trips/${id}`)).data.data });
  const tr = q.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['trip', id] }); void qc.invalidateQueries({ queryKey: ['trips'] }); };
  const useAct = <T = void,>(fn: (arg: T) => Promise<unknown>, after?: () => void) => useMutation({ mutationFn: fn, onSuccess: () => { toastOk(); refresh(); after?.(); }, onError: toastError });

  const pay = useAct(async () => api.post(`/trips/${id}/advances/${paying!.id}/pay`, { paid_on: paidOn }), () => setPaying(null));
  const review = useAct(async (a: { x: TripExpense; decision: 'accept' | 'reject'; note?: string }) => api.post(`/trips/expenses/${a.x.id}/review`, { decision: a.decision, note: a.note }), () => { setRejecting(null); setNote(''); });
  const delExpense = useAct(async () => api.delete(`/trips/expenses/${delExp!.id}`), () => setDelExp(null));
  const cancelTrip = useAct(async () => api.post(`/trips/${id}/cancel`, tr?.status === 'approved' ? { reason } : undefined), () => { setCancel(false); setReason(''); });
  const addBooking = useMutation({
    mutationFn: async () => api.post(`/trips/${id}/bookings`, { ...book, reference: book.reference || undefined, starts_on: book.starts_on || undefined, ends_on: book.ends_on || undefined, amount: book.amount || undefined }),
    onSuccess: () => { toastOk(); setBookModal(false); setBook({ kind_id: '', provider: '', reference: '', starts_on: '', ends_on: '', amount: '' }); refresh(); }, onError: toastError,
  });
  const delBooking = useMutation({ mutationFn: async (b: string) => api.delete(`/trips/${id}/bookings/${b}`), onSuccess: refresh, onError: toastError });
  const perDiem = useMutation({ mutationFn: async () => (await api.post<{ data: { created: number; missing_rate: string[]; locked: string[] } }>(`/trips/${id}/per-diem`)).data.data, onSuccess: (d) => { setPerDiemInfo(d); refresh(); }, onError: toastError });
  const submitReport = useMutation({ mutationFn: async () => api.post(`/trips/${id}/report`, { report_text: report }), onSuccess: () => { toastOk(t('trips.report_sent')); refresh(); }, onError: (e) => toastError(e) });

  if (!tr) return <PageHeader title={t('trips.title')} />;
  const m = (v: string) => fmtMoney(v, tr.currency, i18n.language);
  const totals = expenseTotals(tr.expenses);
  const missingReceipts = tr.expenses.filter((e) => e.needs_receipt).length;
  const recording = canRecordExpenses(tr.status);
  const catLabel = (c: string) => cats.items.find((i) => i.code === c)?.label ?? c;

  return (
    <>
      <PageHeader title={`${tr.code} — ${tr.destination}`} description={tr.purpose}
        actions={<>{tr.authorization_number && <Button variant="default" component={Link} to={`/trips/${tr.id}/authorization`} leftSection={<IconFileText size={16} />}>{t('trips.authorization')}</Button>}
          {canCancelTrip(tr.status) && <Button variant="default" color="red" onClick={() => (tr.status === 'approved' ? setCancel(true) : cancelTrip.mutate())}>{t('trips.cancel')}</Button>}</>} />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('common.status')}</Text><Badge size="lg" color={TRIP_COLOR[tr.status]} variant="light">{t(`trips.status.${tr.status}`)}</Badge>{tr.authorization_number && <Text size="xs" mt={4}>{tr.authorization_number}</Text>}</Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('trips.period')}</Text><Text fw={600}>{tr.start_date} → {tr.end_date}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('trips.budget')}</Text><Text fw={600}>{m(tr.budget_estimate)}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('trips.accepted_total')}</Text><Text fw={600} c={overBudget(totals.accepted, tr.budget_estimate) ? 'red' : undefined}>{m(totals.accepted)}</Text></Card>
      </SimpleGrid>
      {tr.status === 'pending_approval' && <Alert color="orange" variant="light" mb="md">{t('trips.pending_note')} <Link to="/approvals">{t('hr.open_approvals')}</Link></Alert>}
      {tr.cancel_reason && <Alert color="gray" variant="light" mb="md">{tr.cancel_reason}</Alert>}
      <Text size="sm" mb="md">{t('trips.travelers')}: {tr.travelers.map((x) => x.name).join(', ')}{tr.project ? ` · ${t('trips.project')}: ${tr.project.name}` : ''}{tr.linked_meeting ? ` · ${tr.linked_meeting}` : ''}</Text>
      {tr.itinerary && <Text size="sm" c="dimmed" mb="md" style={{ whiteSpace: 'pre-wrap' }}>{tr.itinerary}</Text>}

      {/* advances */}
      {tr.advances.length > 0 && <>
        <Title order={5} mb="xs">{t('trips.advances')}</Title>
        <Table verticalSpacing="xs" mb="lg"><Table.Tbody>{tr.advances.map((a) => (
          <Table.Tr key={a.id}><Table.Td>{a.employee}</Table.Td><Table.Td>{m(a.amount)}</Table.Td>
            <Table.Td><Badge color={ADVANCE_COLOR[a.status]} variant="light">{t(`trips.advance.${a.status}`)}</Badge>{a.overdue && <Badge ml={6} color="red">{t('trips.days_late', { count: a.days_late })}</Badge>}</Table.Td>
            <Table.Td><Text size="xs" c="dimmed">{a.paid_on ? `${t('trips.paid_on')} ${a.paid_on}` : ''}{a.due_on ? ` · ${t('trips.due_on')} ${a.due_on}` : ''}</Text></Table.Td>
            <Table.Td ta="right">{finance && a.status === 'requested' && (tr.status === 'approved' || tr.status === 'report_submitted') && <Button size="compact-xs" onClick={() => { setPaying(a); setPaidOn(new Date().toISOString().slice(0, 10)); }}>{t('trips.pay_advance')}</Button>}</Table.Td></Table.Tr>))}</Table.Tbody></Table>
      </>}

      {/* bookings */}
      <Group justify="space-between" mb="xs"><Title order={5}>{t('trips.bookings')}</Title>{!['rejected', 'cancelled', 'settled'].includes(tr.status) && <Button size="compact-xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setBookModal(true)}>{t('common.add')}</Button>}</Group>
      <Table verticalSpacing="xs" mb="lg"><Table.Tbody>
        {tr.bookings.map((b) => <Table.Tr key={b.id}><Table.Td>{kinds.items.find((k) => k.code === b.kind)?.label ?? b.kind}</Table.Td><Table.Td>{b.provider}{b.reference ? ` · ${b.reference}` : ''}</Table.Td><Table.Td><Text size="xs" c="dimmed">{b.starts_on ?? ''}{b.ends_on ? ` → ${b.ends_on}` : ''}</Text></Table.Td><Table.Td ta="right">{b.amount ? m(b.amount) : ''}</Table.Td>
          <Table.Td ta="right"><ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => delBooking.mutate(b.id)}><IconTrash size={14} /></ActionIcon></Table.Td></Table.Tr>)}
        {tr.bookings.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{t('common.no_data')}</Text></Table.Td></Table.Tr>}
      </Table.Tbody></Table>

      {/* expenses */}
      <Group justify="space-between" mb="xs"><Title order={5}>{t('trips.expenses')}</Title>
        {recording && <Group gap="xs"><Button size="compact-xs" variant="default" loading={perDiem.isPending} onClick={() => perDiem.mutate()}>{t('trips.gen_per_diem')}</Button><Button size="compact-xs" leftSection={<IconPlus size={14} />} onClick={() => setExpModal(true)}>{t('trips.add_expense')}</Button></Group>}</Group>
      {perDiemInfo && <Alert variant="light" color={perDiemInfo.missing_rate.length ? 'orange' : 'green'} mb="xs" withCloseButton onClose={() => setPerDiemInfo(null)}>
        {t('trips.per_diem_done', { count: perDiemInfo.created })} {perDiemInfo.missing_rate.length > 0 && t('trips.per_diem_missing', { names: perDiemInfo.missing_rate.join(', ') })} {perDiemInfo.locked.length > 0 && t('trips.per_diem_locked', { names: perDiemInfo.locked.join(', ') })}</Alert>}
      <Table.ScrollContainer minWidth={720}><Table verticalSpacing="xs" mb="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('trips.expense_date')}</Table.Th><Table.Th>{t('trips.traveler')}</Table.Th><Table.Th>{t('trips.category')}</Table.Th><Table.Th>{t('common.description')}</Table.Th><Table.Th ta="right">{t('trips.amount')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {tr.expenses.map((x) => (
            <Table.Tr key={x.id}>
              <Table.Td>{x.expense_date}</Table.Td><Table.Td>{x.employee}</Table.Td><Table.Td>{catLabel(x.category)}</Table.Td><Table.Td>{x.description}{x.review_note && <Text size="xs" c="dimmed">{x.review_note}</Text>}</Table.Td>
              <Table.Td ta="right">{m(x.amount)}</Table.Td><Table.Td><Badge color={EXPENSE_COLOR[x.status]} variant="light">{t(`trips.expense.${x.status}`)}</Badge></Table.Td>
              <Table.Td><Group gap={2} wrap="nowrap" justify="flex-end">
                {!x.is_generated && <Tooltip label={x.needs_receipt ? t('trips.receipt_missing') : t('trips.receipt')}><ActionIcon variant="subtle" color={x.needs_receipt ? 'red' : 'gray'} aria-label={t('trips.receipt')} onClick={() => setReceipt(x)}><IconPaperclip size={16} /></ActionIcon></Tooltip>}
                {finance && x.status === 'submitted' && <>
                  <Tooltip label={t('trips.accept')}><ActionIcon variant="subtle" color="green" aria-label={t('trips.accept')} onClick={() => review.mutate({ x, decision: 'accept' })}><IconCheck size={16} /></ActionIcon></Tooltip>
                  <Tooltip label={t('trips.reject')}><ActionIcon variant="subtle" color="red" aria-label={t('trips.reject')} onClick={() => { setRejecting(x); setNote(''); }}><IconX size={16} /></ActionIcon></Tooltip></>}
                {x.status === 'draft' && !x.is_generated && <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => setDelExp(x)}><IconTrash size={14} /></ActionIcon>}
              </Group></Table.Td>
            </Table.Tr>))}
          {tr.expenses.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text size="sm" c="dimmed">{t('common.no_data')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table></Table.ScrollContainer>
      {overBudget(totals.accepted, tr.budget_estimate) && <Alert color="red" variant="light" mb="sm">{t('trips.over_budget')}</Alert>}

      {/* report */}
      <Title order={5} mt="lg" mb="xs">{t('trips.report')}</Title>
      {tr.report_text ? <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{tr.report_text}</Text> : recording ? (
        <Stack gap="xs" maw={720}>
          {missingReceipts > 0 && <Alert color="orange" variant="light">{t('trips.receipts_needed', { count: missingReceipts })}</Alert>}
          <Textarea autosize minRows={4} maxLength={20000} placeholder={t('trips.report_placeholder')} value={report} onChange={(e) => setReport(e.currentTarget.value)} />
          <Group justify="flex-end"><Button disabled={!report.trim() || missingReceipts > 0} loading={submitReport.isPending} onClick={() => submitReport.mutate()}>{t('trips.submit_report')}</Button></Group>
        </Stack>
      ) : <Text size="sm" c="dimmed">{t('trips.report_later')}</Text>}

      {/* settlement */}
      {(tr.status === 'report_submitted' || tr.status === 'settled') && <>
        <Title order={5} mt="lg" mb="xs">{t('trips.settlement')}</Title>
        <Table verticalSpacing="xs"><Table.Tbody>{tr.travelers.map((x) => {
          const s = tr.settlements.find((y) => y.employee_id === x.employee_id);
          return <Table.Tr key={x.employee_id}><Table.Td>{x.name}</Table.Td>
            {s ? <><Table.Td>{m(s.accepted_total)} − {m(s.advance_total)}</Table.Td><Table.Td fw={600} c={Number(s.balance) < 0 ? 'red' : undefined}>{m(s.balance)}</Table.Td><Table.Td><Badge variant="light" color="teal">{res.items.find((r) => r.code === s.resolution)?.label ?? s.resolution}</Badge>{s.has_consent && <Badge ml={6} color="orange" variant="light">{t('trips.consent_recorded')}</Badge>}</Table.Td></>
              : <><Table.Td colSpan={3} ta="right">{finance ? <Button size="compact-xs" onClick={() => setSettle({ id: x.employee_id, name: x.name ?? '' })}>{t('trips.settle')}</Button> : <Text size="xs" c="dimmed">{t('trips.awaiting_finance')}</Text>}</Table.Td></>}
          </Table.Tr>;
        })}</Table.Tbody></Table>
      </>}

      {/* dialogs */}
      <TripExpenseModal opened={expModal} onClose={() => setExpModal(false)} tripId={tr.id} travelers={tr.travelers} from={tr.start_date} to={tr.end_date} currency={tr.currency} />
      <LinkedFilesModal opened={!!receipt} onClose={() => { setReceipt(null); refresh(); }} title={`${t('trips.receipt')} — ${receipt?.description ?? ''}`} listUrl={`/trips/expenses/${receipt?.id}/files`} canUpload={!!receipt && receipt.status !== 'accepted' && recording} hint={t('trips.receipt_hint')} />
      {settle && <TripSettleModal opened onClose={() => setSettle(null)} tripId={tr.id} employeeId={settle.id} name={settle.name} currency={tr.currency} />}
      <Modal opened={!!paying} onClose={() => setPaying(null)} title={t('trips.pay_advance')} centered size="sm"><Stack gap="sm"><TextInput type="date" label={t('trips.paid_on')} required max={new Date().toISOString().slice(0, 10)} value={paidOn} onChange={(e) => setPaidOn(e.currentTarget.value)} /><Text size="xs" c="dimmed">{t('trips.pay_hint')}</Text>
        <Group justify="flex-end"><Button variant="default" onClick={() => setPaying(null)}>{t('common.cancel')}</Button><Button disabled={!paidOn} loading={pay.isPending} onClick={() => pay.mutate()}>{t('common.save')}</Button></Group></Stack></Modal>
      <Modal opened={!!rejecting} onClose={() => setRejecting(null)} title={t('trips.reject')} centered size="sm"><Stack gap="sm"><Textarea label={t('trips.reject_reason')} required autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="flex-end"><Button variant="default" onClick={() => setRejecting(null)}>{t('common.cancel')}</Button><Button color="red" disabled={!note.trim()} loading={review.isPending} onClick={() => rejecting && review.mutate({ x: rejecting, decision: 'reject', note })}>{t('trips.reject')}</Button></Group></Stack></Modal>
      <Modal opened={cancel} onClose={() => setCancel(false)} title={t('trips.cancel')} centered size="sm"><Stack gap="sm"><Textarea label={t('leave.cancel_reason')} required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
        <Group justify="flex-end"><Button variant="default" onClick={() => setCancel(false)}>{t('common.cancel')}</Button><Button color="red" disabled={!reason.trim()} loading={cancelTrip.isPending} onClick={() => cancelTrip.mutate()}>{t('trips.cancel')}</Button></Group></Stack></Modal>
      <Modal opened={bookModal} onClose={() => setBookModal(false)} title={t('trips.add_booking')} centered><Stack gap="sm">
        <Select label={t('common.type')} required data={kinds.options} value={book.kind_id} onChange={(v) => setBook({ ...book, kind_id: v ?? '' })} />
        <Group grow align="flex-start"><TextInput label={t('trips.provider')} required maxLength={150} value={book.provider} onChange={(e) => setBook({ ...book, provider: e.currentTarget.value })} /><TextInput label={t('trips.reference')} maxLength={100} value={book.reference} onChange={(e) => setBook({ ...book, reference: e.currentTarget.value })} /></Group>
        <Group grow align="flex-start"><TextInput type="date" label={t('trips.from')} value={book.starts_on} onChange={(e) => setBook({ ...book, starts_on: e.currentTarget.value })} /><TextInput type="date" label={t('trips.to')} value={book.ends_on} onChange={(e) => setBook({ ...book, ends_on: e.currentTarget.value })} /></Group>
        <TextInput type="number" step="0.01" min="0" label={`${t('trips.amount')} (${tr.currency})`} value={book.amount} onChange={(e) => setBook({ ...book, amount: e.currentTarget.value })} />
        <Group justify="flex-end"><Button variant="default" onClick={() => setBookModal(false)}>{t('common.cancel')}</Button><Button disabled={!book.kind_id || !book.provider.trim()} loading={addBooking.isPending} onClick={() => addBooking.mutate()}>{t('common.save')}</Button></Group></Stack></Modal>
      <ConfirmModal opened={!!delExp} onClose={() => setDelExp(null)} loading={delExpense.isPending} onConfirm={() => delExpense.mutate()} />
    </>
  );
}

