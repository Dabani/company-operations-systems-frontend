import { Button } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** Shows an "Install app" button when the browser offers PWA installation. */
export function InstallPrompt() {
  const { t } = useTranslation();
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (!evt) return null;
  return (
    <Button size="compact-sm" variant="light" leftSection={<IconDownload size={16} />} visibleFrom="sm"
      onClick={async () => { await evt.prompt(); setEvt(null); }}>
      {t('pwa.install')}
    </Button>
  );
}
