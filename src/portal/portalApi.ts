import axios from 'axios';
import i18n from '@/i18n';

/** Separate HTTP client for the external portal: its own session, and no staff "signed out" handling on a 401. */
export const papi = axios.create({
  baseURL: '/api/v1/portal',
  withCredentials: true,
  withXSRFToken: true,
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});
papi.interceptors.request.use((cfg) => { cfg.headers['Accept-Language'] = i18n.language || 'en'; return cfg; });
export const pcsrf = () => axios.get('/sanctum/csrf-cookie', { withCredentials: true });

export async function pdownload(path: string, filename: string) {
  const res = await papi.get(path, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export interface PortalStatus { email: string; client: { id: string; code: string; name: string }; mfa: { required: boolean; enabled: boolean; verified: boolean } }
export const ORG_KEY = 'cops.portal.org';
