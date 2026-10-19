import { Badge } from '@mantine/core';

/** Colour comes from the lookup table (state labels), never hard-coded per screen. */
export function StatusBadge({ label, color }: { label: string; color?: string | null }) {
  return <Badge color={color || 'gray'} variant="light" radius="sm">{label}</Badge>;
}
