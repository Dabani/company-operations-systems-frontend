import axios, { AxiosError } from 'axios';
import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

api.interceptors.request.use((cfg) => {
  cfg.headers['Accept-Language'] = i18n.language || 'en';
  return cfg;
});

export const UNAUTHENTICATED_EVENT = 'ops:unauthenticated';

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // No response at all while the browser reports offline: tell the user the action was NOT sent (writes are never queued).
    if (!err.response && typeof navigator !== 'undefined' && !navigator.onLine && err.config?.method !== 'get') {
      notifications.show({ id: 'ops-action-offline', color: 'orange', message: i18n.t('pwa.action_offline') });
    }
    if (err.response?.status === 401 && !err.config?.url?.includes('auth/')) {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
    }
    return Promise.reject(err);
  },
);

/** Sanctum SPA handshake: sets the XSRF-TOKEN cookie. Call before login/reset/forgot. */
export const csrf = () => axios.get('/sanctum/csrf-cookie', { withCredentials: true });

export interface ApiErrorInfo { message: string; fields: Record<string, string> }

export function parseError(e: unknown): ApiErrorInfo {
  const err = e as AxiosError<{ error?: { message?: string; details?: Record<string, string[]> } }>;
  const body = err.response?.data?.error;
  const fields: Record<string, string> = {};
  Object.entries(body?.details ?? {}).forEach(([k, v]) => { fields[k] = v[0]; });
  return { message: body?.message ?? i18n.t('common.error'), fields };
}

/** Download a list export (csv/xlsx) from an endpoint with the current query string. */
export async function downloadExport(url: string, params: Record<string, unknown>, format: 'csv' | 'xlsx') {
  const res = await api.get(url, { params: { ...params, export: format }, responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = `export-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Authenticated file download (errors become toasts instead of a raw JSON page). */
export async function downloadFile(id: string, name: string, version?: string) {
  const res = await api.get(`/files/${id}/download`, { params: { version }, responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Download any authenticated GET endpoint as a file (PDF forms, etc.). */
export async function downloadBlob(url: string, filename: string) {
  const res = await api.get(url, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
