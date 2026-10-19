export const stripHtml = (html?: string | null): string =>
  (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const fmtDateTime = (iso?: string | null, locale?: string) =>
  iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1; let v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
};
