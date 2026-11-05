import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';

interface Ver { id: string; version: number; status: string; verification: string; effective_from: string; effective_to: string | null; priority: number }
interface SetRow { id: string; code: string; name: string; domain: string; is_legal_profile: boolean; requires_full_coverage: boolean; versions: Ver[] }
interface Legal { id: string; code: string; name: string; bound_type: string; value: string; unit: string | null; valid_from: string; source_citation: string | null; verification: string }
interface Flow { id: string; name: string; version: number; is_active: boolean }
const COLOR: Record<string, string> = { draft: 'gray', impact_check: 'yellow', pending_approval: 'orange', active: 'green', superseded: 'gray', expired: 'gray', unverified: 'red', verified: 'green', not_required: 'gray' };

export function RulesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const domains = useLookup('rule_domain');
  const [newSet, setNewSet] = useState(false);
  const [versionFor, setVersionFor] = useState<SetRow | null>(null);
  const [impact, setImpact] = useState<{ ver: Ver; result: { samples: { sample: Record<string, string>; changes: boolean; current: { rule_set: string } | null; proposed: { rule_set: string } | null }[]; validation: { errors: string[]; warnings: string[] } } } | null>(null);
  const [sample, setSample] = useState<number | string>(1500000);

  const sets = useQuery({ queryKey: ['rule-sets'], queryFn: async () => (await api.get<{ data: SetRow[] }>('/rule-sets')).data.data });
  const legal = useQuery({ queryKey: ['legal'], queryFn: async () => (await api.get<{ data: Legal[] }>('/legal-parameters')).data.data });
  const flows = useQuery({ queryKey: ['flows'], enabled: can('approval.configure') || can('approval.view_all'), queryFn: async () => (await api.get<{ data: Flow[] }>('/approval-flows')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['rule-sets'] }); void qc.invalidateQueries({ queryKey: ['legal'] }); };

  const setForm = useForm({ initialValues: { domain_id: '', code: '', name: '', description: '', is_legal_profile: false, requires_full_coverage: false } });
  const verForm = useForm({ initialValues: { effective_from: new Date().toISOString().slice(0, 10), priority: 100, operator: 'gte', amount: '' as number | string, flow_id: '', rationale: '' } });

  const createSet = useMutation({ mutationFn: async (v: typeof setForm.values) => api.post('/rule-sets', v), onSuccess: () => { toastOk(); setNewSet(false); refresh(); }, onError: toastError });
  const createVer = useMutation({
    mutationFn: async (v: typeof verForm.values) => api.post(`/rule-sets/${versionFor!.id}/versions`, {
      effective_from: v.effective_from, priority: v.priority, rationale: v.rationale,
      conditions: v.amount === '' ? [] : [{ attribute: 'amount', operator: v.operator, decimal: String(v.amount) }],
      outcomes: [{ key: 'approval_flow', approval_flow_id: v.flow_id }],
    }),
    onSuccess: () => { toastOk(); setVersionFor(null); refresh(); }, onError: toastError,
  });
  const runImpact = useMutation({
    mutationFn: async (ver: Ver) => ({ ver, result: (await api.post(`/rule-versions/${ver.id}/impact`, { samples: [{ amount: String(sample), subject_type: 'contract' }] })).data }),
    onSuccess: (r) => { setImpact(r); refresh(); }, onError: toastError,
  });
  const act = useMutation({ mutationFn: async (v: { path: string }) => api.post(v.path), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('rules.title')} description={t('rules.intro')} actions={can('rules.configure') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setNewSet(true)}>{t('rules.new_set')}</Button> : undefined} />
      <Tabs defaultValue="sets">
        <Tabs.List mb="md"><Tabs.Tab value="sets">{t('rules.sets')}</Tabs.Tab><Tabs.Tab value="legal">{t('rules.legal')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="sets"><Stack gap="md">
          {sets.data?.map((s) => (
            <div key={s.id}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs"><Text fw={600}>{s.name}</Text><Badge variant="outline">{s.code}</Badge><Badge variant="light">{t(`rules.domain.${s.domain}`, { defaultValue: s.domain })}</Badge>
                  {s.is_legal_profile && <Badge color="red" variant="light">{t('rules.legal_profile')}</Badge>}</Group>
                {can('rules.configure') && <Button size="xs" variant="default" onClick={() => { setVersionFor(s); }}>{t('rules.new_version')}</Button>}
              </Group>
              <Table.ScrollContainer minWidth={560}><Table withTableBorder verticalSpacing="xs"><Table.Tbody>
                {s.versions.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>v{v.version}</Table.Td>
                    <Table.Td><Badge color={COLOR[v.status]} variant="light">{t(`rules.status.${v.status}`)}</Badge></Table.Td>
                    <Table.Td><Badge color={COLOR[v.verification]} variant="dot">{t(`rules.verification.${v.verification}`)}</Badge></Table.Td>
                    <Table.Td><Text size="xs">{v.effective_from} → {v.effective_to ?? '∞'} · P{v.priority}</Text></Table.Td>
                    <Table.Td><Group gap={4} justify="flex-end" wrap="nowrap">
                      {can('rules.configure') && ['draft', 'impact_check'].includes(v.status) && <Button size="compact-xs" variant="light" loading={runImpact.isPending} onClick={() => runImpact.mutate(v)}>{t('rules.impact')}</Button>}
                      {can('rules.configure') && v.status === 'impact_check' && <Button size="compact-xs" onClick={() => act.mutate({ path: `/rule-versions/${v.id}/submit` })}>{t('rules.submit')}</Button>}
                      {can('rules.signoff') && s.is_legal_profile && v.verification === 'unverified' && <Button size="compact-xs" color="green" variant="light" onClick={() => act.mutate({ path: `/rule-versions/${v.id}/signoff` })}>{t('rules.signoff')}</Button>}
                    </Group></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody></Table></Table.ScrollContainer>
            </div>
          ))}
          {sets.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('rules.none')}</Text>}
        </Stack></Tabs.Panel>

        <Tabs.Panel value="legal">
          <Alert color="orange" variant="light" mb="md">{t('rules.legal_note')}</Alert>
          <Table.ScrollContainer minWidth={600}><Table withTableBorder striped><Table.Thead><Table.Tr><Table.Th>{t('common.code')}</Table.Th><Table.Th>{t('rules.bound')}</Table.Th><Table.Th>{t('rules.value')}</Table.Th><Table.Th>{t('rules.source')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>{legal.data?.map((p) => (
              <Table.Tr key={p.id}><Table.Td>{p.code}</Table.Td><Table.Td>{t(`rules.bound_${p.bound_type}`)}</Table.Td><Table.Td>{Number(p.value)} {p.unit ?? ''}</Table.Td><Table.Td><Text size="xs">{p.source_citation}</Text></Table.Td>
                <Table.Td>{p.verification === 'verified' ? <Badge color="green" variant="light">{t('rules.verification.verified')}</Badge>
                  : can('rules.signoff') ? <Button size="compact-xs" onClick={() => act.mutate({ path: `/legal-parameters/${p.id}/verify` })}>{t('rules.verify')}</Button> : <Badge color="red" variant="light">{t('rules.verification.unverified')}</Badge>}</Table.Td></Table.Tr>))}</Table.Tbody></Table></Table.ScrollContainer>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={newSet} onClose={() => setNewSet(false)} title={t('rules.new_set')} centered>
        <form onSubmit={setForm.onSubmit((v) => createSet.mutate(v))}><Stack gap="sm">
          <Select label={t('rules.domain_label')} required data={domains.options} {...setForm.getInputProps('domain_id')} />
          <Group grow><TextInput label={t('common.code')} required description="a-z 0-9 _ -" {...setForm.getInputProps('code')} /><TextInput label={t('common.name')} required {...setForm.getInputProps('name')} /></Group>
          <Textarea label={t('common.description')} autosize minRows={2} {...setForm.getInputProps('description')} />
          <Switch label={t('rules.legal_profile')} description={t('rules.legal_profile_note')} {...setForm.getInputProps('is_legal_profile', { type: 'checkbox' })} />
          <Switch label={t('rules.full_coverage')} description={t('rules.full_coverage_note')} {...setForm.getInputProps('requires_full_coverage', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setNewSet(false)}>{t('common.cancel')}</Button><Button type="submit" loading={createSet.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={!!versionFor} onClose={() => setVersionFor(null)} title={`${t('rules.new_version')} — ${versionFor?.name ?? ''}`} centered>
        <form onSubmit={verForm.onSubmit((v) => createVer.mutate(v))}><Stack gap="sm">
          <Text size="sm" c="dimmed">{t('rules.version_help')}</Text>
          <Group grow align="flex-end">
            <Select label={t('rules.amount_cond')} data={[{ value: 'gte', label: '≥' }, { value: 'gt', label: '>' }, { value: 'lte', label: '≤' }, { value: 'lt', label: '<' }]} {...verForm.getInputProps('operator')} />
            <NumberInput label={t('rules.amount')} thousandSeparator min={0} {...verForm.getInputProps('amount')} />
          </Group>
          <Select label={t('rules.use_flow')} required data={(flows.data ?? []).filter((f) => f.is_active).map((f) => ({ value: f.id, label: `${f.name} (v${f.version})` }))} {...verForm.getInputProps('flow_id')} />
          <Group grow><TextInput type="date" label={t('rules.effective_from')} required {...verForm.getInputProps('effective_from')} /><NumberInput label={t('rules.priority')} min={0} {...verForm.getInputProps('priority')} /></Group>
          <Textarea label={t('rules.rationale')} autosize minRows={2} {...verForm.getInputProps('rationale')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setVersionFor(null)}>{t('common.cancel')}</Button><Button type="submit" loading={createVer.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={!!impact} onClose={() => setImpact(null)} title={t('rules.impact_title')} centered size="lg">
        {impact && <Stack gap="sm">
          <NumberInput label={t('rules.sample_amount')} thousandSeparator value={sample} onChange={setSample} rightSection={<Button size="compact-xs" onClick={() => runImpact.mutate(impact.ver)}>↻</Button>} rightSectionWidth={36} />
          {impact.result.samples.map((s, i) => (
            <Alert key={i} color={s.changes ? 'orange' : 'gray'} variant="light">
              {t('rules.sample_line', { amount: s.sample.amount, current: s.current?.rule_set ?? t('rules.default_flow'), proposed: s.proposed?.rule_set ?? t('rules.default_flow') })}
            </Alert>))}
          {impact.result.validation.errors.map((e) => <Alert key={e} color="red" variant="light">{t(`rules.err.${e}`, { defaultValue: e })}</Alert>)}
          {impact.result.validation.warnings.map((e) => <Alert key={e} color="yellow" variant="light">{t(`rules.err.${e}`, { defaultValue: e })}</Alert>)}
        </Stack>}
      </Modal>
    </>
  );
}
