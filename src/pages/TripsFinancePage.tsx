import { Alert, Badge, Table, Tabs, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { fmtMoney, TRIP_COLOR } from '@/lib/trips';
import type { TripRow } from '@/pages/TripsPage';

interface Late { advance_id: string; trip_id: string; trip: string; employee: string | null; amount: string; due_on: string; days_late: number }

/** Finance desk: advances past their date, reports waiting for review and settlement, approved trips (advances to pay). */
export function TripsFinancePage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const late = useQuery({ queryKey: ['trips-unretired'], queryFn: async () => (await api.get<{ data: Late[] }>('/trips/unretired-advances')).data.data });
  const review = useQuery({ queryKey: ['trips', 'report_submitted'], queryFn: async () => (await api.get<{ data: TripRow[] }>('/trips', { params: { status: 'report_submitted' } })).data.data });
  const approved = useQuery({ queryKey: ['trips', 'approved'], queryFn: async () => (await api.get<{ data: TripRow[] }>('/trips', { params: { status: 'approved' } })).data.data });
  const list = (rows: TripRow[] | undefined, empty: string) => (
    <Table highlightOnHover verticalSpacing="sm" style={{ cursor: 'pointer' }}><Table.Tbody>
      {(rows ?? []).map((r) => <Table.Tr key={r.id} onClick={() => nav(`/trips/${r.id}`)}><Table.Td><Badge variant="outline">{r.code}</Badge></Table.Td><Table.Td>{r.destination}</Table.Td><Table.Td>{r.travelers.map((x) => x.name).join(', ')}</Table.Td><Table.Td>{r.start_date} → {r.end_date}</Table.Td><Table.Td ta="right">{fmtMoney(r.budget_estimate, r.currency, i18n.language)}</Table.Td><Table.Td><Badge color={TRIP_COLOR[r.status]} variant="light">{t(`trips.status.${r.status}`)}</Badge></Table.Td></Table.Tr>)}
      {rows?.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{empty}</Text></Table.Td></Table.Tr>}
    </Table.Tbody></Table>
  );
  return (
    <>
      <PageHeader title={t('trips.finance_title')} description={t('trips.finance_intro')} />
      {!!late.data?.length && <Alert color="red" variant="light" mb="md" title={t('trips.late_title', { count: late.data.length })}>
        <Table verticalSpacing={4}><Table.Tbody>{late.data.map((a) => <Table.Tr key={a.advance_id}><Table.Td><Link to={`/trips/${a.trip_id}`}>{a.trip}</Link></Table.Td><Table.Td>{a.employee}</Table.Td><Table.Td>{a.amount}</Table.Td><Table.Td>{a.due_on}</Table.Td><Table.Td><Badge color="red">{t('trips.days_late', { count: a.days_late })}</Badge></Table.Td></Table.Tr>)}</Table.Tbody></Table>
      </Alert>}
      <Tabs defaultValue="review">
        <Tabs.List mb="md"><Tabs.Tab value="review">{t('trips.tab_review', { count: review.data?.length ?? 0 })}</Tabs.Tab><Tabs.Tab value="approved">{t('trips.tab_active', { count: approved.data?.length ?? 0 })}</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="review">{list(review.data, t('trips.none'))}</Tabs.Panel>
        <Tabs.Panel value="approved">{list(approved.data, t('trips.none'))}</Tabs.Panel>
      </Tabs>
    </>
  );
}
