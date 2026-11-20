import { Alert, Badge, Group, List, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';

interface Status { legal_rules: number; unverified_legal_rules: number; active_policy_versions: number; active_types: number; employees_without_profile: number; ready: boolean }
interface Violation { rule_set: string; rule_set_name: string; version: number; status: string; key: string; value: string; violation: string; statutory_value: string }

/** Go-live checklist and the statutory audit: is any leave policy below a verified legal floor? */
export function LeaveStatusPanel() {
  const { t } = useTranslation();
  const s = useQuery({ queryKey: ['leave-status'], queryFn: async () => (await api.get<{ data: Status }>('/leave/setup-status')).data.data });
  const v = useQuery({ queryKey: ['leave-violations'], queryFn: async () => (await api.get<{ data: Violation[] }>('/leave/policy/violations')).data.data });
  const d = s.data;
  const item = (ok: boolean, text: string) => <List.Item icon={<ThemeIcon size={20} radius="xl" color={ok ? 'green' : 'orange'} variant="light">{ok ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}</ThemeIcon>}>{text}</List.Item>;
  return (
    <Stack gap="md">
      {d && <Alert color={d.ready ? 'green' : 'orange'} variant="light" title={d.ready ? t('leave.ready_title') : t('leave.not_ready_title')}>
        <List spacing={4} size="sm" center>
          {item(d.legal_rules > 0 && d.unverified_legal_rules === 0, t('leave.chk_legal', { total: d.legal_rules, unverified: d.unverified_legal_rules }))}
          {item(d.active_policy_versions > 0, t('leave.chk_policy', { count: d.active_policy_versions }))}
          {item(d.employees_without_profile === 0, t('leave.chk_profiles', { count: d.employees_without_profile }))}
          {item(d.active_types > 0, t('leave.chk_types', { count: d.active_types }))}
        </List>
        <Text size="xs" c="dimmed" mt="xs">{t('leave.chk_policy_where')} <Link to="/rules">{t('leave.open_rules')}</Link></Text>
      </Alert>}
      <Text fw={600}>{t('leave.violations_title')}</Text>
      {v.data?.length === 0 && <Alert color="green" variant="light">{t('leave.violations_none')}</Alert>}
      {!!v.data?.length && (
        <Table verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>{t('leave.rule_set')}</Table.Th><Table.Th>{t('leave.policy_key')}</Table.Th><Table.Th>{t('leave.company_value')}</Table.Th><Table.Th>{t('leave.statutory_value')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>{v.data.map((x, i) => (
            <Table.Tr key={i}><Table.Td>{x.rule_set_name} <Text span size="xs" c="dimmed">v{x.version} · {x.status}</Text></Table.Td><Table.Td><code>{x.key}</code></Table.Td><Table.Td>{x.value}</Table.Td><Table.Td>{x.statutory_value}</Table.Td>
              <Table.Td><Badge color="red" variant="light">{t(`leave.violation.${x.violation}`)}</Badge></Table.Td></Table.Tr>))}</Table.Tbody>
        </Table>
      )}
      <Group />
    </Stack>
  );
}
