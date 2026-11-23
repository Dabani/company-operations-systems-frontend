import { api } from '@/api/client';

/** Download a file the API streams (a payslip PDF, a generated export) through the authenticated client, then hand it to the browser. */
export async function downloadBlob(url: string, fallbackName: string, params?: Record<string, string>): Promise<void> {
  const r = await api.get<Blob>(url, { responseType: 'blob', params });
  const cd = (r.headers['content-disposition'] as string | undefined) ?? '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
