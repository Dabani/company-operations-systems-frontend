import { Badge, Card, Group, SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { iconFor } from '@/lib/icons';

interface Entry { code: string; module: string; module_label: string; icon: string; snapshot: boolean; title: string; description: string }

/** Reports hub: only the reports the user's permissions allow, grouped by module. */
export function ReportsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['reports'], queryFn: async () => (await api.get<{ data: Entry[] }>('/reports')).data.data });

  const groups = (q.data ?? []).reduce<Record<string, Entry[]>>((acc, r) => { (acc[r.module_label] ??= []).push(r); return acc; }, {});

  return (
    <>
      <PageHeader title={t('reports.title')} description={t('reports.subtitle')} />
      {q.isLoading && <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={110} />)}</SimpleGrid>}
      {q.data && q.data.length === 0 && <Text c="dimmed">{t('reports.empty')}</Text>}
      <Stack gap="lg">
        {Object.entries(groups).map(([label, items]) => (
          <Stack key={label} gap="xs">
            <Title order={4} size="h5" c="dimmed">{label}</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {items.map((r) => {
                const Icon = iconFor(r.icon);
                return (
                  <Card key={r.code} component={Link} to={`/reports/${r.code}`} padding="md" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Group wrap="nowrap" align="flex-start">
                      <ThemeIcon size={44} radius="md" variant="light"><Icon size={24} /></ThemeIcon>
                      <Stack gap={2}>
                        <Group gap="xs"><Text fw={700}>{r.title}</Text>{r.snapshot && <Badge size="xs" variant="light" color="gray">{t('reports.snapshot')}</Badge>}</Group>
                        <Text size="sm" c="dimmed">{r.description}</Text>
                      </Stack>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </>
  );
}
