export const KIND_COLOR: Record<string, string> = { speak: 'blue', question: 'cyan', point_of_order: 'red', reply: 'violet' };
export const POLL_MS = 5000;

export interface JoinData { domain: string; room: string; jwt: string | null; display_name: string; moderator: boolean; subject: string; signed: boolean }
export interface QueueItem { id: string; name: string; is_guest: boolean; kind: string; status: string; topic: string | null; agenda_item: string | null; requested_at: string; granted_at: string | null; finished_at: string | null; position: number | null; decision_note: string | null; mine: boolean }
export interface Queue { speaking: QueueItem | null; waiting: QueueItem[]; history?: QueueItem[] }

/** Where the Jitsi script lives. The domain comes from the server; only plain host names are accepted so a bad value cannot load a script from elsewhere. */
export function externalApiUrl(domain: string): string | null {
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i.test(domain) ? `https://${domain}/external_api.js` : null;
}

/** Options handed to JitsiMeetExternalAPI. The token (when the server signs one) decides who is moderator; the browser never grants itself rights. */
export function jitsiOptions(j: JoinData, parent: HTMLElement) {
  return {
    roomName: j.room, parentNode: parent, width: '100%', height: '100%', ...(j.jwt ? { jwt: j.jwt } : {}),
    userInfo: { displayName: j.display_name },
    configOverwrite: { subject: j.subject, prejoinPageEnabled: false, disableDeepLinking: true, startWithAudioMuted: true, startWithVideoMuted: false, enableWelcomePage: false, disableInviteFunctions: true },
    interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false, SHOW_BRAND_WATERMARK: false, MOBILE_APP_PROMO: false },
  };
}

/** Short text for the queue position of a person's own request. */
export function myPlace(q: Queue | null): { kind: 'speaking' | 'waiting'; position: number | null; item: QueueItem } | null {
  if (!q) return null;
  if (q.speaking?.mine) return { kind: 'speaking', position: null, item: q.speaking };
  const w = q.waiting.find((x) => x.mine);
  return w ? { kind: 'waiting', position: w.position, item: w } : null;
}
