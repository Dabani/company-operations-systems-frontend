import { Alert, Badge, Button, Card, Center, Group, Loader, Menu, Modal, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconEye, IconPencil, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { SupplierFormModal, type SupplierForEdit } from '@/components/SupplierFormModal';
import { BANK_COLOR, SUPPLIER_COLOR, SUPPLIER_REASON_MOVES, reasonOk } from '@/lib/procurement';
import { toastError, toastOk } from '@/lib/ui';

interface Bank { id: string; bank_name: string; account_name: string; account_number: string; swift_code: string | null; currency_code: string | null; status: string; proposed_by: string | null; verified_by: string | null; verified_at: string | null; verification_note: string | null; can_verify: boolean }
interface Detail extends SupplierForEdit {
  code: string; status: string; category: string | null; status_reason?: string | null; approval_request_id?: string | null; approved_at?: string | null;
  history?: { status: string; by: string | null; note: string | null; at: string }[]; bank_accounts?: Bank[];
  me: { can_edit: boolean; can_submit: boolean; moves: string[]; can_propose_bank: boolean; can_verify_bank?: boolean };
}

export function SupplierDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const key = ['supplier', id];
  const [editing, setEditing] = useState(false);
  const [move, setMove] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [verify, setVerify] = useState<{ bank: Bank; accept: boolean } | null>(null);
  const [vnote, setVnote] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/suppliers/${id}`)).data.data });
  const set = (d: Detail) => qc.setQueryData(key, d);
  const submit = useMutation({ mutationFn: async () => (await api.post<{ data: Detail }>(`/suppliers/${id}/submit`, {})).data.data, onSuccess: (d) => { set(d); setSubmitting(false); toastOk(t('sup.submitted')); }, onError: (e) => { setSubmitting(false); toastError(e); } });
  const status = useMutation({ mutationFn: async (v: { to: string; note: string }) => (await api.post<{ data: Detail }>(`/suppliers/${id}/status`, { to: v.to, note: v.note || null })).data.data, onSuccess: (d) => { set(d); setMove(null); setNote(''); toastOk(); }, onError: toastError });
  const verifyM = useMutation({ mutationFn: async (v: { id: string; accept: boolean; note: string }) => (await api.post<{ data: Detail }>(`/supplier-bank-accounts/${v.id}/verify`, { accept: v.accept, note: v.note || null })).data.data,
    onSuccess: (d) => { set(d); setVerify(null); setVnote(''); toastOk(); }, onError: toastError });
  const reveal = useMutation({ mutationFn: async (bid: string) => ({ bid, n: (await api.post<{ data: { account_number: string } }>(`/supplier-bank-accounts/${bid}/reveal`, {})).data.data.account_number }), onSuccess: (r) => setRevealed((x) => ({ ...x, [r.bid]: r.n })), onError: toastError });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const s = q.data;
  const full = s.legal_name !== undefined;

  return (
    <>
      <PageHeader title={s.name} description={`${s.code}${s.category ? ` · ${t(`sup.cat.${s.category}`, { defaultValue: s.category })}` : ''}`}
        actions={<>
          <StatusBadge label={t(`sup.status.${s.status}`)} color={SUPPLIER_COLOR[s.status]} />
          {s.me.can_edit && <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          {s.me.can_submit && <Button onClick={() => setSubmitting(true)}>{t('sup.submit')}</Button>}
          {s.me.moves.length > 0 && <Menu position="bottom-end"><Menu.Target><Button variant="light">{t('sup.change_status')}</Button></Menu.Target>
            <Menu.Dropdown>{s.me.moves.map((m) => <Menu.Item key={m} color={m === 'blocked' ? 'red' : undefined} onClick={() => { setMove(m); setNote(''); }}>{t(`sup.to.${m}`)}</Menu.Item>)}</Menu.Dropdown></Menu>}
        </>} />
      {s.status === 'under_review' && <Alert color="orange" variant="light" mb="md">{t('sup.under_review_note')} <Link to="/approvals">{t('sup.open_approvals')}</Link></Alert>}
      {s.status_reason && ['draft', 'suspended', 'blocked'].includes(s.status) && <Alert color={s.status === 'draft' ? 'orange' : 'red'} variant="light" mb="md">{s.status_reason}</Alert>}
      {full && (
        <Card withBorder padding="md" mb="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {([['sup.legal_name', s.legal_name], ['sup.tax_number', s.tax_number], ['sup.registration_number', s.registration_number], ['sup.country', s.country_code], ['common.email', s.email], ['common.phone', s.phone], ['sup.contact', s.contact_name], ['sup.address', s.address]] as [string, string | null | undefined][])
              .map(([k, v]) => <div key={k}><Text size="xs" c="dimmed">{t(k)}</Text><Text size="sm">{v || '—'}</Text></div>)}
          </SimpleGrid>
        </Card>)}
      {s.bank_accounts && (
        <Card withBorder padding="md" mb="md">
          <Group justify="space-between" mb="xs"><Title order={5}>{t('sup.bank')}</Title>{s.me.can_propose_bank && <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setBankOpen(true)}>{t('sup.bank_propose')}</Button>}</Group>
          <Text size="xs" c="dimmed" mb="xs">{t('sup.bank_help')}</Text>
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="xs">
              <Table.Tbody>
                {s.bank_accounts.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{t('sup.bank_none')}</Text></Table.Td></Table.Tr>}
                {s.bank_accounts.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td><Text size="sm" fw={500}>{b.bank_name}{b.currency_code ? ` · ${b.currency_code}` : ''}</Text><Text size="xs" c="dimmed">{b.account_name}{b.swift_code ? ` · ${b.swift_code}` : ''}</Text></Table.Td>
                    <Table.Td><Group gap={6} wrap="nowrap"><Text size="sm" ff="monospace">{revealed[b.id] ?? b.account_number}</Text>
                      {s.me.can_verify_bank && !revealed[b.id] && <Button size="compact-xs" variant="subtle" leftSection={<IconEye size={12} />} loading={reveal.isPending && reveal.variables === b.id} onClick={() => reveal.mutate(b.id)}>{t('sup.bank_reveal')}</Button>}</Group></Table.Td>
                    <Table.Td><Badge color={BANK_COLOR[b.status]} variant="light">{t(`sup.bank_status.${b.status}`)}</Badge>
                      {b.verified_by && <Text size="xs" c="dimmed">{b.verified_by}</Text>}{b.verification_note && <Text size="xs" c="dimmed">{b.verification_note}</Text>}</Table.Td>
                    <Table.Td>{b.can_verify && <Group gap={4} wrap="nowrap"><Button size="compact-xs" onClick={() => { setVerify({ bank: b, accept: true }); setVnote(''); }}>{t('sup.bank_confirm')}</Button>
                      <Button size="compact-xs" color="red" variant="light" onClick={() => { setVerify({ bank: b, accept: false }); setVnote(''); }}>{t('sup.bank_reject')}</Button></Group>}
                      {b.status === 'pending_verification' && !b.can_verify && <Text size="xs" c="dimmed">{t('sup.bank_waiting', { name: b.proposed_by ?? '' })}</Text>}</Table.Td>
                  </Table.Tr>))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>)}
      {s.history && s.history.length > 0 && (
        <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
          <Stack gap={4}>{s.history.map((h, i) => <Text size="xs" key={i}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? t('sup.system')}: {t(`sup.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>)}
      <SupplierFormModal opened={editing} onClose={() => setEditing(false)} supplier={s} onSaved={() => { void qc.invalidateQueries({ queryKey: key }); }} />
      <BankModal opened={bankOpen} onClose={() => setBankOpen(false)} supplierId={s.id} onSaved={(d) => set(d)} />
      <ConfirmModal opened={submitting} onClose={() => setSubmitting(false)} loading={submit.isPending} title={t('sup.submit')} text={t('sup.submit_text')} onConfirm={() => submit.mutate()} />
      <Modal opened={!!move} onClose={() => setMove(null)} centered title={move ? t(`sup.to.${move}`) : ''}>
        <Stack gap="sm">
          <TextInput label={t('sup.reason')} required={!!move && SUPPLIER_REASON_MOVES.includes(move)} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setMove(null)}>{t('common.cancel')}</Button>
            <Button loading={status.isPending} disabled={!move || (SUPPLIER_REASON_MOVES.includes(move) && !reasonOk(note))} onClick={() => move && status.mutate({ to: move, note: note.trim() })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      <Modal opened={!!verify} onClose={() => setVerify(null)} centered title={verify?.accept ? t('sup.bank_confirm') : t('sup.bank_reject')}>
        <Stack gap="sm">
          {verify && <Text size="sm">{verify.bank.bank_name} · {verify.bank.account_name} · {verify.bank.account_number}</Text>}
          <Alert color="blue" variant="light">{t('sup.bank_confirm_help')}</Alert>
          <TextInput label={t('sup.reason')} required={!verify?.accept} maxLength={1000} value={vnote} onChange={(e) => setVnote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setVerify(null)}>{t('common.cancel')}</Button>
            <Button color={verify?.accept ? undefined : 'red'} loading={verifyM.isPending} disabled={!verify || (!verify.accept && !reasonOk(vnote))} onClick={() => verify && verifyM.mutate({ id: verify.bank.id, accept: verify.accept, note: vnote.trim() })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}

function BankModal({ opened, onClose, supplierId, onSaved }: { opened: boolean; onClose: () => void; supplierId: string; onSaved: (d: Detail) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState({ bank_name: '', account_name: '', account_number: '', swift_code: '', currency_code: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => (await api.post<{ data: Detail }>(`/suppliers/${supplierId}/bank-accounts`, { ...v, swift_code: v.swift_code || null, currency_code: v.currency_code || null })).data.data,
    onSuccess: (d) => { onSaved(d); setV({ bank_name: '', account_name: '', account_number: '', swift_code: '', currency_code: '' }); setErrors({}); toastOk(t('sup.bank_proposed')); onClose(); },
    onError: (e) => { setErrors(parseError(e).fields as Record<string, string>); toastError(e); },
  });
  const f = (k: keyof typeof v, label: string, extra: Record<string, unknown> = {}) => <TextInput label={label} value={v[k]} error={errors[k]} onChange={(e) => setV({ ...v, [k]: e.currentTarget.value })} {...extra} />;
  return (
    <Modal opened={opened} onClose={onClose} centered title={t('sup.bank_propose')}>
      <Stack gap="sm">
        <Alert color="blue" variant="light">{t('sup.bank_help')}</Alert>
        {f('bank_name', t('sup.bank_name'), { required: true, maxLength: 150 })}{f('account_name', t('sup.account_name'), { required: true, maxLength: 190 })}
        {f('account_number', t('sup.account_number'), { required: true, maxLength: 60, autoComplete: 'off' })}{f('swift_code', t('sup.swift'), { maxLength: 20 })}{f('currency_code', t('ev.currency'), { maxLength: 3 })}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button loading={save.isPending} disabled={!v.bank_name || !v.account_name || v.account_number.length < 4} onClick={() => save.mutate()}>{t('common.save')}</Button></Group>
      </Stack>
    </Modal>
  );
}
