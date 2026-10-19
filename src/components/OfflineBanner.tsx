import { Alert } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useNetwork } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { online } = useNetwork();
  const { t } = useTranslation();
  if (online) return null;
  return <Alert color="orange" icon={<IconWifiOff size={18} />} mb="md" className="no-print">{t('pwa.offline')}</Alert>;
}
