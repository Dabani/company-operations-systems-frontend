/** Helpers for fields edited with RichTextField (stored as HTML). Older records may still hold plain text. */

const TAG = /<\/?[a-z][^>]*>/i;

/** True when the stored value contains HTML markup (otherwise it is an older plain-text value). */
export const isHtml = (s?: string | null): boolean => !!s && TAG.test(s);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text of a rich value: for validation (length) and for one-line table cells. */
export function plainText(s?: string | null): string {
  if (!s) return '';
  if (!isHtml(s)) return s.trim();
  return s.replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, ' ').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/** Turns an older plain-text value into HTML paragraphs so the editor (and the viewer) keep its line breaks. */
export function toEditorHtml(s?: string | null): string {
  if (!s) return '';
  if (isHtml(s)) return s;
  return s.split(/\r?\n{2,}/).map((p) => `<p>${esc(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
}
