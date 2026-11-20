import { Select, Switch, Table, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Row { id: string; leave_type: string; day_basis: string; uses_balance: boolean; accrues: boolean; is_paid: boolean; requires_document: boolean; allow_retroactive: boolean; ignores_blackout: boolean; allow_half_days: boolean; is_requestable: boolean; is_active: boolean }
const FLAGS = ['uses_balance', 'accrues', 'is_paid', 'requires_document', 'allow_retroactive', 'ignores_blackout', 'allow_half_days', 'is_requestable', 'is_active'] as const;

/** Per leave type: how days are counted, whether it has a balance, whether a document or a blackout applies. The defaults are conservative guesses: HR confirms each one. */
export function LeaveTypesPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const types = useLookup('leave_type');
  const basis = useLookup('leave_day_basis');
  const q = useQuery({ queryKey: ['leave-types'], queryFn: async () => (await api.get<{ data: Row[] }>('/leave/types')).data.data });
  const save = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api.patch(`/leave/types/${id}`, patch),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['leave-types'] }); void qc.invalidateQueries({ queryKey: ['leave-status'] }); }, onError: toastError,
  });
  return (
    <>
      <Text size="sm" c="dimmed" mb="sm">{t('leave.types_hint')}</Text>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>{t('leave.type')}</Table.Th><Table.Th>{t('leave.day_basis')}</Table.Th>{FLAGS.map((f) => <Table.Th key={f} ta="center">{t(`leave.flag.${f}`)}</Table.Th>)}</Table.Tr></Table.Thead>
          <Table.Tbody>{(q.data ?? []).map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td fw={500}>{types.items.find((l) => l.code === r.leave_type)?.label ?? r.leave_type}</Table.Td>
              <Table.Td><Select size="xs" w={150} allowDeselect={false} value={basis.items.find((b) => b.code === r.day_basis)?.id ?? null} data={basis.options} onChange={(v) => v && save.mutate({ id: r.id, patch: { day_basis_id: v } })} /></Table.Td>
              {FLAGS.map((f) => <Table.Td key={f} ta="center"><Switch checked={r[f]} aria-label={`${r.leave_type} ${t(`leave.flag.${f}`)}`} onChange={(e) => save.mutate({ id: r.id, patch: { [f]: e.currentTarget.checked } })} /></Table.Td>)}
            </Table.Tr>))}</Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </>
  );
}
