import { Alert, Anchor, Button, Card, Center, Group, Loader, Modal, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { PurchaseRequisitionFormModal, type ReqForEdit } from '@/components/PurchaseRequisitionFormModal';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { REQ_COLOR, fmtCents, reasonOk, toCents } from '@/lib/procurement';
import { toastError, toastOk } from '@/lib/ui';

interface Detail extends Omit<ReqForEdit, 'project' | 'preferred_supplier' | 'lines'> {
  code: string; type: string; status: string; department: string | null; project: { id: string; code: string; name: string } | null; requester: { id: string; name: string | null };
  preferred_supplier: { id: string; code: string; name: string } | null; total_amount: string; over_budget: boolean; split_suspected: boolean; approval_request_id: string | null; decision_note: string | null;
  lines: { line_no: number; description: string; quantity: string; unit: string | null; unit_price: string; line_total: string }[];
  history: { status: string; by: string | null; note: string | null; at: string }[];
  me: { can_edit: boolean; can_submit: boolean; can_cancel: boolean; can_reopen: boolean; can_delete: boolean };
}

export function PurchaseRequisitionDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const key = ['requisition', id];
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/purchase-requisitions/${id}`)).data.data });
  const set = (d: Detail) => qc.setQueryData(key, d);
  const submit = useMutation({ mutationFn: async () => (await api.post<{ data: Detail }>(`/purchase-requisitions/${id}/submit`, {})).data.data, onSuccess: (d) => { set(d); setSubmitting(false); toastOk(t('req.submitted')); }, onError: (e) => { setSubmitting(false); toastError(e); } });
  const move = useMutation({ mutationFn: async (v: { to: string; note: string }) => (await api.post<{ data: Detail }>(`/purchase-requisitions/${id}/status`, { to: v.to, note: v.note || null })).data.data, onSuccess: (d) => { set(d); setCancelling(false); setNote(''); toastOk(); }, onError: toastError });
  const del = useMutation({ mutationFn: async () => (await api.delete(`/purchase-requisitions/${id}`)).data, onSuccess: () => { toastOk(); nav('/requisitions'); }, onError: toastError });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const r = q.data;
  const money = (v: string | number) => fmtCents(toCents(v), r.currency_code, i18n.language);

  return (
    <>
      <PageHeader title={r.title} description={`${r.code} · ${t(`req.type.${r.type}`, { defaultValue: r.type })}`}
        actions={<>
          <StatusBadge label={t(`req.status.${r.status}`)} color={REQ_COLOR[r.status]} />
          {r.me.can_edit && <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          {r.me.can_submit && <Button onClick={() => setSubmitting(true)}>{t('req.submit')}</Button>}
          {r.me.can_reopen && <Button variant="light" loading={move.isPending} onClick={() => move.mutate({ to: 'draft', note: '' })}>{t('req.reopen')}</Button>}
          {r.me.can_cancel && <Button variant="light" color="red" onClick={() => { setCancelling(true); setNote(''); }}>{t('req.cancel')}</Button>}
          {r.me.can_delete && <Button variant="subtle" color="red" onClick={() => setDeleting(true)}>{t('common.delete')}</Button>}
        </>} />
      {r.status === 'pending_approval' && <Alert color="orange" variant="light" mb="md">{t('req.pending_note')} <Anchor component={Link} to="/approvals">{t('sup.open_approvals')}</Anchor></Alert>}
      {r.decision_note && ['rejected', 'draft', 'cancelled'].includes(r.status) && <Alert color={r.status === 'cancelled' ? 'gray' : 'red'} variant="light" mb="md" title={t('req.decision_note')}>{r.decision_note}</Alert>}
      {r.over_budget && <Alert color="red" variant="light" mb="md" title={t('req.over_budget')}>{r.exception_reason}</Alert>}
      {r.split_suspected && <Alert color="orange" variant="light" mb="md">{t('req.split_note')}</Alert>}
      <Card withBorder padding="md" mb="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <div><Text size="xs" c="dimmed">{t('req.requester')}</Text><Text size="sm">{r.requester.name}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.cost_centre')}</Text><Text size="sm">{r.department ?? '—'}</Text></div>
          <div><Text size="xs" c="dimmed">{t('ev.project')}</Text><Text size="sm">{r.project ? `${r.project.code} ${r.project.name}` : '—'}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.needed_by')}</Text><Text size="sm">{r.needed_by}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.delivery')}</Text><Text size="sm">{r.delivery_location}</Text></div>
          <div><Text size="xs" c="dimmed">{t('req.preferred_supplier')}</Text><Text size="sm">{r.preferred_supplier ? `${r.preferred_supplier.code} ${r.preferred_supplier.name}` : '—'}</Text>{r.preferred_supplier_reason && <Text size="xs" c="dimmed">{r.preferred_supplier_reason}</Text>}</div>
        </SimpleGrid>
        {r.purpose && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed">{t('req.purpose')}</Text><SafeHtml html={r.purpose} /></div>}
      </Card>
      <Card withBorder padding="md" mb="md">
        <Title order={5} mb="xs">{t('req.lines')}</Title>
        <Table.ScrollContainer minWidth={480}>
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t('req.line_description')}</Table.Th><Table.Th ta="right">{t('req.quantity')}</Table.Th><Table.Th ta="right">{t('req.unit_price')}</Table.Th><Table.Th ta="right">{t('req.total')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {r.lines.map((l) => <Table.Tr key={l.line_no}><Table.Td>{l.line_no}</Table.Td><Table.Td>{l.description}</Table.Td><Table.Td ta="right">{Number(l.quantity)}{l.unit ? ` ${l.unit}` : ''}</Table.Td><Table.Td ta="right">{money(l.unit_price)}</Table.Td><Table.Td ta="right">{money(l.line_total)}</Table.Td></Table.Tr>)}
              <Table.Tr><Table.Td colSpan={4} ta="right"><b>{t('req.total')}</b></Table.Td><Table.Td ta="right"><b>{money(r.total_amount)}</b></Table.Td></Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
      {r.history.length > 0 && <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
        <Stack gap={4}>{r.history.map((h, i) => <Text size="xs" key={i}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? t('sup.system')}: {t(`req.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>}
      <PurchaseRequisitionFormModal opened={editing} onClose={() => setEditing(false)} requisition={{ ...r, project: r.project, preferred_supplier: r.preferred_supplier, lines: r.lines } as ReqForEdit} onSaved={() => { void qc.invalidateQueries({ queryKey: key }); }} />
      <ConfirmModal opened={submitting} onClose={() => setSubmitting(false)} loading={submit.isPending} title={t('req.submit')} text={t('req.submit_text')} onConfirm={() => submit.mutate()} />
      <ConfirmModal opened={deleting} onClose={() => setDeleting(false)} loading={del.isPending} onConfirm={() => del.mutate()} />
      <Modal opened={cancelling} onClose={() => setCancelling(false)} centered title={t('req.cancel')}>
        <Stack gap="sm">
          <TextInput label={t('sup.reason')} required maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCancelling(false)}>{t('common.cancel')}</Button>
            <Button color="red" loading={move.isPending} disabled={!reasonOk(note)} onClick={() => move.mutate({ to: 'cancelled', note: note.trim() })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
