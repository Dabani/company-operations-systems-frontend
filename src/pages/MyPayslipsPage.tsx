import { Alert, Badge, Button, Table, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { PayslipView, type SlipDetail } from '@/components/payroll/PayslipView';
import { downloadBlob } from '@/lib/download';
import { fmt } from '@/lib/payroll';
import { toastError } from '@/lib/ui';

interface Row { id: string; run_code: string; kind: string; period_from: string; period_to: string; paid_on: string | null; currency: string; net: string; net_difference: string | null }

/** Employee self-service: only MY payslips, only once the run is paid. The server finds the employee from the signed-in user. */
export function MyPayslipsPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['my-payslips'], queryFn: async () => (await api.get<{ data: Row[] }>('/payroll/me/payslips')).data.data });
  return (
    <>
      <PageHeader title={t('pay.my_title')} description={t('pay.my_intro')} />
      <Table highlightOnHover verticalSpacing="sm" style={{ cursor: 'pointer' }}>
        <Table.Thead><Table.Tr><Table.Th>{t('leave.period')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('trips.paid_on')}</Table.Th><Table.Th ta="right">{t('pay.net')}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((r) => (
            <Table.Tr key={r.id} onClick={() => nav(`/payroll/me/${r.id}`)}>
              <Table.Td>{r.period_from} → {r.period_to}</Table.Td>
              <Table.Td>{r.kind === 'adjustment' ? <Badge variant="light" color="orange">{t('pay.runkind.adjustment')}</Badge> : t('pay.runkind.regular')}</Table.Td>
              <Table.Td>{r.paid_on}</Table.Td>
              <Table.Td ta="right">{fmt(r.kind === 'adjustment' && r.net_difference !== null ? r.net_difference : r.net, r.currency, i18n.language)}</Table.Td>
            </Table.Tr>))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed">{t('pay.my_none')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
    </>
  );
}

export function MyPayslipPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const q = useQuery({ queryKey: ['my-payslip', id], queryFn: async () => (await api.get<{ data: SlipDetail }>(`/payroll/me/payslips/${id}`)).data.data, retry: false });
  return (
    <>
      <PageHeader title={t('pay.payslip')} actions={<><Button variant="default" component={Link} to="/payroll/me">{t('common.back')}</Button>
        <Button leftSection={<IconDownload size={16} />} onClick={() => void downloadBlob(`/payroll/me/payslips/${id}/pdf`, 'payslip.pdf').catch(toastError)}>{t('pay.pdf')}</Button></>} />
      {q.isError && <Alert color="orange">{t('pay.my_not_found')}</Alert>}
      {q.data && <PayslipView slip={q.data} />}
    </>
  );
}
