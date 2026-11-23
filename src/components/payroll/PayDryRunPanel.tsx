import { ActionIcon, Alert, Button, Card, Group, List, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import type { PayComponent } from '@/components/payroll/PayComponentsPanel';
import { fmt } from '@/lib/payroll';
import { toastError } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Item { code: string; message: string }
interface Line { kind: string; code: string; base: string | null; rate: string | null; amount: string; bands?: { lower: string; upper: string | null; rate: string; part: string; amount: string }[] }
interface Result { blockers: Item[]; warnings: Item[]; result: { lines: Line[]; totals: Record<string, string> } | null; meta: { currency: string | null; applied: { code: string; version_id: string }[]; excluded: { code: string; by: string }[] } }

/** Full calculation for one employee and one period from the VERIFIED configuration. Nothing is saved (only the fact that it was run is audited, never the amounts). */
export function PayDryRunPanel() {
  const { t, i18n } = useTranslation();
  const [emp, setEmp] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [lines, setLines] = useState<{ component_id: string; amount: number | string }[]>([]);
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const comps = useQuery({ queryKey: ['pay-components'], queryFn: async () => (await api.get<{ data: PayComponent[] }>('/payroll/components')).data.data });
  const run = useMutation({ mutationFn: async () => (await api.post<{ data: Result }>('/payroll/dry-run', { employee_id: emp, period_from: from, period_to: to, lines: lines.filter((l) => l.component_id && l.amount !== '').map((l) => ({ component_id: l.component_id, amount: l.amount })) })).data.data, onError: toastError });
  const r = run.data;
  const cur = r?.meta.currency ?? '';
  const m = (v: string | null) => fmt(v, cur || 'RWF', i18n.language);
  const variable = (comps.data ?? []).filter((c) => c.source === 'variable' && c.is_active);
  return (
    <Stack gap="md">
      <Alert color="blue" variant="light">{t('pay.dry_hint')}</Alert>
      <Group align="flex-end" gap="sm"><Select label={t('leave.employee')} searchable w={260} value={emp} onChange={setEmp} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} />
        <TextInput type="date" label={t('leave.from')} value={from} onChange={(e) => setFrom(e.currentTarget.value)} /><TextInput type="date" label={t('leave.to')} value={to} onChange={(e) => setTo(e.currentTarget.value)} /></Group>
      {variable.length > 0 && <Stack gap={4}><Text size="sm" fw={500}>{t('pay.extra_lines')}</Text>
        {lines.map((l, i) => <Group key={i} gap="xs" wrap="nowrap"><Select w={240} data={variable.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} value={l.component_id} onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, component_id: v ?? '' } : x)))} />
          <NumberInput w={160} min={0} decimalScale={2} thousandSeparator=" " value={l.amount} onChange={(n) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: n } : x)))} />
          <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => setLines(lines.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon></Group>)}
        <Group><Button size="compact-xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setLines([...lines, { component_id: '', amount: '' }])}>{t('common.add')}</Button></Group></Stack>}
      <Group><Button disabled={!emp || !from || !to || to < from} loading={run.isPending} onClick={() => run.mutate()}>{t('pay.run_dry')}</Button></Group>
      {r && (
        <Stack gap="sm">
          {r.blockers.length > 0 && <Alert color="red" variant="light" title={t('pay.blockers')}><List size="sm">{r.blockers.map((b, i) => <List.Item key={i}>{b.message}</List.Item>)}</List></Alert>}
          {r.warnings.length > 0 && <Alert color="orange" variant="light" title={t('pay.warnings')}><List size="sm">{r.warnings.map((b, i) => <List.Item key={i}>{b.message}</List.Item>)}</List></Alert>}
          {r.result && (
            <Card withBorder padding="sm">
              <Table verticalSpacing={4} fz="sm"><Table.Tbody>
                {r.result.lines.map((l, i) => <Table.Tr key={i}><Table.Td><Text size="sm"><code>{l.code}</code> <Text span size="xs" c="dimmed">{t(`pay.kind.${l.kind}`)}{l.base !== null ? ` · ${t('pay.base')} ${m(l.base)}${l.rate ? ` · ${Number(l.rate)}%` : ''}` : ''}</Text></Text>
                  {!!l.bands?.length && <Text size="xs" c="dimmed">{l.bands.map((b) => `${Number(b.lower)}–${b.upper === null ? '…' : Number(b.upper)} @ ${Number(b.rate)}% = ${Number(b.amount)}`).join(' | ')}</Text>}</Table.Td><Table.Td ta="right">{m(l.amount)}</Table.Td></Table.Tr>)}
                <Table.Tr><Table.Td fw={600}>{t('pay.gross')}</Table.Td><Table.Td ta="right" fw={600}>{m(r.result.totals.gross)}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td fw={700}>{t('pay.net')}</Table.Td><Table.Td ta="right" fw={700}>{m(r.result.totals.net)}</Table.Td></Table.Tr>
                <Table.Tr><Table.Td c="dimmed">{t('pay.employer_cost')}</Table.Td><Table.Td ta="right" c="dimmed">{m(r.result.totals.employer_cost)}</Table.Td></Table.Tr>
              </Table.Tbody></Table>
            </Card>)}
          {r.meta.excluded.length > 0 && <Text size="xs" c="dimmed">{t('pay.excluded_schemes', { codes: r.meta.excluded.map((x) => x.code).join(', ') })}</Text>}
        </Stack>)}
    </Stack>
  );
}
