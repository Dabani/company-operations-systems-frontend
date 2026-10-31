import { Group, Progress, Stack, Text } from '@mantine/core';
import { IconCheck, IconCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { PasswordCheck } from '@/lib/passwordRules';

/** Live rule list under a new-password field. Rules only turn green; nothing is hidden or hinted wrong. */
export function PasswordChecklist({ checks }: { checks: PasswordCheck[] }) {
  const { t } = useTranslation();
  const done = checks.filter((c) => c.ok).length;
  return (
    <Stack gap={6} aria-live="polite">
      <Progress value={(done / checks.length) * 100} size="xs" color={done === checks.length ? 'green' : done >= 4 ? 'yellow' : 'red'} />
      {checks.map((c) => (
        <Group key={c.key} gap={6} wrap="nowrap">
          {c.ok ? <IconCheck size={14} color="var(--mantine-color-green-6)" /> : <IconCircle size={14} color="var(--mantine-color-gray-5)" />}
          <Text size="xs" c={c.ok ? 'green.7' : 'dimmed'}>{t(`auth.pw_${c.key}`)}</Text>
        </Group>
      ))}
    </Stack>
  );
}
