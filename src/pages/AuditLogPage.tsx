import { Badge, Drawer, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { fmtDateTime } from '@/lib/format';

interface Row { id: string; created_at: string; action: string; entity_type: string | null; entity_id: string | null; user: string | null; outcome: string; ip_address: string | null; request_id: string | null; reason: string | null; changes?: { field: string; old: string | null; new: string | null }[] }

export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const [sel, setSel] = useState<string | null>(null);
  const detail = useQuery({ queryKey: ['audit', sel], enabled: !!sel, queryFn: async () => (await api.get<{ data: Row }>(`/audit-logs/${sel}`)).data.data });

  const columns: Column<Row>[] = [
    { key: 'created_at', label: t('audit.when'), sortable: true, render: (r) => fmtDateTime(r.created_at, i18n.language) },
    { key: 'action', label: t('audit.action'), sortable: true, render: (r) => <Text size="sm" ff="monospace">{r.action}</Text> },
    { key: 'entity_type', label: t('audit.entity'), visibleFrom: 'sm', render: (r) => r.entity_type ?? '—' },
    { key: 'user', label: t('audit.user'), render: (r) => r.user ?? '—' },
    { key: 'outcome', label: t('audit.outcome'), render: (r) => <Badge color={r.outcome === 'success' ? 'green' : 'red'} variant="light">{r.outcome}</Badge> },
    { key: 'ip_address', label: t('audit.ip'), visibleFrom: 'lg', render: (r) => r.ip_address ?? '—' },
  ];

  return (
    <>
      <PageHeader title={t('audit.title')} />
      <DataList<Row> title={t('audit.title')} endpoint="/audit-logs" queryKey="audit-logs" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }} onRowClick={(r) => setSel(r.id)} />
      <Drawer opened={!!sel} onClose={() => setSel(null)} position="right" size="md" title={detail.data?.action ?? t('audit.title')}>
        {detail.data && (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">{fmtDateTime(detail.data.created_at, i18n.language)} · {detail.data.user ?? '—'} · {detail.data.ip_address}</Text>
            {detail.data.reason && <Text size="sm">{detail.data.reason}</Text>}
            <Text fw={600} size="sm">{t('audit.changes')}</Text>
            <Table withTableBorder>
              <Table.Thead><Table.Tr><Table.Th>{t('audit.field')}</Table.Th><Table.Th>{t('audit.old')}</Table.Th><Table.Th>{t('audit.new')}</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{(detail.data.changes ?? []).map((c, i) => <Table.Tr key={i}><Table.Td>{c.field}</Table.Td><Table.Td>{c.old ?? '—'}</Table.Td><Table.Td>{c.new ?? '—'}</Table.Td></Table.Tr>)}</Table.Tbody>
            </Table>
            <Text size="xs" c="dimmed">request: {detail.data.request_id}</Text>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
