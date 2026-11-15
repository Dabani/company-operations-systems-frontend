import { Badge, Checkbox, Group, Progress, Stack, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { toastError } from '@/lib/ui';

interface Item { id: string; title: string; due_on: string | null; done: boolean; done_at: string | null }

/** A new employee's onboarding checklist (generated when the applicant is converted). Hidden when there is nothing to show. */
export function OnboardingChecklist({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['hr-onboarding', employeeId], retry: false, queryFn: async () => (await api.get<{ data: Item[] }>(`/employees/${employeeId}/onboarding`)).data.data });
  const done = useMutation({ mutationFn: async (id: string) => api.post(`/onboarding-items/${id}/complete`), onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-onboarding', employeeId] }), onError: toastError });
  const items = q.data ?? [];
  if (!items.length) return <Text size="sm" c="dimmed">{t('rec.no_onboarding')}</Text>;
  const finished = items.filter((i) => i.done).length;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Stack gap="xs">
      <Group justify="space-between"><Text size="sm" fw={600}>{t('rec.onboarding_progress', { done: finished, total: items.length })}</Text></Group>
      <Progress value={(finished / items.length) * 100} size="sm" />
      {items.map((i) => (
        <Group key={i.id} justify="space-between" wrap="nowrap">
          <Checkbox checked={i.done} disabled={i.done || done.isPending} label={i.title} onChange={() => done.mutate(i.id)} styles={{ label: { textDecoration: i.done ? 'line-through' : undefined } }} />
          <Group gap={6} wrap="nowrap">
            {!i.done && i.due_on && i.due_on < today && <Badge color="red" size="xs" variant="light">{t('rec.overdue')}</Badge>}
            <Text size="xs" c="dimmed">{i.due_on ?? ''}</Text>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}
