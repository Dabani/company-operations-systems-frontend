import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Rule { id: string; rule_key: string; bound: string; value: string; unit: string | null; valid_from: string; valid_to: string | null; source_citation: string; verification: string; leave_type: string | null; sex: string | null; min_age: number | null; max_age: number | null; created_by: string | null }

/**
 * Statutory limits over the company policy. A value is entered with its source, then verified by a DIFFERENT person.
 * Until then it is flagged "unverified" and the system does not apply it. A verified rule is never edited: it is ended and a new one is entered.
 */
export function LeaveLegalPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const types = useLookup('leave_type');
  const bounds = useLookup('legal_bound');
  const sexes = useLookup('employee_sex');
  const [modal, setModal] = useState(false);
  const [ending, setEnding] = useState<Rule | null>(null);
  const [endDate, setEndDate] = useState('');
  const form = useForm({ initialValues: { rule_key: '', bound_type_id: '', value: '' as number | string, unit: '', valid_from: '', valid_to: '', source_citation: '', leave_type_id: '', sex_id: '', min_age: '' as number | string, max_age: '' as number | string } });
  const q = useQuery({ queryKey: ['leave-legal'], queryFn: async () => (await api.get<{ data: Rule[] }>('/leave/legal-rules')).data.data });
  const keys = useQuery({ queryKey: ['leave-policy-keys'], queryFn: async () => (await api.get<{ data: { key: string }[] }>('/leave/policy/keys')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['leave-legal'] }); void qc.invalidateQueries({ queryKey: ['leave-status'] }); void qc.invalidateQueries({ queryKey: ['leave-violations'] }); };
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/leave/legal-rules', { ...v, unit: v.unit || undefined, valid_to: v.valid_to || undefined, leave_type_id: v.leave_type_id || undefined, sex_id: v.sex_id || undefined, min_age: v.min_age === '' ? undefined : v.min_age, max_age: v.max_age === '' ? undefined : v.max_age }),
    onSuccess: () => { toastOk(t('leave.rule_saved')); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/leave/legal-rules/${id}/verify`), onSuccess: () => { toastOk(t('leave.rule_verified')); refresh(); }, onError: toastError });
  const end = useMutation({ mutationFn: async () => api.post(`/leave/legal-rules/${ending!.id}/end`, { valid_to: endDate }), onSuccess: () => { toastOk(); setEnding(null); refresh(); }, onError: toastError });
  const unverified = (q.data ?? []).filter((r) => r.verification !== 'verified').length;

  return (
    <>
      <Group justify="space-between" mb="sm" align="flex-start"><Text size="sm" c="dimmed" maw={680}>{t('leave.legal_hint')}</Text>
        {can('hr.leave.legal.manage') && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button>}</Group>
      {unverified > 0 && <Alert color="orange" variant="light" mb="sm">{t('leave.unverified_alert', { count: unverified })}</Alert>}
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>{t('leave.policy_key')}</Table.Th><Table.Th>{t('leave.type')}</Table.Th><Table.Th>{t('leave.limit')}</Table.Th><Table.Th>{t('leave.eligibility')}</Table.Th><Table.Th>{t('leave.valid')}</Table.Th><Table.Th>{t('leave.source')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(q.data ?? []).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td><code>{r.rule_key}</code></Table.Td>
                <Table.Td>{r.leave_type ? (types.items.find((l) => l.code === r.leave_type)?.label ?? r.leave_type) : t('leave.all_types')}</Table.Td>
                <Table.Td>{t(`leave.bound.${r.bound}`)} {Number(r.value)} {r.unit}</Table.Td>
                <Table.Td><Text size="xs">{[r.sex ? (sexes.items.find((s) => s.code === r.sex)?.label ?? r.sex) : null, r.min_age !== null || r.max_age !== null ? t('leave.age_range', { min: r.min_age ?? 0, max: r.max_age ?? '∞' }) : null].filter(Boolean).join(' · ') || t('leave.everyone')}</Text></Table.Td>
                <Table.Td><Text size="xs">{r.valid_from} → {r.valid_to ?? '…'}</Text></Table.Td>
                <Table.Td><Text size="xs" lineClamp={2}>{r.source_citation}</Text><Text size="xs" c="dimmed">{r.created_by}</Text></Table.Td>
                <Table.Td><Badge color={r.verification === 'verified' ? 'green' : 'orange'} variant={r.verification === 'verified' ? 'light' : 'filled'}>{t(`leave.verification.${r.verification}`)}</Badge></Table.Td>
                <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                  {r.verification !== 'verified' && can('rules.signoff') && <Button size="compact-xs" color="green" variant="light" loading={verify.isPending} onClick={() => verify.mutate(r.id)}>{t('leave.verify')}</Button>}
                  {can('hr.leave.legal.manage') && !r.valid_to && <Button size="compact-xs" variant="subtle" onClick={() => { setEnding(r); setEndDate(''); }}>{t('leave.end_rule')}</Button>}
                </Group></Table.Td>
              </Table.Tr>))}
            {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={8}><Text size="sm" c="dimmed">{t('leave.legal_none')}</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={modal} onClose={() => setModal(false)} title={t('leave.add_rule')} centered size="lg">
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Alert color="blue" variant="light">{t('leave.rule_unverified_note')}</Alert>
          <Group grow align="flex-start"><Select label={t('leave.policy_key')} required searchable data={(keys.data ?? []).map((k) => ({ value: k.key, label: k.key }))} {...form.getInputProps('rule_key')} />
            <Select label={t('leave.limit')} required data={bounds.options} {...form.getInputProps('bound_type_id')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('leave.value')} required decimalScale={4} min={0} {...form.getInputProps('value')} /><TextInput label={t('leave.unit')} placeholder="days" maxLength={30} {...form.getInputProps('unit')} /></Group>
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.valid_from')} required {...form.getInputProps('valid_from')} /><TextInput type="date" label={t('leave.valid_to')} {...form.getInputProps('valid_to')} /></Group>
          <TextInput label={t('leave.source')} description={t('leave.source_hint')} required maxLength={255} {...form.getInputProps('source_citation')} />
          <Select label={t('leave.type')} description={t('leave.rule_type_hint')} clearable data={types.options} {...form.getInputProps('leave_type_id')} />
          <Group grow align="flex-start"><Select label={t('leave.sex')} clearable data={sexes.options} {...form.getInputProps('sex_id')} /><NumberInput label={t('leave.min_age')} min={0} max={120} {...form.getInputProps('min_age')} /><NumberInput label={t('leave.max_age')} min={0} max={120} {...form.getInputProps('max_age')} /></Group>
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!ending} onClose={() => setEnding(null)} title={t('leave.end_rule')} centered size="sm">
        <Stack gap="sm"><Text size="sm" c="dimmed">{t('leave.end_rule_hint')}</Text><TextInput type="date" label={t('leave.valid_to')} required value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEnding(null)}>{t('common.cancel')}</Button><Button disabled={!endDate} loading={end.isPending} onClick={() => end.mutate()}>{t('common.save')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
