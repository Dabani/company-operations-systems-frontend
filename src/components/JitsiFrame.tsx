import { Alert, Loader, Center } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { externalApiUrl, jitsiOptions, type JoinData } from '@/lib/online';

interface JitsiApi { dispose: () => void; addListener: (e: string, f: () => void) => void }
declare global { interface Window { JitsiMeetExternalAPI?: new (domain: string, options: object) => JitsiApi } }

const loaded = new Map<string, Promise<void>>();
function loadScript(domain: string): Promise<void> {
  const url = externalApiUrl(domain);
  if (!url) return Promise.reject(new Error('bad domain'));
  let p = loaded.get(url);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url; s.async = true; s.onload = () => resolve(); s.onerror = () => { loaded.delete(url); reject(new Error('load failed')); };
      document.head.appendChild(s);
    });
    loaded.set(url, p);
  }
  return p;
}

/** The video call, embedded. Loads the Jitsi script from the configured server, joins the room with the signed token and reports when the person hangs up. */
export function JitsiFrame({ join, onLeave, height = 520 }: { join: JoinData; onLeave: () => void; height?: number }) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let api: JitsiApi | null = null;
    let cancelled = false;
    loadScript(join.domain).then(() => {
      if (cancelled || !host.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI(join.domain, jitsiOptions(join, host.current));
      api.addListener('readyToClose', onLeave);
      setState('ready');
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; api?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join.domain, join.room, join.jwt]);
  return (
    <div style={{ position: 'relative', height, background: 'var(--mantine-color-dark-8)', borderRadius: 8, overflow: 'hidden' }}>
      {state === 'loading' && <Center h="100%"><Loader /></Center>}
      {state === 'error' && <Alert color="red" variant="light" m="md">{t('onl.load_failed')}</Alert>}
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
