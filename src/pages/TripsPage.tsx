import { Badge, Button, Select, Table, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { TripFormModal } from '@/components/trips/TripFormModal';
import { fmtMoney, TRIP_COLOR } from '@/lib/trips';

export interface TripRow { id: string; code: string; purpose: string; destination: string; zone: string; start_date: string; end_date: string; currency: string; budget_estimate: string; status: string; requested_by: string | null; authorization_number: string | null; travelers: { employee_id: string; name: string | null }[] }

export function TripsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const [modal, setModal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['trips', status], queryFn: async () => (await api.get<{ data: TripRow[] }>('/trips', { params: { status: status || undefined } })).data.data });
  return (
    <>
      <PageHeader title={t('trips.title')} description={t('trips.intro')} actions={can('hr.trip.request') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>{t('trips.new')}</Button> : undefined} />
      <Select mb="sm" w={260} clearable placeholder={t('common.status')} value={status} onChange={setStatus} data={['pending_approval', 'approved', 'report_submitted', 'settled', 'rejected', 'cancelled'].map((s) => ({ value: s, label: t(`trips.status.${s}`) }))} />
      <Table highlightOnHover verticalSpacing="sm" style={{ cursor: 'pointer' }}>
        <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('trips.destination')}</Table.Th><Table.Th>{t('trips.travelers')}</Table.Th><Table.Th>{t('trips.period')}</Table.Th><Table.Th ta="right">{t('trips.budget')}</Table.Th><Table.Th>{t('common.status')}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id} onClick={() => nav(`/trips/${r.id}`)}>
              <Table.Td><Badge variant="outline">{r.code}</Badge></Table.Td>
              <Table.Td><Text size="sm" fw={500}>{r.destination}</Text><Text size="xs" c="dimmed" lineClamp={1}>{r.purpose}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.travelers.map((x) => x.name).join(', ')}</Text></Table.Td>
              <Table.Td>{r.start_date} → {r.end_date}</Table.Td>
              <Table.Td ta="right">{fmtMoney(r.budget_estimate, r.currency, i18n.language)}</Table.Td>
              <Table.Td><Badge color={TRIP_COLOR[r.status]} variant="light">{t(`trips.status.${r.status}`)}</Badge></Table.Td>
            </Table.Tr>
          ))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('trips.none')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <TripFormModal opened={modal} onClose={() => setModal(false)} />
    </>
  );
}
