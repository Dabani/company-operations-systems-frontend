import DOMPurify from 'dompurify';
import { Box } from '@mantine/core';
import { useMemo } from 'react';

// Open links safely in a new tab.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
});

/**
 * Renders rich text. The server already purifies on write (SanitizeRichText); this is a second,
 * client-side layer so a stored value can never execute script.
 */
export function SafeHtml({ html }: { html?: string | null }) {
  const clean = useMemo(() => DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } }), [html]);
  if (!clean) return null;
  return <Box className="rich-content" fz="sm" dangerouslySetInnerHTML={{ __html: clean }} />;
}
