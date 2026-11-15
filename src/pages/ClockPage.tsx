import { Alert, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClockPlay, IconClockStop, IconMapPin } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { CorrectionModal, type CorrectionTarget } from '@/components/CorrectionModal';
import { PageHeader } from '@/components/PageHeader';
import { STATUS_COLOR, currentMonth, fmtClock, fmtLongDate, fmtMinutes, fmtTime, weekday } from '@/lib/attendance';
import { GeoError, getPosition } from '@/lib/geo';
import { toastError, toastOk } from '@/lib/ui';

interface Today {
  employee_id: string; name: string; state: 'in' | 'out'; since: string | null; timezone: string; server_time: string; ip_restricted: boolean; geolocation: 'off' | 'record' | 'required'; date: string;
  shift: { name: string; start: string; end: string } | null; events: { direction: string; at: string }[];
}
export interface DayRow {
  id: string; employee_id: string; employee: string | null; employee_number: string | null; work_date: string; status: string; shift: string | null; expected_minutes: number; first_in_at: string | null;
  last_out_at: string | null; worked_minutes: number; late_minutes: number; overtime_minutes: number; is_open: boolean; corrected: boolean;
}
interface MonthData { month: string; timezone: string; validated: boolean; days: DayRow[] }

export function ClockPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>('');
  const [correct, setCorrect] = useState<CorrectionTarget | null>(null);
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const today = useQuery({ queryKey: ['att-today'], refetchInterval: 60000, queryFn: async () => (await api.get<{ data: Today }>('/attendance/me/today')).data.data, retry: false });
  const tz = today.data?.timezone ?? 'UTC';
  const m = month || currentMonth(tz);
  const days = useQuery({ queryKey: ['att-my-days', m], enabled: !!today.data, queryFn: async () => (await api.get<{ data: MonthData }>('/attendance/me/days', { params: { month: m } })).data.data });

  // The clock shown is the server's clock (corrected by the offset measured when the page loaded): a wrong phone clock cannot mislead the person.
  useEffect(() => { if (today.data) setOffset(Date.parse(today.data.server_time) - Date.now()); }, [today.data?.server_time]);
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(id); }, []);
  const now = tick + offset;

  const clock = useMutation({
    mutationFn: async () => {
      const d = today.data!;
      let place: Record<string, number> = {};
      if (d.geolocation !== 'off') {
        try { place = { ...(await getPosition()) }; } catch (e) {
          if (d.geolocation === 'required') throw e;            // required: no location, no clock; record: carry on without it
        }
      }
      return (await api.post<{ data: Today }>('/attendance/me/clock', { direction: d.state === 'in' ? 'out' : 'in', ...place })).data.data;
    },
    onSuccess: (d) => { toastOk(d.state === 'in' ? t('att.clocked_in') : t('att.clocked_out')); void qc.invalidateQueries({ queryKey: ['att-today'] }); void qc.invalidateQueries({ queryKey: ['att-my-days'] }); },
    onError: (e) => { if (e instanceof GeoError) notifications.show({ color: 'red', message: t(`att.geo.${e.reason}`) }); else toastError(e); },
  });

  if (today.isError) return <><PageHeader title={t('att.clock_title')} /><Text c="dimmed">{t('att.no_employee')}</Text></>;
  const d = today.data;
  if (!d) return <Loader />;
  const lang = i18n.language;
  const elapsed = d.state === 'in' && d.since ? Math.max(0, Math.floor((now - Date.parse(d.since)) / 60000)) : 0;
  const rows = days.data?.days ?? [];
  const sum = (k: 'worked_minutes' | 'late_minutes' | 'overtime_minutes') => rows.reduce((a, r) => a + r[k], 0);

  return (
    <>
      <PageHeader title={t('att.clock_title')} description={t('att.clock_intro')} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="lg">
        <Card withBorder padding="lg">
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm">{fmtLongDate(now, tz, lang)}</Text>
            <Title order={1} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock(now, tz, lang)}</Title>
            <Text size="xs" c="dimmed">{t('att.server_time', { tz })}</Text>
            <Badge size="lg" variant="light" color={d.state === 'in' ? 'green' : 'gray'}>{d.state === 'in' ? t('att.state_in', { time: fmtTime(d.since, tz, lang), minutes: fmtMinutes(elapsed) }) : t('att.state_out')}</Badge>
            <Button size="xl" mt="sm" color={d.state === 'in' ? 'red' : 'green'} leftSection={d.state === 'in' ? <IconClockStop size={22} /> : <IconClockPlay size={22} />} loading={clock.isPending} onClick={() => clock.mutate()}>
              {d.state === 'in' ? t('att.clock_out') : t('att.clock_in')}
            </Button>
            {d.geolocation !== 'off' && clock.isPending && <Text size="xs" c="dimmed"><IconMapPin size={12} /> {t('att.locating')}</Text>}
          </Stack>
        </Card>
        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Text fw={600}>{t('att.today')}</Text>
            <Text size="sm">{d.shift ? t('att.shift_today', { name: d.shift.name, start: d.shift.start, end: d.shift.end }) : t('att.no_shift_today')}</Text>
            {d.events.length === 0 && <Text size="sm" c="dimmed">{t('att.no_punches')}</Text>}
            {d.events.map((e, i) => <Group key={i} gap="xs"><Badge size="sm" color={e.direction === 'in' ? 'green' : 'gray'} variant="light">{t(`att.dir.${e.direction}`)}</Badge><Text size="sm">{fmtTime(e.at, tz, lang)}</Text></Group>)}
            {(d.ip_restricted || d.geolocation !== 'off') && (
              <Alert variant="light" color="gray" mt="xs" p="xs">
                {d.ip_restricted && <Text size="xs">{t('att.notice_network')}</Text>}
                {d.geolocation !== 'off' && <Text size="xs">{d.geolocation === 'required' ? t('att.notice_location_required') : t('att.notice_location_record')}</Text>}
              </Alert>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Group justify="space-between" mb="sm"><Title order={4}>{t('att.my_month')}</Title><TextInput type="month" value={m} onChange={(e) => setMonth(e.currentTarget.value)} w={180} aria-label={t('att.month')} /></Group>
      {days.data?.validated && <Alert variant="light" color="green" mb="sm">{t('att.month_validated_note')}</Alert>}
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('att.date')}</Table.Th><Table.Th>{t('att.in')}</Table.Th><Table.Th>{t('att.out')}</Table.Th><Table.Th>{t('att.worked')}</Table.Th><Table.Th visibleFrom="sm">{t('att.late')}</Table.Th><Table.Th visibleFrom="sm">{t('att.overtime')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{weekday(r.work_date, lang)} {r.work_date.slice(8)}</Table.Td><Table.Td>{fmtTime(r.first_in_at, tz, lang)}</Table.Td><Table.Td>{r.is_open ? '…' : fmtTime(r.last_out_at, tz, lang)}</Table.Td>
              <Table.Td>{fmtMinutes(r.worked_minutes)}</Table.Td><Table.Td visibleFrom="sm">{r.late_minutes ? `${r.late_minutes} min` : '—'}</Table.Td><Table.Td visibleFrom="sm">{r.overtime_minutes ? fmtMinutes(r.overtime_minutes) : '—'}</Table.Td>
              <Table.Td><Group gap={4}><Badge color={STATUS_COLOR[r.status]} variant="light">{t(`att.status.${r.status}`)}</Badge>{r.corrected && <Badge size="xs" variant="outline">{t('att.corrected')}</Badge>}</Group></Table.Td>
              <Table.Td>{!days.data?.validated && r.work_date <= d.date && <Button size="compact-xs" variant="subtle" onClick={() => setCorrect({ date: r.work_date, firstIn: r.first_in_at, lastOut: r.last_out_at, timezone: tz })}>{t('att.correct')}</Button>}</Table.Td>
            </Table.Tr>
          ))}
          {rows.length === 0 && <Table.Tr><Table.Td colSpan={8}><Text size="sm" c="dimmed">{t('att.no_days')}</Text></Table.Td></Table.Tr>}
          {rows.length > 0 && <Table.Tr><Table.Td colSpan={3}><Text fw={600} size="sm">{t('att.total')}</Text></Table.Td><Table.Td><b>{fmtMinutes(sum('worked_minutes'))}</b></Table.Td><Table.Td visibleFrom="sm"><b>{sum('late_minutes')} min</b></Table.Td><Table.Td visibleFrom="sm"><b>{fmtMinutes(sum('overtime_minutes'))}</b></Table.Td><Table.Td colSpan={2} /></Table.Tr>}
        </Table.Tbody>
      </Table>
      <CorrectionModal target={correct} onClose={() => setCorrect(null)} />
    </>
  );
}
