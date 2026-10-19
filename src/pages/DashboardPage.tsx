import { BarChart, DonutChart } from '@mantine/charts';
import { Badge, Card, Grid, Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconClockHour4, IconHourglass } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { iconFor } from '@/lib/icons';
import { fmtDateTime } from '@/lib/format';
import type { Widget } from '@/types';

function ComingSoon() {
  const { t } = useTranslation();
  return <Group c="dimmed" gap="xs"><IconHourglass size={18} /><Text size="sm">{t('widget.coming_soon')}</Text></Group>;
}

function WidgetBody({ w }: { w: Widget }) {
  const { t, i18n } = useTranslation();
  const { me } = useAuth();
  const Icon = iconFor(w.icon);

  if (w.type === 'welcome') {
    return (
      <Group wrap="nowrap">
        <ThemeIcon size={52} radius="xl" variant="gradient" gradient={{ from: 'brand.6', to: 'secondary.6' }}><Icon size={28} /></ThemeIcon>
        <Stack gap={2}>
          <Title order={3}>{t('dashboard.hello', { name: me?.name.split(' ')[0] })}</Title>
          <Text c="dimmed" size="sm">{t('dashboard.welcome_text')}</Text>
          <Group gap={6} mt={4}>{me?.roles.map((r) => <Badge key={r.id} variant="light">{r.name}</Badge>)}</Group>
        </Stack>
      </Group>
    );
  }
  if (w.data == null) return <ComingSoon />;

  switch (w.type) {
    case 'stat_card':
      return (
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={0}><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t(w.name_key)}</Text><Text fz={30} fw={800} lh={1.2}>{String(w.data)}</Text></Stack>
          <ThemeIcon size={46} radius="md" variant="light" color={w.color ?? 'brand'}><Icon size={26} /></ThemeIcon>
        </Group>
      );
    case 'donut_chart': {
      const d = (w.data as { name: string; value: number; color: string }[]).filter((x) => x.value > 0);
      return d.length ? <DonutChart data={d} withLabelsLine withLabels size={190} thickness={28} mx="auto" /> : <Text c="dimmed" size="sm">—</Text>;
    }
    case 'bar_chart':
      return <BarChart h={200} data={w.data as { date: string; events: number }[]} dataKey="date" series={[{ name: 'events', label: t('dashboard.events'), color: 'secondary.6' }]} tickLine="y" />;
    case 'list':
      return (
        <Stack gap="xs">
          {(w.data as { action: string; user: string | null; at: string }[]).map((r, i) => (
            <Group key={i} justify="space-between" wrap="nowrap" gap="xs">
              <Group gap="xs" wrap="nowrap"><IconClockHour4 size={16} color="gray" /><Text size="sm" truncate>{r.action}</Text></Group>
              <Text size="xs" c="dimmed" ta="right">{r.user ?? '—'} · {fmtDateTime(r.at, i18n.language)}</Text>
            </Group>
          ))}
        </Stack>
      );
    default: return <ComingSoon />;
  }
}

export function DashboardPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get<{ data: Widget[] }>('/dashboard')).data.data });

  return (
    <>
      <PageHeader title={t('menu.dashboard')} />
      {q.isLoading ? <Loader /> : (
        <Grid>
          {(q.data ?? []).map((w) => (
            <Grid.Col key={w.id} span={{ base: 12, sm: Math.min(12, w.width * 2 > 12 ? 12 : Math.max(6, w.width * 2)), md: w.width }}>
              <Card h="100%" padding="md">
                {!['welcome', 'stat_card'].includes(w.type) && <Text fw={700} size="sm" mb="sm">{t(w.name_key)}</Text>}
                <WidgetBody w={w} />
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      )}
    </>
  );
}
