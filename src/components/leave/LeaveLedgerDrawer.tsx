import { Badge, Drawer, Loader, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { formatDays, LEDGER_COLOR } from '@/lib/leave';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; leave_type: string; kind: string; entry_date: string; days: string; leave_year: number; reason: string | null }

/** Every line that makes up a balance, newest first. Rows are never edited: a correction is a new line. */
export function LeaveLedgerDrawer({ employeeId, name, onClose }: { employeeId: string | null; name?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const types = useLookup('leave_type');
  const kinds = useLookup('leave_ledger_kind');
  const q = useQuery({ queryKey: ['leave-ledger', employeeId], enabled: !!employeeId, queryFn: async () => (await api.get<{ data: Row[] }>(`/leave/balances/${employeeId}/ledger`)).data.data });
  return (
    <Drawer opened={!!employeeId} onClose={onClose} position="right" size="lg" title={`${t('leave.ledger_title')}${name ? ` — ${name}` : ''}`}>
      {q.isLoading && <Loader size="sm" />}
      {q.data?.length === 0 && <Text size="sm" c="dimmed">{t('leave.ledger_empty')}</Text>}
      {!!q.data?.length && (
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>{t('leave.date')}</Table.Th><Table.Th>{t('leave.type')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th ta="right">{t('leave.days')}</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {q.data.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.entry_date}</Table.Td>
                <Table.Td>{types.items.find((l) => l.code === r.leave_type)?.label ?? r.leave_type}</Table.Td>
                <Table.Td><Badge variant="light" color={LEDGER_COLOR[r.kind] ?? 'gray'}>{kinds.items.find((l) => l.code === r.kind)?.label ?? r.kind}</Badge>{r.reason && <Text size="xs" c="dimmed" lineClamp={1}>{r.reason}</Text>}</Table.Td>
                <Table.Td ta="right" c={Number(r.days) < 0 ? 'red' : 'green'}>{Number(r.days) > 0 ? '+' : ''}{formatDays(r.days)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Drawer>
  );
}
