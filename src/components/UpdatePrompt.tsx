import { Affix, Button, Group, Paper, Text } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';

/** The user decides when to switch to a new version (no surprise reload in the middle of a form). */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { if (reg) window.setInterval(() => { void reg.update(); }, 60 * 60 * 1000); },
  });
  if (!needRefresh) return null;
  return (
    <Affix position={{ bottom: 16, left: 16, right: 16 }} className="no-print" zIndex={400}>
      <Paper shadow="lg" withBorder p="sm" maw={420} mx="auto" role="status">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="xs" wrap="nowrap"><IconRefresh size={18} /><Text size="sm">{t('pwa.update_available')}</Text></Group>
          <Group gap={6} wrap="nowrap">
            <Button size="xs" variant="subtle" color="gray" onClick={() => setNeedRefresh(false)}>{t('pwa.later')}</Button>
            <Button size="xs" onClick={() => void updateServiceWorker(true)}>{t('pwa.update_now')}</Button>
          </Group>
        </Group>
      </Paper>
    </Affix>
  );
}
