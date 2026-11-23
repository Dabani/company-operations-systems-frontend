import { Alert, List, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';

interface Status { components: number; has_single_basic_component: boolean; schemes: number; schemes_without_verified_version: string[]; unverified_total: number; ready: boolean }

/** Go-live view of the payroll configuration: what is still unverified or missing. Nothing is ever pre-filled. */
export function PayStatusPanel() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['pay-status'], queryFn: async () => (await api.get<{ data: Status }>('/payroll/setup-status')).data.data });
  const d = q.data;
  const item = (ok: boolean, text: string) => <List.Item icon={<ThemeIcon size={20} radius="xl" color={ok ? 'green' : 'orange'} variant="light">{ok ? <IconCheck size={12} /> : <IconAlertTriangle size={12} />}</ThemeIcon>}>{text}</List.Item>;
  return d ? (
    <Alert color={d.ready ? 'green' : 'orange'} variant="light" title={d.ready ? t('pay.ready_title') : t('pay.not_ready_title')}>
      <List spacing={4} size="sm" center>
        {item(d.has_single_basic_component, t('pay.chk_basic'))}
        {item(d.components > 0, t('pay.chk_components', { count: d.components }))}
        {item(d.schemes > 0, t('pay.chk_schemes', { count: d.schemes }))}
        {item(d.schemes_without_verified_version.length === 0, t('pay.chk_versions', { codes: d.schemes_without_verified_version.join(', ') || '—' }))}
        {item(d.unverified_total === 0, t('pay.chk_unverified', { count: d.unverified_total }))}
      </List>
    </Alert>
  ) : null;
}
