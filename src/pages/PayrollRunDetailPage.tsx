import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, MultiSelect, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title, NumberInput } from '@mantine/core';
import { IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import type { PayComponent } from '@/components/payroll/PayComponentsPanel';
import { downloadBlob } from '@/lib/download';
import { fmt, isEditable, RUN_COLOR, RUN_STAGES, runActions, SLIP_COLOR, stageIndex, type RunAction } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';

interface Run {
  id: string; code: string; kind: string; period_from: string; period_to: string; currency: string; status: string; parent: { id: string; code: string } | null; md_required: boolean; proration_mode: number; prepared_by: string | null; note: string | null;
  totals: { gross: string; employee_contributions: string; deductions: string; net: string; employer_contributions: string; employer_cost: string; net_difference: string | null; calculated: number; blocked: number; excluded: number };
  returned_reason: string | null; cancel_reason: string | null;
  stages: Record<string, string | null>;
  inputs: { id: string; employee_id: string; employee: string | null; component: string; amount: string; note: string | null }[]; exclusions: { employee_id: string; reason: string }[];
}
interface Slip { id: string; employee_id: string; employee: string; number: string | null; status: string; gross: string; net: string; net_difference: string | null; blockers: number; warnings: number; excluded_reason: string | null }
interface Exp { id: string; kind: string; profile: string; file_name: string; rows: number; total_amount: string | null; checksum: string; generated_by: string | null; created_at: string }
interface Profile { id: string; code: string; name: string; kind: string; verification: string; is_active: boolean }

const STEP_PATH: Partial<Record<RunAction, string>> = { calculate: 'calculate', review: 'review', approve_finance: 'approve-finance', approve_md: 'approve-md', lock: 'lock' };

export function PayrollRunDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<RunAction | 'exclude' | 'input' | null>(null);
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [ref, setRef] = useState('');
  const [pick, setPick] = useState<string[]>([]);
  const [one, setOne] = useState<string | null>(null);
  const [comp, setComp] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [profile, setProfile] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['pay-run', id], queryFn: async () => (await api.get<{ data: Run }>(`/payroll/runs/${id}`)).data.data });
  const slips = useQuery({ queryKey: ['pay-run-slips', id], queryFn: async () => (await api.get<{ data: Slip[] }>(`/payroll/runs/${id}/payslips`)).data.data });
  const r = q.data;
  const frozen = !!r && ['locked', 'paid', 'declared'].includes(r.status);
  const exps = useQuery({ queryKey: ['pay-run-exports', id], enabled: frozen && (can('hr.payroll.export') || can('hr.payroll.export.configure')), queryFn: async () => (await api.get<{ data: Exp[] }>(`/payroll/runs/${id}/exports`)).data.data });
  const profiles = useQuery({ queryKey: ['pay-profiles'], enabled: frozen && can('hr.payroll.export'), queryFn: async () => (await api.get<{ data: Profile[] }>('/payroll/export-profiles')).data.data });
  const comps = useQuery({ queryKey: ['pay-components'], enabled: !!r && isEditable(r.status), queryFn: async () => (await api.get<{ data: PayComponent[] }>('/payroll/components')).data.data });
  const refresh = () => { for (const k of ['pay-run', 'pay-run-slips', 'pay-run-exports', 'pay-runs']) void qc.invalidateQueries({ queryKey: [k] }); };
  const close = () => { setDlg(null); setText(''); setDate(''); setRef(''); setPick([]); setOne(null); setComp(null); setAmount(''); };
  const post = useMutation({ mutationFn: async (a: { path: string; body?: unknown }) => (await api.post(`/payroll/runs/${id}/${a.path}`, a.body)).data, onSuccess: () => { toastOk(); close(); refresh(); }, onError: toastError });
  const adjust = useMutation({ mutationFn: async () => (await api.post<{ data: { id: string } }>(`/payroll/runs/${id}/adjustments`, { employee_ids: pick, note: text || undefined })).data.data, onSuccess: (a) => { toastOk(); close(); nav(`/payroll/runs/${a.id}`); }, onError: toastError });
  const delInput = useMutation({ mutationFn: async (i: string) => api.delete(`/payroll/runs/${id}/inputs/${i}`), onSuccess: refresh, onError: toastError });
  const include = useMutation({ mutationFn: async (e: string) => api.delete(`/payroll/runs/${id}/exclusions/${e}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const generate = useMutation({ mutationFn: async () => api.post(`/payroll/runs/${id}/exports`, { profile_id: profile }), onSuccess: () => { toastOk(t('pay.export_made')); refresh(); }, onError: toastError });

  if (!r) return <PageHeader title={t('pay.runs_title')} />;
  const actions = runActions({ status: r.status, kind: r.kind, md_required: r.md_required, finance_done: !!r.stages.finance_by }, can);
  const m = (v: string | null) => fmt(v, r.currency, i18n.language);
  const editable = isEditable(r.status) && can('hr.payroll.prepare');
  const run = (a: RunAction) => (STEP_PATH[a] ? post.mutate({ path: STEP_PATH[a]! }) : setDlg(a));
  const submit = () => {
    if (dlg === 'return') post.mutate({ path: 'return', body: { reason: text } });
    else if (dlg === 'cancel') post.mutate({ path: 'cancel', body: { reason: text } });
    else if (dlg === 'pay') post.mutate({ path: 'pay', body: { paid_on: date, reference: ref || undefined } });
    else if (dlg === 'declare') post.mutate({ path: 'declare', body: { declared_on: date, reference: ref || undefined } });
    else if (dlg === 'adjust') adjust.mutate();
    else if (dlg === 'exclude' && one) post.mutate({ path: 'exclusions', body: { employee_id: one, reason: text } });
    else if (dlg === 'input' && one && comp) post.mutate({ path: 'inputs', body: { employee_id: one, component_id: comp, amount, note: text || undefined } });
  };
  const empOptions = (slips.data ?? []).map((s) => ({ value: s.employee_id, label: s.employee }));
  const sl = r.stages;
  const stageRows: [string, string | null, string | null][] = [['calculated', sl.calculated_by, sl.calculated_at], ['reviewed', sl.reviewed_by, sl.reviewed_at], ['finance', sl.finance_by, sl.finance_at], ['md', sl.md_by, sl.md_at], ['locked', sl.locked_by, sl.locked_at], ['paid', sl.paid_by, sl.paid_on], ['declared', sl.declared_by, sl.declared_on]];

  return (
    <>
      <PageHeader title={`${r.code} — ${r.period_from} → ${r.period_to}`} description={r.note ?? undefined}
        actions={<>{actions.filter((a) => a !== 'exports').map((a) => <Button key={a} variant={['cancel', 'return'].includes(a) ? 'default' : 'filled'} color={a === 'cancel' ? 'red' : undefined} loading={post.isPending && !!STEP_PATH[a]} onClick={() => run(a)}>{t(`pay.action.${a}`)}</Button>)}</>} />
      <Group gap={6} mb="md">{RUN_STAGES.map((s, i) => <Badge key={s} size="lg" variant={r.status === s ? 'filled' : stageIndex(r.status) > i ? 'light' : 'outline'} color={RUN_COLOR[s]}>{t(`pay.status.${s}`)}</Badge>)}{r.status === 'cancelled' && <Badge size="lg" color="red">{t('pay.status.cancelled')}</Badge>}</Group>
      {r.parent && <Alert color="blue" variant="light" mb="sm">{t('pay.adjustment_of')} <Link to={`/payroll/runs/${r.parent.id}`}>{r.parent.code}</Link></Alert>}
      {r.returned_reason && r.status === 'draft' && <Alert color="orange" variant="light" mb="sm">{t('pay.returned_reason')}: {r.returned_reason}</Alert>}
      {r.cancel_reason && <Alert color="gray" variant="light" mb="sm">{r.cancel_reason}</Alert>}
      {r.proration_mode === 0 && <Text size="xs" c="dimmed" mb="xs">{t('pay.proration_none')}</Text>}

      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('pay.gross')}</Text><Text fw={700}>{m(r.totals.gross)}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('pay.net')}</Text><Text fw={700}>{m(r.totals.net)}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('pay.employer_cost')}</Text><Text fw={700}>{m(r.totals.employer_cost)}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('pay.payslips')}</Text><Text fw={700}>{r.totals.calculated} <Text span size="xs" c={r.totals.blocked ? 'red' : 'dimmed'}>{t('pay.blocked_count', { count: r.totals.blocked })}</Text></Text></Card>
      </SimpleGrid>
      {r.totals.net_difference !== null && <Alert variant="light" color="blue" mb="sm">{t('pay.net_difference')}: <b>{m(r.totals.net_difference)}</b></Alert>}

      <Title order={5} mb="xs">{t('pay.stage_log')}</Title>
      <Table verticalSpacing={2} fz="sm" mb="lg"><Table.Tbody>{stageRows.filter(([k]) => k !== 'md' || r.md_required).map(([k, who, when]) => <Table.Tr key={k}><Table.Td w={200}>{t(`pay.stagelog.${k}`)}</Table.Td><Table.Td>{who ?? <Text span c="dimmed">—</Text>}</Table.Td><Table.Td c="dimmed">{when ? when.slice(0, 16).replace('T', ' ') : ''}</Table.Td></Table.Tr>)}</Table.Tbody></Table>

      <Group justify="space-between" mb="xs"><Title order={5}>{t('pay.payslips')}</Title>
        {editable && <Group gap="xs"><Button size="compact-xs" variant="light" onClick={() => setDlg('exclude')}>{t('pay.exclude')}</Button><Button size="compact-xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setDlg('input')}>{t('pay.add_input')}</Button></Group>}</Group>
      <Table.ScrollContainer minWidth={640}><Table highlightOnHover verticalSpacing="xs" mb="lg">
        <Table.Thead><Table.Tr><Table.Th>{t('leave.employee')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th ta="right">{t('pay.gross')}</Table.Th><Table.Th ta="right">{t('pay.net')}</Table.Th><Table.Th>{t('pay.flags')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(slips.data ?? []).map((s) => (
            <Table.Tr key={s.id}>
              <Table.Td><Link to={`/payroll/payslips/${s.id}`}>{s.employee}</Link><Text size="xs" c="dimmed">{s.number}</Text></Table.Td>
              <Table.Td><Badge color={SLIP_COLOR[s.status]} variant="light">{t(`pay.slip.${s.status}`)}</Badge>{s.excluded_reason && <Text size="xs" c="dimmed">{s.excluded_reason}</Text>}</Table.Td>
              <Table.Td ta="right">{m(s.gross)}</Table.Td><Table.Td ta="right">{m(s.net)}{s.net_difference !== null && <Text size="xs" c="blue">Δ {m(s.net_difference)}</Text>}</Table.Td>
              <Table.Td>{s.blockers > 0 && <Badge color="red" variant="filled" mr={4}>{s.blockers}</Badge>}{s.warnings > 0 && <Badge color="orange" variant="light">{s.warnings}</Badge>}</Table.Td>
              <Table.Td ta="right">{editable && s.status === 'excluded' && <Button size="compact-xs" variant="subtle" onClick={() => include.mutate(s.employee_id)}>{t('pay.include')}</Button>}</Table.Td>
            </Table.Tr>))}
          {slips.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('pay.no_payslips')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody></Table></Table.ScrollContainer>

      {r.inputs.length > 0 && <>
        <Title order={5} mb="xs">{t('pay.inputs')}</Title>
        <Table verticalSpacing={4} fz="sm" mb="lg"><Table.Tbody>{r.inputs.map((i) => <Table.Tr key={i.id}><Table.Td>{i.employee}</Table.Td><Table.Td><code>{i.component}</code></Table.Td><Table.Td ta="right">{m(i.amount)}</Table.Td><Table.Td c="dimmed">{i.note}</Table.Td>
          <Table.Td ta="right">{editable && <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => delInput.mutate(i.id)}><IconTrash size={14} /></ActionIcon>}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
      </>}

      {frozen && (can('hr.payroll.export') || can('hr.payroll.export.configure')) && <>
        <Title order={5} mb="xs">{t('pay.exports_title')}</Title>
        {can('hr.payroll.export') && <Group mb="sm" align="flex-end"><Select w={320} label={t('pay.layout')} value={profile} onChange={setProfile} data={(profiles.data ?? []).filter((p) => p.verification === 'verified' && p.is_active).map((p) => ({ value: p.id, label: `${p.name} (${t(`pay.exportkind.${p.kind}`)})` }))} />
          <Button disabled={!profile} loading={generate.isPending} onClick={() => generate.mutate()}>{t('pay.generate')}</Button><Button variant="subtle" component={Link} to="/payroll/exports">{t('pay.manage_layouts')}</Button></Group>}
        <Table verticalSpacing={4} fz="sm" mb="lg"><Table.Tbody>{(exps.data ?? []).map((e) => <Table.Tr key={e.id}><Table.Td><Badge variant="light">{t(`pay.exportkind.${e.kind}`)}</Badge></Table.Td><Table.Td>{e.file_name}<Text size="xs" c="dimmed">sha256 {e.checksum.slice(0, 12)}… · {e.rows} {t('pay.rows')}{e.total_amount ? ` · ${m(e.total_amount)}` : ''}</Text></Table.Td><Table.Td c="dimmed">{e.generated_by} · {e.created_at.slice(0, 16).replace('T', ' ')}</Table.Td>
          <Table.Td ta="right">{can('hr.payroll.export') && <ActionIcon variant="subtle" aria-label={t('files.download')} onClick={() => void downloadBlob(`/payroll/exports/${e.id}/download`, e.file_name).catch(toastError)}><IconDownload size={16} /></ActionIcon>}</Table.Td></Table.Tr>)}
          {exps.data?.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{t('pay.no_exports')}</Text></Table.Td></Table.Tr>}</Table.Tbody></Table>
      </>}

      <Modal opened={dlg !== null} onClose={close} title={dlg ? t(`pay.action.${dlg}`) : ''} centered>
        <Stack gap="sm">
          {(dlg === 'return' || dlg === 'cancel') && <Textarea label={t('pay.reason')} required autosize minRows={2} value={text} onChange={(e) => setText(e.currentTarget.value)} />}
          {(dlg === 'pay' || dlg === 'declare') && <><TextInput type="date" label={dlg === 'pay' ? t('trips.paid_on') : t('pay.declared_on')} required max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.currentTarget.value)} /><TextInput label={t('pay.reference')} maxLength={100} value={ref} onChange={(e) => setRef(e.currentTarget.value)} /></>}
          {dlg === 'adjust' && <><Alert color="blue" variant="light">{t('pay.adjust_hint')}</Alert><MultiSelect label={t('pay.adjust_employees')} required searchable data={(slips.data ?? []).filter((s) => s.status === 'calculated').map((s) => ({ value: s.employee_id, label: s.employee }))} value={pick} onChange={setPick} /><Textarea label={t('pay.note')} autosize minRows={2} value={text} onChange={(e) => setText(e.currentTarget.value)} /></>}
          {dlg === 'exclude' && <><Select label={t('leave.employee')} required searchable data={empOptions} value={one} onChange={setOne} /><Textarea label={t('pay.reason')} required autosize minRows={2} value={text} onChange={(e) => setText(e.currentTarget.value)} /></>}
          {dlg === 'input' && <><Select label={t('leave.employee')} required searchable data={empOptions} value={one} onChange={setOne} /><Select label={t('pay.component')} description={t('pay.variable_only')} required data={(comps.data ?? []).filter((c) => c.source === 'variable' && c.is_active).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} value={comp} onChange={setComp} />
            <NumberInput label={t('trips.amount')} required min={0} decimalScale={2} thousandSeparator=" " value={amount} onChange={setAmount} /><TextInput label={t('pay.note')} maxLength={255} value={text} onChange={(e) => setText(e.currentTarget.value)} /></>}
          <Group justify="flex-end"><Button variant="default" onClick={close}>{t('common.cancel')}</Button><Button loading={post.isPending || adjust.isPending} onClick={submit}
            disabled={((dlg === 'return' || dlg === 'cancel' || dlg === 'exclude') && !text.trim()) || ((dlg === 'pay' || dlg === 'declare') && !date) || (dlg === 'adjust' && pick.length === 0) || (dlg === 'exclude' && !one) || (dlg === 'input' && (!one || !comp || amount === ''))}>{t('common.save')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
