import { Button, Group } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { PayslipView, type SlipDetail } from '@/components/payroll/PayslipView';
import { downloadBlob } from '@/lib/download';
import { toastError } from '@/lib/ui';

/** A stored payslip as HR sees it (with the review flags and the technical details). Viewing and downloading are audited by the server. */
export function PayslipPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const q = useQuery({ queryKey: ['pay-slip', id], queryFn: async () => (await api.get<{ data: SlipDetail & { run: { id: string } } }>(`/payroll/payslips/${id}`)).data.data });
  const s = q.data;
  return (
    <>
      <PageHeader title={t('pay.payslip')} actions={s ? <Group gap="xs"><Button variant="default" component={Link} to={`/payroll/runs/${s.run.id}`}>{s.run.code}</Button>
        <Button leftSection={<IconDownload size={16} />} onClick={() => void downloadBlob(`/payroll/payslips/${id}/pdf`, 'payslip.pdf', { locale: i18n.language }).catch(toastError)}>{t('pay.pdf')}</Button></Group> : undefined} />
      {s && <PayslipView slip={s} showTechnical />}
    </>
  );
}
