import { BarChart, DonutChart, LineChart } from '@mantine/charts';
import { Accordion, Alert, Button, Card, Group, Loader, ScrollArea, SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconFileSpreadsheet, IconFileTypeCsv, IconPrinter } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, downloadBlob, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { fmtDateTime } from '@/lib/format';
import { formatKpi, presetRange, toneColor, type Kpi } from '@/lib/reportFormat';

interface Series { name: string; label: string; color: string }
interface Chart { key: string; type: 'line' | 'bar' | 'stacked_bar' | 'donut'; title: string; x?: string; series?: Series[]; data: Record<string, string | number>[] }
interface Report {
  meta: { code: string; title: string; description: string; from: string; to: string; snapshot: boolean; timezone: string; generated_at: string; method: { formula: string; inclusion: string; date_basis: string; sources: string } };
  kpis: Kpi[]; charts: Chart[]; table: { columns: { key: string; label: string }[]; rows: Record<string, string | number>[] };
}

function ChartCard({ c }: { c: Chart }) {
  const { t } = useTranslation();
  const empty = c.data.length === 0 || (c.type === 'donut' && c.data.every((d) => !d.value));
  return (
    <Card padding="md" style={{ breakInside: 'avoid' }}>
      <Text fw={700} size="sm" mb="sm">{c.title}</Text>
      {empty ? <Text c="dimmed" size="sm">{t('reports.no_chart')}</Text> : (
        c.type === 'donut'
          ? <DonutChart data={c.data.filter((d) => Number(d.value) > 0) as { name: string; value: number; color: string }[]} withLabelsLine withLabels size={190} thickness={28} mx="auto" />
          : c.type === 'line'
            ? <LineChart h={240} data={c.data} dataKey={c.x ?? 'label'} series={c.series ?? []} curveType="monotone" withLegend tickLine="y" />
            : <BarChart h={240} data={c.data} dataKey={c.x ?? 'label'} series={c.series ?? []} type={c.type === 'stacked_bar' ? 'stacked' : 'default'} withLegend={(c.series?.length ?? 0) > 1} tickLine="y" />
      )}
    </Card>
  );
}

export function ReportViewPage() {
  const { code = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const [preset, setPreset] = useState('90');
  const [custom, setCustom] = useState(presetRange(90));
  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(Number(preset))), [preset, custom]);

  const q = useQuery({
    queryKey: ['report', code, range.from, range.to, i18n.language],
    queryFn: async () => (await api.get<{ data: Report }>(`/reports/${code}`, { params: range })).data.data,
    staleTime: 60_000,
  });
  const r = q.data;

  const exportAs = async (format: 'csv' | 'xlsx') => {
    try { await downloadBlob(`/reports/${code}/export?format=${format}&from=${range.from}&to=${range.to}`, `report-${code}-${range.from}_${range.to}.${format}`); }
    catch (e) { notifications.show({ color: 'red', message: parseError(e).message || t('reports.export_failed') }); }
  };

  return (
    <>
      <PageHeader
        title={r?.meta.title ?? t('reports.title')}
        description={r?.meta.description}
        actions={<>
          <Button component={Link} to="/reports" variant="subtle" leftSection={<IconArrowLeft size={16} />}>{t('reports.all')}</Button>
          {can('report.export') && <>
            <Button variant="default" leftSection={<IconFileTypeCsv size={16} />} onClick={() => void exportAs('csv')} disabled={!r}>{t('reports.csv')}</Button>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={16} />} onClick={() => void exportAs('xlsx')} disabled={!r}>{t('reports.xlsx')}</Button>
          </>}
          <Button variant="default" leftSection={<IconPrinter size={16} />} onClick={() => window.print()} disabled={!r}>{t('common.print')}</Button>
        </>}
      />

      {!r?.meta.snapshot && (
        <Group mb="md" align="flex-end" className="no-print" wrap="wrap">
          <SegmentedControl value={preset} onChange={setPreset} data={[
            { value: '30', label: t('reports.p30') }, { value: '90', label: t('reports.p90') }, { value: '180', label: t('reports.p180') },
            { value: '365', label: t('reports.p365') }, { value: 'custom', label: t('reports.custom') },
          ]} />
          {preset === 'custom' && <>
            <TextInput type="date" label={t('reports.from')} value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.currentTarget.value })} />
            <TextInput type="date" label={t('reports.to')} value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.currentTarget.value })} />
          </>}
        </Group>
      )}

      {q.isLoading && <Loader />}
      {q.isError && <Alert color="red" role="alert">{parseError(q.error).message}</Alert>}

      {r && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {r.meta.snapshot ? t('reports.snapshot') : `${t('reports.period')}: ${r.meta.from} → ${r.meta.to}`} · {t('reports.timezone')}: {r.meta.timezone} · {t('reports.generated')}: {fmtDateTime(r.meta.generated_at, i18n.language)}
          </Text>

          <SimpleGrid cols={{ base: 2, sm: 3, lg: 4 }}>
            {r.kpis.map((k) => (
              <Card key={k.key} padding="md" style={{ borderLeft: `4px solid var(--mantine-color-${toneColor(k.tone)}-6)`, breakInside: 'avoid' }}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700} lh={1.3}>{k.label}</Text>
                <Text fz={26} fw={800} lh={1.3}>{formatKpi(k, i18n.language)}</Text>
              </Card>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>{r.charts.map((c) => <ChartCard key={c.key} c={c} />)}</SimpleGrid>

          <Card padding="md">
            <Text fw={700} size="sm" mb="sm">{t('reports.table')}</Text>
            {r.table.rows.length === 0 ? <Text c="dimmed" size="sm">{t('reports.no_rows')}</Text> : (
              <ScrollArea type="auto">
                <Table striped highlightOnHover verticalSpacing="xs">
                  <Table.Thead><Table.Tr>{r.table.columns.map((c) => <Table.Th key={c.key}>{c.label}</Table.Th>)}</Table.Tr></Table.Thead>
                  <Table.Tbody>{r.table.rows.map((row, i) => (
                    <Table.Tr key={i}>{r.table.columns.map((c) => <Table.Td key={c.key}>{String(row[c.key] ?? '')}</Table.Td>)}</Table.Tr>
                  ))}</Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Card>

          <Accordion variant="contained" className="no-print">
            <Accordion.Item value="how">
              <Accordion.Control>{t('reports.how')}</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  {([['formula', r.meta.method.formula], ['inclusion', r.meta.method.inclusion], ['date_basis', r.meta.method.date_basis], ['sources', r.meta.method.sources]] as const).map(([k, v]) => (
                    <div key={k}><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t(`reports.${k}`)}</Text><Text size="sm">{v}</Text></div>
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}
    </>
  );
}
