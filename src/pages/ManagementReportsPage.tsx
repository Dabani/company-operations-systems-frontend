import { Badge, Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { SafeHtml } from '@/components/SafeHtml';
import { fmtDateTime } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';
import type { LV } from '@/types';

interface Rep { id: string; title: string; period_label: string | null; body: string; kind: LV; submitted_by: string | null; submitted_at: string; recipients_count: number }

/** What was formally reported to senior management, by whom and when. */
export function ManagementReportsPage() {
  const { t, i18n } = useTranslation();
  const [kind, setKind] = useState('all');
  const kinds = useLookup('report_kind');
  const q = useQuery({ queryKey: ['management-reports', kind], queryFn: async () => (await api.get<{ data: Rep[] }>('/management-reports', { params: { filter: kind === 'all' ? undefined : { kind_id: kind } } })).data.data });

  return (
    <>
      <PageHeader title={t('mgr.title')} />
      <Stack gap="md">
        <SegmentedControl w="fit-content" value={kind} onChange={setKind} data={[{ value: 'all', label: t('rec.filter_all') }, ...kinds.items.map((k) => ({ value: k.id, label: k.label }))]} />
        {(q.data ?? []).length === 0 && <Text c="dimmed" size="sm">{t('common.no_data')}</Text>}
        {(q.data ?? []).map((r) => (
          <Card key={r.id} padding="lg">
            <Group justify="space-between" wrap="wrap" mb="xs">
              <Group gap="xs"><Badge color={r.kind.color ?? 'gray'} variant="light">{r.kind.label}</Badge><Text fw={700}>{r.title}</Text></Group>
              <Text size="xs" c="dimmed">{t('mgr.submitted')}: {r.submitted_by} · {fmtDateTime(r.submitted_at, i18n.language)} · {t('mgr.recipients')}: {r.recipients_count}</Text>
            </Group>
            <SafeHtml html={r.body} />
          </Card>))}
      </Stack>
    </>
  );
}
