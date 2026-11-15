import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { HistoryTimeline, type HistoryRow } from '@/components/EmploymentDrawer';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { PageHeader } from '@/components/PageHeader';
import { REVIEW_COLOR, ReviewModal } from '@/components/ReviewModal';

interface Mine {
  employee: { id: string; employee_number: string; full_name: string; position_title: string | null; category: string; department: string | null; hired_on: string | null; probation_end_on: string | null; contract_end_on: string | null };
  history: HistoryRow[]; reviews: { id: string; cycle: string | null; status: string; rating: string | null; submitted_at: string | null }[];
}

/** The signed-in employee's own record: no salary, no other people. */
export function MyEmploymentPage() {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['hr-mine'], queryFn: async () => (await api.get<{ data: Mine }>('/my/employment')).data.data, retry: false });
  if (q.isError) return <><PageHeader title={t('hr.my_title')} /><Text c="dimmed">{t('hr.no_employee_record')}</Text></>;
  const d = q.data;
  if (!d) return null;
  const e = d.employee;
  return (
    <>
      <PageHeader title={t('hr.my_title')} description={t('hr.my_intro')} />
      <Stack gap="lg">
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs"><Title order={4}>{e.full_name}</Title><Badge variant="outline">{e.employee_number}</Badge></Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Text size="sm"><b>{t('hr.position')}:</b> {e.position_title ?? '—'}</Text><Text size="sm"><b>{t('employees.category')}:</b> {e.category}</Text>
            <Text size="sm"><b>{t('employees.department')}:</b> {e.department ?? '—'}</Text><Text size="sm"><b>{t('employees.hired_on')}:</b> {e.hired_on ?? '—'}</Text>
            {e.probation_end_on && <Text size="sm"><b>{t('hr.probation_end')}:</b> {e.probation_end_on}</Text>}{e.contract_end_on && <Text size="sm"><b>{t('hr.contract_end')}:</b> {e.contract_end_on}</Text>}
          </SimpleGrid>
        </Card>
        <Card withBorder padding="md"><Title order={5} mb="sm">{t('rec.onboarding')}</Title><OnboardingChecklist employeeId={e.id} /></Card>
        <Card withBorder padding="md"><Title order={5} mb="sm">{t('hr.history')}</Title><HistoryTimeline rows={d.history} /></Card>
        <Card withBorder padding="md">
          <Title order={5} mb="sm">{t('hr.reviews_tab')}</Title>
          {d.reviews.length === 0 && <Text size="sm" c="dimmed">{t('hr.no_reviews')}</Text>}
          <Stack gap="xs">{d.reviews.map((r) => (
            <Group key={r.id} justify="space-between"><Group gap="xs"><Text size="sm" fw={600}>{r.cycle}</Text><Badge color={REVIEW_COLOR[r.status]} variant="light">{t(`hr.review_status.${r.status}`)}</Badge></Group>
              <Button size="compact-xs" variant="subtle" onClick={() => setOpenId(r.id)}>{t('approvals.details')}</Button></Group>
          ))}</Stack>
        </Card>
      </Stack>
      <ReviewModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
