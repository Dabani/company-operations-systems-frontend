import { Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconWifiOff } from '@tabler/icons-react';
import { useNetwork } from '@mantine/hooks';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Offline banner plus a toast when the connection returns. Screens already loaded stay readable; writes are refused, never queued. */
export function OfflineBanner() {
  const { online } = useNetwork();
  const { t } = useTranslation();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (wasOffline.current) {
      wasOffline.current = false;
      notifications.show({ id: 'ops-back-online', color: 'green', message: t('pwa.back_online'), autoClose: 3000 });
    }
  }, [online, t]);

  if (online) return null;
  return <Alert color="orange" icon={<IconWifiOff size={18} />} mb="md" className="no-print" role="status">{t('pwa.offline')}</Alert>;
}
