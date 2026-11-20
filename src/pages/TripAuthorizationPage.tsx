import { Button, Divider, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';

interface Auth { number: string; authorized_at: string | null; purpose: string; destination: string; from: string; to: string; zone: string; project: string | null; linked_meeting: string | null; travelers: { employee_id: string; name: string | null; employee_number: string | null }[] }

/** The mission authorization, issued when the trip was approved. Printed from the browser (the page chrome is hidden in print). */
export function TripAuthorizationPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const q = useQuery({ queryKey: ['trip-auth', id], queryFn: async () => (await api.get<{ data: Auth }>(`/trips/${id}/authorization`)).data.data, retry: false });
  const a = q.data;
  return (
    <>
      <PageHeader title={t('trips.authorization')} actions={<Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()} disabled={!a}>{t('common.print')}</Button>} />
      {q.isError && <Text c="dimmed">{t('trips.authorization_none')}</Text>}
      {a && (
        <Paper withBorder p="xl" maw={760}>
          <Stack gap="md">
            <Title order={3}>{t('trips.authorization')} — {a.number}</Title>
            <Text size="sm" c="dimmed">{t('trips.authorized_on')} {a.authorized_at ? new Date(a.authorized_at).toLocaleDateString() : '—'}</Text>
            <Divider />
            <Table verticalSpacing={4} withRowBorders={false}><Table.Tbody>
              <Table.Tr><Table.Td w={170} fw={600}>{t('trips.destination')}</Table.Td><Table.Td>{a.destination}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td fw={600}>{t('trips.period')}</Table.Td><Table.Td>{a.from} → {a.to}</Table.Td></Table.Tr>
              <Table.Tr><Table.Td fw={600}>{t('trips.purpose')}</Table.Td><Table.Td>{a.purpose}</Table.Td></Table.Tr>
              {a.project && <Table.Tr><Table.Td fw={600}>{t('trips.project')}</Table.Td><Table.Td>{a.project}</Table.Td></Table.Tr>}
              {a.linked_meeting && <Table.Tr><Table.Td fw={600}>{t('trips.meeting')}</Table.Td><Table.Td>{a.linked_meeting}</Table.Td></Table.Tr>}
            </Table.Tbody></Table>
            <Text fw={600}>{t('trips.travelers')}</Text>
            <Table verticalSpacing={4}><Table.Tbody>{a.travelers.map((x) => <Table.Tr key={x.employee_id}><Table.Td>{x.name}</Table.Td><Table.Td c="dimmed">{x.employee_number}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
            <Text size="xs" c="dimmed">{t('trips.authorization_note')}</Text>
          </Stack>
        </Paper>
      )}
    </>
  );
}
