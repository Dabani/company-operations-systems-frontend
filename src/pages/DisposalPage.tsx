import { Alert, Badge, Button, Checkbox, Drawer, Group, Modal, Paper, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { IconFileTypePdf, IconTrashX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, downloadBlob } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import type { LV } from '@/types';

interface Eligible { id: string; reference: string; title: string; index_code: string; category: string; format: string; retention_until: string; location: string | null }
interface Batch {
  id: string; reference: string; status: LV; proposed_by: string | null; note: string | null; decided_by: string | null; decision_note: string | null; executed_by: string | null; executed_at: string | null;
  method: string | null; witness: string | null; records_count: number; created_at: string; can_decide: boolean;
  records?: { id: string; reference: string; title: string; index_code: string; category: string; format: string; retention_until: string | null }[];
}

export function DisposalPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [method, setMethod] = useState('');
  const [witness, setWitness] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  const eligible = useQuery({ queryKey: ['disposal-eligible'], queryFn: async () => (await api.get<{ data: Eligible[] }>('/disposal/eligible')).data.data });
  const batches = useQuery({ queryKey: ['disposal-batches'], queryFn: async () => (await api.get<{ data: Batch[] }>('/disposal-batches')).data.data });
  const detail = useQuery({ queryKey: ['disposal-batch', open], enabled: !!open, queryFn: async () => (await api.get<{ data: Batch }>(`/disposal-batches/${open}`)).data.data });
  const b = detail.data;
  const refresh = () => { ['disposal-eligible', 'disposal-batches', 'disposal-batch', 'records', 'record'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); };

  const propose = useMutation({
    mutationFn: async () => api.post('/disposal-batches', { record_ids: selected, note }),
    onSuccess: () => { toastOk(); setSelected([]); setNote(''); refresh(); }, onError: toastError,
  });
  const decide = useMutation({
    mutationFn: async (what: 'approve' | 'reject') => api.post(`/disposal-batches/${open}/${what}`, { note: decisionNote }),
    onSuccess: () => { toastOk(); setDecisionNote(''); refresh(); }, onError: toastError,
  });
  const execute = useMutation({
    mutationFn: async () => api.post(`/disposal-batches/${open}/execute`, { method, witness }),
    onSuccess: () => { toastOk(); setExecuting(false); refresh(); }, onError: toastError,
  });

  const rows = eligible.data ?? [];
  const all = rows.length > 0 && selected.length === rows.length;

  return (
    <>
      <PageHeader title={t('dsp.title')} description={t('dsp.four_eyes')} />
      <Tabs defaultValue="eligible" keepMounted={false}>
        <Tabs.List mb="md"><Tabs.Tab value="eligible">{t('dsp.eligible')}{rows.length > 0 && <Badge ml={6} size="xs" color="orange" circle>{rows.length}</Badge>}</Tabs.Tab><Tabs.Tab value="batches">{t('dsp.batches')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="eligible">
          <Stack>
            <Text size="sm" c="dimmed">{t('dsp.select_hint')}</Text>
            <Paper withBorder>
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs" striped="odd">
                  <Table.Thead><Table.Tr><Table.Th w={36}>{can('archive.manage') && <Checkbox checked={all} indeterminate={selected.length > 0 && !all} onChange={() => setSelected(all ? [] : rows.map((r) => r.id))} />}</Table.Th><Table.Th>{t('case.reference')}</Table.Th><Table.Th>{t('case.subject')}</Table.Th><Table.Th>{t('rec.category')}</Table.Th><Table.Th>{t('rec.retention_until')}</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>{rows.map((r) => (
                    <Table.Tr key={r.id}><Table.Td>{can('archive.manage') && <Checkbox checked={selected.includes(r.id)} onChange={(e) => setSelected((s) => e.currentTarget.checked ? [...s, r.id] : s.filter((x) => x !== r.id))} />}</Table.Td>
                      <Table.Td ff="monospace">{r.reference}</Table.Td><Table.Td><Text size="sm" lineClamp={1}>{r.title}</Text><Text size="xs" c="dimmed" ff="monospace">{r.index_code}</Text></Table.Td><Table.Td>{r.category}</Table.Td><Table.Td>{r.retention_until}</Table.Td></Table.Tr>))}</Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {rows.length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">{t('common.no_data')}</Text>}
            </Paper>
            {can('archive.manage') && selected.length > 0 && (
              <Group align="flex-end"><TextInput label={t('arc.note')} flex={1} value={note} maxLength={500} onChange={(e) => setNote(e.currentTarget.value)} />
                <Button color="orange" leftSection={<IconTrashX size={16} />} loading={propose.isPending} onClick={() => propose.mutate()}>{t('dsp.propose')} ({selected.length})</Button></Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="batches">
          <Paper withBorder>
            <Table.ScrollContainer minWidth={560}>
              <Table highlightOnHover striped="odd" verticalSpacing="sm">
                <Table.Thead><Table.Tr><Table.Th>{t('case.reference')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('dsp.records')}</Table.Th><Table.Th>{t('dsp.proposed_by')}</Table.Th><Table.Th>{t('common.created_at')}</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>{(batches.data ?? []).map((x) => (
                  <Table.Tr key={x.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(x.id)}><Table.Td ff="monospace">{x.reference}</Table.Td><Table.Td><StatusBadge label={x.status.label} color={x.status.color} /></Table.Td><Table.Td>{x.records_count}</Table.Td><Table.Td>{x.proposed_by}</Table.Td><Table.Td>{fmtDateTime(x.created_at, i18n.language)}</Table.Td></Table.Tr>))}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {(batches.data ?? []).length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">{t('common.no_data')}</Text>}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="lg" title={b ? <Group gap="xs"><Badge variant="outline" ff="monospace">{b.reference}</Badge><StatusBadge label={b.status.label} color={b.status.color} /></Group> : ''}>
        {b && (
          <Stack gap="md">
            <Text size="sm">{t('dsp.proposed_by')}: <b>{b.proposed_by}</b>{b.note ? ` — ${b.note}` : ''}</Text>
            {b.decided_by && <Text size="sm">{t('movement.approved_by')}: <b>{b.decided_by}</b>{b.decision_note ? ` — ${b.decision_note}` : ''}</Text>}
            {b.executed_at && <Text size="sm">{t('dsp.method')}: <b>{b.method}</b> · {t('dsp.witness')}: {b.witness ?? '—'} · {fmtDateTime(b.executed_at, i18n.language)}</Text>}
            <Table withTableBorder fz="sm"><Table.Thead><Table.Tr><Table.Th>{t('case.reference')}</Table.Th><Table.Th>{t('case.subject')}</Table.Th><Table.Th>{t('rec.category')}</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{(b.records ?? []).map((r) => <Table.Tr key={r.id}><Table.Td ff="monospace">{r.reference}</Table.Td><Table.Td>{r.title}<Text size="xs" c="dimmed" ff="monospace">{r.index_code}</Text></Table.Td><Table.Td>{r.category}</Table.Td></Table.Tr>)}</Table.Tbody></Table>

            {b.can_decide && (
              <Stack gap="xs"><TextInput label={t('arc.note')} value={decisionNote} maxLength={500} onChange={(e) => setDecisionNote(e.currentTarget.value)} />
                <Group><Button color="green" loading={decide.isPending} onClick={() => decide.mutate('approve')}>{t('dsp.approve')}</Button><Button variant="default" onClick={() => decide.mutate('reject')}>{t('dsp.reject')}</Button></Group></Stack>
            )}
            {b.status.code === 'approved' && can('archive.manage') && <Button color="red" leftSection={<IconTrashX size={16} />} onClick={() => { setMethod(''); setWitness(''); setExecuting(true); }}>{t('dsp.execute')}</Button>}
            {b.status.code === 'executed' && <Button variant="default" leftSection={<IconFileTypePdf size={16} />} onClick={() => downloadBlob(`/disposal-batches/${b.id}/certificate`, `${b.reference}.pdf`).catch(toastError)}>{t('dsp.certificate')}</Button>}
          </Stack>
        )}
      </Drawer>

      <Modal opened={executing} onClose={() => setExecuting(false)} title={t('dsp.execute')} centered>
        <Stack>
          <Alert color="red" variant="light">{t('dsp.execute_warning')}</Alert>
          <TextInput label={t('dsp.method')} required value={method} maxLength={150} onChange={(e) => setMethod(e.currentTarget.value)} />
          <TextInput label={t('dsp.witness')} value={witness} maxLength={150} onChange={(e) => setWitness(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setExecuting(false)}>{t('common.cancel')}</Button><Button color="red" disabled={!method.trim()} loading={execute.isPending} onClick={() => execute.mutate()}>{t('dsp.execute')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
