import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from 'axios';
import { useEffect, useRef } from 'react';

(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

/** True when the Reverb websocket server is configured (VITE_REVERB_APP_KEY). Otherwise the UI polls. */
export const realtimeEnabled = !!import.meta.env.VITE_REVERB_APP_KEY;

let echo: Echo<'reverb'> | null = null;

export function getEcho(): Echo<'reverb'> | null {
  if (!realtimeEnabled) return null;
  if (echo) return echo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT || 443),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    // Private channels authorise through the Sanctum cookie session (same origin via the dev proxy).
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: Error | null, data?: unknown) => void) => {
        axios.post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name }, { withCredentials: true, withXSRFToken: true })
          .then((r) => callback(null, r.data))
          .catch((e) => callback(e as Error));
      },
    }),
  };
  echo = new Echo(options);
  return echo;
}

export function disconnectEcho() {
  echo?.disconnect();
  echo = null;
}

/** Listen to an event on a private channel for the lifetime of the component. */
export function useEchoEvent<T = unknown>(channel: string | null, event: string, handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const e = getEcho();
    if (!e || !channel) return;
    e.private(channel).listen(event, (data: T) => ref.current(data));
    return () => { e.leave(channel); };
  }, [channel, event]);
}
