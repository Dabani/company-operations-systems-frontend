import { Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconEdit, IconRestore } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Rule {
  category: { id: string; code: string; label: string }; retention_years: number; disposal_action: { id: string; code: string; label: string } | null;
  legal_reference: { id: string; code: string; title: string } | null; notes: string | null; overridden: boolean; default_years: number | null;
}
interface Data { rules: Rule[]; settings: { transfer_days: number; default_retention_years: number; training_retention_years?: number } }

export function RetentionPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('compliance.manage');
  const actions = useLookup('record_disposal_action');
  const [edit, setEdit] = useState<Rule | null>(null);
  const [years, setYears] = useState<number | string>(10);
  const [action, setAction] = useState<string | null>(null);
  const [legal, setLegal] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [transfer, setTransfer] = useState<number | string>(30);
  const [dflt, setDflt] = useState<number | string>(10);
  const [trainYears, setTrainYears] = useState<number | string>(3);

  const q = useQuery({ queryKey: ['retention'], queryFn: async () => (await api.get<{ data: Data }>('/retention-rules')).data.data });
  const refs = useQuery({ queryKey: ['legal-refs'], queryFn: async () => (await api.get<{ data: { id: string; code: string; title: string }[] }>('/legal-references')).data.data });
  useEffect(() => { if (q.data) { setTransfer(q.data.settings.transfer_days); setDflt(q.data.settings.default_retention_years); setTrainYears(q.data.settings.training_retention_years ?? 3); } }, [q.data]);

  const done = (r: { data: { data: { records_redated: number } } }) => { toastOk(t('ret.redated', { count: r.data.data.records_redated })); setEdit(null); void qc.invalidateQueries({ queryKey: ['retention'] }); void qc.invalidateQueries({ queryKey: ['records'] }); };
  const save = useMutation({
    mutationFn: async () => api.put(`/retention-rules/${edit!.category.id}`, { retention_years: years, disposal_action_id: action, legal_reference_id: legal, notes }),
    onSuccess: done, onError: toastError,
  });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/retention-rules/${id}`), onSuccess: done, onError: toastError });
  const saveSettings = useMutation({ mutationFn: async () => api.put('/archive-settings', { transfer_days: transfer, default_retention_years: dflt, training_retention_years: trainYears }), onSuccess: done, onError: toastError });

  const open = (r: Rule) => { setEdit(r); setYears(r.retention_years); setAction(r.disposal_action?.id ?? actions.items.find((a) => a.code === 'destroy')?.id ?? null); setLegal(r.legal_reference?.id ?? null); setNotes(r.notes ?? ''); };

  return (
    <>
      <PageHeader title={t('ret.title')} />
      <Stack gap="md">
        <Card padding="md">
          <Group align="flex-end" wrap="wrap">
            <NumberInput label={t('ret.transfer_days')} min={1} max={365} value={transfer} onChange={setTransfer} disabled={!manage} w={280} />
            <NumberInput label={t('ret.default_years')} min={1} max={100} value={dflt} onChange={setDflt} disabled={!manage} w={220} />
            <NumberInput label={t('trn.retention_years')} min={1} max={50} value={trainYears} onChange={setTrainYears} disabled={!manage} w={260} />
            {manage && <Button loading={saveSettings.isPending} onClick={() => saveSettings.mutate()}>{t('common.save')}</Button>}
          </Group>
        </Card>

        <Card padding={0}>
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm" striped="odd">
              <Table.Thead><Table.Tr><Table.Th>{t('rec.category')}</Table.Th><Table.Th>{t('ret.years')}</Table.Th><Table.Th>{t('ret.action')}</Table.Th><Table.Th>{t('ret.legal')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>{(q.data?.rules ?? []).map((r) => (
                <Table.Tr key={r.category.id}>
                  <Table.Td><Text size="sm" fw={600}>{r.category.label}</Text>{r.notes && <Text size="xs" c="dimmed" lineClamp={1}>{r.notes}</Text>}</Table.Td>
                  <Table.Td>{r.retention_years} <Badge size="xs" variant="light" color={r.overridden ? 'brand' : 'gray'}>{r.overridden ? t('ret.overridden') : t('ret.default')}</Badge></Table.Td>
                  <Table.Td>{r.disposal_action?.label ?? '—'}</Table.Td>
                  <Table.Td>{r.legal_reference ? <Text size="xs">{r.legal_reference.code}</Text> : '—'}</Table.Td>
                  <Table.Td>{manage && <Group gap={4} wrap="nowrap"><Button size="compact-xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => open(r)}>{t('ret.override')}</Button>
                    {r.overridden && <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconRestore size={14} />} loading={remove.isPending} onClick={() => remove.mutate(r.category.id)}>{t('ret.remove')}</Button>}</Group>}</Table.Td>
                </Table.Tr>))}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      </Stack>

      <Modal opened={!!edit} onClose={() => setEdit(null)} title={`${t('ret.override')}: ${edit?.category.label ?? ''}`} centered>
        <Stack>
          <NumberInput label={t('ret.years')} min={1} max={100} value={years} onChange={setYears} required />
          <Select label={t('ret.action')} data={actions.options} value={action} onChange={setAction} allowDeselect={false} />
          <Select label={t('ret.legal')} clearable searchable data={(refs.data ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.title}` }))} value={legal} onChange={setLegal} />
          <TextInput label={t('leg.notes')} value={notes} maxLength={500} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
