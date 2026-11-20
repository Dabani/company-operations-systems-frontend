import { Alert, Badge, Button, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { toastError } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface Detail { value: string | null; company: string | null; floor: string | null; ceiling: string | null; source: string; adjusted: boolean }
interface Preview { date: string; leave_type: string; values: Record<string, string | number | boolean | null>; detail: Record<string, Detail>; missing_profile: string[]; annual_entitlement: string }

/** The HR/legal worked-example tool: for one employee, one leave type and one date, what the company policy says, what the law bounds, and what really applies. */
export function LeavePolicyPanel() {
  const { t } = useTranslation();
  const types = useLookup('leave_type');
  const [emp, setEmp] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const keys = useQuery({ queryKey: ['leave-policy-keys'], queryFn: async () => (await api.get<{ data: { key: string; type: string; unit: string }[] }>('/leave/policy/keys')).data.data });
  const run = useMutation({ mutationFn: async () => (await api.get<{ data: Preview }>('/leave/policy/preview', { params: { employee_id: emp, leave_type_id: type, date } })).data.data, onError: toastError });
  const p = run.data;
  return (
    <Stack gap="md">
      <Alert variant="light" color="blue">{t('leave.policy_where')} <Link to="/rules">{t('leave.open_rules')}</Link></Alert>
      <Group align="flex-end" gap="sm">
        <Select label={t('leave.employee')} searchable w={260} value={emp} onChange={setEmp} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} />
        <Select label={t('leave.type')} w={220} value={type} onChange={setType} data={types.options} />
        <TextInput type="date" label={t('leave.date')} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        <Button disabled={!emp || !type || !date} loading={run.isPending} onClick={() => run.mutate()}>{t('leave.preview')}</Button>
      </Group>
      {p && (
        <>
          <Group gap="xs"><Badge size="lg" variant="light">{t('leave.annual_entitlement', { days: Number(p.annual_entitlement) })}</Badge></Group>
          {p.missing_profile.length > 0 && <Alert color="yellow" variant="light">{t('leave.profile_missing_admin', { facts: p.missing_profile.join(', ') })}</Alert>}
          <Table verticalSpacing="xs">
            <Table.Thead><Table.Tr><Table.Th>{t('leave.policy_key')}</Table.Th><Table.Th>{t('leave.company_value')}</Table.Th><Table.Th>{t('leave.statutory_floor')}</Table.Th><Table.Th>{t('leave.statutory_ceiling')}</Table.Th><Table.Th>{t('leave.effective')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {Object.entries(p.values).filter(([k, v]) => v !== null && v !== false || !!p.detail[k]?.company || !!p.detail[k]?.floor || !!p.detail[k]?.ceiling).map(([k, v]) => {
                const d = p.detail[k];
                return <Table.Tr key={k}><Table.Td><code>{k}</code></Table.Td><Table.Td>{d?.company ?? (typeof v === 'boolean' ? t('common.yes') : '—')}</Table.Td><Table.Td>{d?.floor ?? '—'}</Table.Td><Table.Td>{d?.ceiling ?? '—'}</Table.Td>
                  <Table.Td><Text span fw={600}>{String(v)}</Text> {d && <Badge size="xs" variant="light" color={d.source === 'statutory' ? 'red' : 'gray'}>{t(`leave.source_kind.${d.source}`)}</Badge>}</Table.Td></Table.Tr>;
              })}
            </Table.Tbody>
          </Table>
        </>
      )}
      <Text fw={600} size="sm">{t('leave.keys_title')}</Text>
      <Table verticalSpacing="xs"><Table.Tbody>{(keys.data ?? []).map((k) => <Table.Tr key={k.key}><Table.Td w={260}><code>{k.key}</code></Table.Td><Table.Td><Text size="sm" c="dimmed">{t(`leave.policykey.${k.key}`)}</Text></Table.Td></Table.Tr>)}</Table.Tbody></Table>
    </Stack>
  );
}
