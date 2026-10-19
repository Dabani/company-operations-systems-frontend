import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap" gap="sm">
      <Stack gap={2}>
        <Title order={2} size="h3">{title}</Title>
        {description && <Text c="dimmed" size="sm">{description}</Text>}
      </Stack>
      {actions && <Group gap="xs" className="no-print">{actions}</Group>}
    </Group>
  );
}
