import { Badge, Button, Group, Modal, MultiSelect, NumberInput, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCurrentLocation, IconEdit, IconPlus, IconTrash, IconUsersPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RowIconButton } from '@/components/DataList';
import { weekday } from '@/lib/attendance';
import { getPosition } from '@/lib/geo';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Shift { id: string; code: string; name: string; start_time: string; end_time: string; break_minutes: number; auto_deduct_break: boolean; grace_minutes: number; is_active: boolean }
interface Schedule { id: string; name: string; is_active: boolean; days: { weekday: number; shift_id: string; shift: string | null }[] }
const WEEK = [1, 2, 3, 4, 5, 6, 7];

function useEmployees() {
  return useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
}
function useShifts() {
  return useQuery({ queryKey: ['att-shifts'], queryFn: async () => (await api.get<{ data: Shift[] }>('/attendance/shifts')).data.data });
}

export function ShiftsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Shift | 'new' | null>(null);
  const shifts = useShifts();
  const form = useForm({ initialValues: { name: '', start_time: '08:00', end_time: '17:00', break_minutes: 60 as number | string, grace_minutes: 10 as number | string, auto_deduct_break: false, is_active: true } });
  const open = (s: Shift | 'new') => { setEdit(s); form.setValues(s === 'new' ? { name: '', start_time: '08:00', end_time: '17:00', break_minutes: 60, grace_minutes: 10, auto_deduct_break: false, is_active: true } : { name: s.name, start_time: s.start_time, end_time: s.end_time, break_minutes: s.break_minutes, grace_minutes: s.grace_minutes, auto_deduct_break: s.auto_deduct_break, is_active: s.is_active }); };
  const save = useMutation({ mutationFn: async (v: typeof form.values) => edit === 'new' ? api.post('/attendance/shifts', v) : api.patch(`/attendance/shifts/${(edit as Shift).id}`, v),
    onSuccess: () => { toastOk(); setEdit(null); void qc.invalidateQueries({ queryKey: ['att-shifts'] }); void qc.invalidateQueries({ queryKey: ['att-schedules'] }); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  return (
    <Stack gap="sm">
      <Group justify="space-between"><Text size="sm" c="dimmed">{t('att.shifts_intro')}</Text><Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('att.new_shift')}</Button></Group>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('att.hours')}</Table.Th><Table.Th visibleFrom="sm">{t('att.break')}</Table.Th><Table.Th visibleFrom="sm">{t('att.grace')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(shifts.data ?? []).map((s) => (
            <Table.Tr key={s.id}><Table.Td><Badge variant="outline">{s.code}</Badge></Table.Td><Table.Td><Text size="sm" fw={600}>{s.name}</Text></Table.Td><Table.Td>{s.start_time} – {s.end_time}</Table.Td>
              <Table.Td visibleFrom="sm">{s.break_minutes} min{s.auto_deduct_break ? ` (${t('att.auto')})` : ''}</Table.Td><Table.Td visibleFrom="sm">{s.grace_minutes} min</Table.Td>
              <Table.Td><Badge color={s.is_active ? 'green' : 'gray'} variant="light">{s.is_active ? t('common.active') : t('common.inactive')}</Badge></Table.Td>
              <Table.Td><RowIconButton label={t('common.edit')} onClick={() => open(s)}><IconEdit size={18} /></RowIconButton></Table.Td></Table.Tr>
          ))}
          {shifts.data?.length === 0 && <Table.Tr><Table.Td colSpan={7}><Text size="sm" c="dimmed">{t('att.no_shifts')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={!!edit} onClose={() => setEdit(null)} centered title={edit === 'new' ? t('att.new_shift') : t('att.edit_shift')}>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
          <Group grow align="flex-start"><TextInput type="time" label={t('att.starts')} required {...form.getInputProps('start_time')} /><TextInput type="time" label={t('att.ends')} description={t('att.ends_hint')} required {...form.getInputProps('end_time')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('att.break_minutes')} min={0} max={480} {...form.getInputProps('break_minutes')} /><NumberInput label={t('att.grace_minutes')} description={t('att.grace_hint')} min={0} max={120} {...form.getInputProps('grace_minutes')} /></Group>
          <Switch label={t('att.auto_deduct')} description={t('att.auto_deduct_hint')} {...form.getInputProps('auto_deduct_break', { type: 'checkbox' })} />
          <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
    </Stack>
  );
}

export function SchedulesTab() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Schedule | 'new' | null>(null);
  const [assign, setAssign] = useState<Schedule | null>(null);
  const shifts = useShifts();
  const emps = useEmployees();
  const schedules = useQuery({ queryKey: ['att-schedules'], queryFn: async () => (await api.get<{ data: Schedule[] }>('/attendance/schedules')).data.data });
  const form = useForm({ initialValues: { name: '', is_active: true, days: {} as Record<number, string | null> } });
  const aform = useForm({ initialValues: { employee_ids: [] as string[], effective_from: new Date().toISOString().slice(0, 10) } });
  const shiftOpts = (shifts.data ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: `${s.name} (${s.start_time}–${s.end_time})` }));
  const open = (s: Schedule | 'new') => { setEdit(s); form.setValues({ name: s === 'new' ? '' : s.name, is_active: s === 'new' ? true : s.is_active, days: s === 'new' ? {} : Object.fromEntries(s.days.map((d) => [d.weekday, d.shift_id])) }); };
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => { const body = { name: v.name, is_active: v.is_active, days: WEEK.filter((d) => v.days[d]).map((d) => ({ weekday: d, shift_id: v.days[d] })) }; return edit === 'new' ? api.post('/attendance/schedules', body) : api.patch(`/attendance/schedules/${(edit as Schedule).id}`, body); },
    onSuccess: () => { toastOk(); setEdit(null); void qc.invalidateQueries({ queryKey: ['att-schedules'] }); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const doAssign = useMutation({ mutationFn: async (v: typeof aform.values) => (await api.post<{ data: { assigned: number } }>('/attendance/schedule-assignments', { schedule_id: assign!.id, ...v })).data.data,
    onSuccess: (r) => { toastOk(t('att.assigned', { count: r.assigned })); setAssign(null); aform.reset(); }, onError: (e) => { aform.setErrors(parseError(e).fields); toastError(e); } });
  const name = (d: number) => weekday(`2026-11-0${1 + d}`, i18n.language);
  return (
    <Stack gap="sm">
      <Group justify="space-between"><Text size="sm" c="dimmed">{t('att.schedules_intro')}</Text><Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('att.new_schedule')}</Button></Group>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th>{WEEK.map((d) => <Table.Th key={d} visibleFrom={d > 5 ? 'sm' : undefined}>{name(d)}</Table.Th>)}<Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(schedules.data ?? []).map((s) => (
            <Table.Tr key={s.id}><Table.Td><Text size="sm" fw={600}>{s.name}</Text>{!s.is_active && <Badge size="xs" color="gray">{t('common.inactive')}</Badge>}</Table.Td>
              {WEEK.map((d) => <Table.Td key={d} visibleFrom={d > 5 ? 'sm' : undefined}><Text size="xs">{s.days.find((x) => x.weekday === d)?.shift ?? '—'}</Text></Table.Td>)}
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end"><RowIconButton label={t('att.assign')} onClick={() => setAssign(s)}><IconUsersPlus size={18} /></RowIconButton><RowIconButton label={t('common.edit')} onClick={() => open(s)}><IconEdit size={18} /></RowIconButton></Group></Table.Td></Table.Tr>
          ))}
          {schedules.data?.length === 0 && <Table.Tr><Table.Td colSpan={9}><Text size="sm" c="dimmed">{t('att.no_schedules')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={!!edit} onClose={() => setEdit(null)} centered title={edit === 'new' ? t('att.new_schedule') : t('att.edit_schedule')}>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
          <Text size="sm" fw={600}>{t('att.weekly_pattern')}</Text><Text size="xs" c="dimmed">{t('att.weekly_hint')}</Text>
          {WEEK.map((d) => <Select key={d} label={name(d)} clearable placeholder={t('att.day_off')} data={shiftOpts} value={form.values.days[d] ?? null} onChange={(v) => form.setFieldValue('days', { ...form.values.days, [d]: v })} />)}
          <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
          <Text size="xs" c="dimmed">{t('att.schedule_change_note')}</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!assign} onClose={() => setAssign(null)} centered title={`${t('att.assign')} — ${assign?.name ?? ''}`}>
        <form onSubmit={aform.onSubmit((v) => doAssign.mutate(v))}><Stack gap="sm">
          <Text size="sm" c="dimmed">{t('att.assign_note')}</Text>
          <MultiSelect searchable required label={t('hr.employees')} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...aform.getInputProps('employee_ids')} />
          <TextInput type="date" label={t('hr.effective_from')} required {...aform.getInputProps('effective_from')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setAssign(null)}>{t('common.cancel')}</Button><Button type="submit" disabled={!aform.values.employee_ids.length} loading={doAssign.isPending}>{t('att.assign')}</Button></Group>
        </Stack></form>
      </Modal>
      <OverridesBlock shifts={shifts.data ?? []} />
    </Stack>
  );
}

/** One-day exceptions: a different shift, or a day off, for one person on one date. */
function OverridesBlock({ shifts }: { shifts: Shift[] }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const emps = useEmployees();
  const month = new Date().toISOString().slice(0, 7);
  const list = useQuery({ queryKey: ['att-overrides', month], queryFn: async () => (await api.get<{ data: { id: string; employee_id: string; work_date: string; shift: string | null; reason: string | null }[] }>('/attendance/overrides', { params: { month } })).data.data });
  const form = useForm({ initialValues: { employee_id: null as string | null, work_date: '', shift_id: null as string | null, reason: '' } });
  const save = useMutation({ mutationFn: async (v: typeof form.values) => api.post('/attendance/overrides', { ...v, shift_id: v.shift_id || null }), onSuccess: () => { toastOk(); form.reset(); void qc.invalidateQueries({ queryKey: ['att-overrides'] }); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/attendance/overrides/${id}`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-overrides'] }); }, onError: toastError });
  const name = (id: string) => emps.data?.find((e) => e.id === id)?.full_name ?? id;
  return (
    <Stack gap="xs" mt="xl">
      <Text fw={600}>{t('att.overrides_title')}</Text><Text size="sm" c="dimmed">{t('att.overrides_intro')}</Text>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Group align="flex-end" gap="xs">
          <Select label={t('hr.employee')} searchable required data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('employee_id')} />
          <TextInput type="date" label={t('att.date')} required {...form.getInputProps('work_date')} />
          <Select label={t('att.shift')} clearable placeholder={t('att.day_off')} data={shifts.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))} {...form.getInputProps('shift_id')} />
          <TextInput label={t('att.reason')} {...form.getInputProps('reason')} />
          <Button type="submit" loading={save.isPending}>{t('att.set_override')}</Button>
        </Group>
      </form>
      <Table verticalSpacing="xs"><Table.Tbody>
        {(list.data ?? []).map((o) => (
          <Table.Tr key={o.id}><Table.Td>{name(o.employee_id)}</Table.Td><Table.Td>{o.work_date}</Table.Td><Table.Td>{o.shift ?? t('att.day_off')}</Table.Td><Table.Td><Text size="xs" c="dimmed">{o.reason}</Text></Table.Td>
            <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => remove.mutate(o.id)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>
        ))}
      </Table.Tbody></Table>
    </Stack>
  );
}

export function HolidaysTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [year, setYear] = useState<number | string>(new Date().getFullYear());
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const list = useQuery({ queryKey: ['att-holidays', year], queryFn: async () => (await api.get<{ data: { id: string; holiday_date: string; name: string }[] }>('/attendance/holidays', { params: { year } })).data.data });
  const form = useForm({ initialValues: { holiday_date: '', name: '' } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['att-holidays'] }); };
  const add = useMutation({ mutationFn: async (v: typeof form.values) => api.post('/attendance/holidays', v), onSuccess: () => { toastOk(); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const remove = useMutation({ mutationFn: async () => api.delete(`/attendance/holidays/${del!.id}`), onSuccess: () => { toastOk(); setDel(null); refresh(); }, onError: toastError });
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">{t('att.holidays_intro')}</Text>
      <Group align="flex-end"><NumberInput label={t('att.year')} value={year} onChange={setYear} min={2000} max={2100} w={120} /></Group>
      <form onSubmit={form.onSubmit((v) => add.mutate(v))}>
        <Group align="flex-end" gap="xs"><TextInput type="date" label={t('att.date')} required {...form.getInputProps('holiday_date')} /><TextInput label={t('common.name')} required style={{ flex: 1 }} {...form.getInputProps('name')} /><Button type="submit" leftSection={<IconPlus size={16} />} loading={add.isPending}>{t('att.add_holiday')}</Button></Group>
      </form>
      <Table verticalSpacing="xs"><Table.Tbody>
        {(list.data ?? []).map((h) => (
          <Table.Tr key={h.id}><Table.Td w={140}>{h.holiday_date}</Table.Td><Table.Td>{h.name}</Table.Td><Table.Td w={50}><RowIconButton label={t('common.delete')} color="red" onClick={() => setDel(h)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>
        ))}
        {list.data?.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{t('att.no_holidays')}</Text></Table.Td></Table.Tr>}
      </Table.Tbody></Table>
      <ConfirmModal opened={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} text={t('att.holiday_confirm', { name: del?.name ?? '' })} />
    </Stack>
  );
}

/** Where people may clock in from: office networks (IP ranges) and work sites (a place on the map). Both are optional. */
export function PlacesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const nets = useQuery({ queryKey: ['att-networks'], queryFn: async () => (await api.get<{ data: { id: string; label: string; cidr: string; is_active: boolean }[] }>('/attendance/networks')).data.data });
  const sites = useQuery({ queryKey: ['att-sites'], queryFn: async () => (await api.get<{ data: { id: string; name: string; latitude: number; longitude: number; radius_meters: number; is_active: boolean }[] }>('/attendance/sites')).data.data });
  const nform = useForm({ initialValues: { label: '', cidr: '' } });
  const sform = useForm({ initialValues: { name: '', latitude: '' as number | string, longitude: '' as number | string, radius_meters: 150 as number | string } });
  const addNet = useMutation({ mutationFn: async (v: typeof nform.values) => api.post('/attendance/networks', v), onSuccess: () => { toastOk(); nform.reset(); void qc.invalidateQueries({ queryKey: ['att-networks'] }); }, onError: (e) => { nform.setErrors(parseError(e).fields); toastError(e); } });
  const delNet = useMutation({ mutationFn: async (id: string) => api.delete(`/attendance/networks/${id}`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-networks'] }); }, onError: toastError });
  const toggleNet = useMutation({ mutationFn: async (n: { id: string; is_active: boolean }) => api.patch(`/attendance/networks/${n.id}`, { is_active: !n.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['att-networks'] }), onError: toastError });
  const addSite = useMutation({ mutationFn: async (v: typeof sform.values) => api.post('/attendance/sites', v), onSuccess: () => { toastOk(); sform.reset(); void qc.invalidateQueries({ queryKey: ['att-sites'] }); }, onError: (e) => { sform.setErrors(parseError(e).fields); toastError(e); } });
  const delSite = useMutation({ mutationFn: async (id: string) => api.delete(`/attendance/sites/${id}`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-sites'] }); }, onError: toastError });
  const toggleSite = useMutation({ mutationFn: async (s: { id: string; is_active: boolean }) => api.patch(`/attendance/sites/${s.id}`, { is_active: !s.is_active }), onSuccess: () => qc.invalidateQueries({ queryKey: ['att-sites'] }), onError: toastError });
  const here = async () => { try { const p = await getPosition(); sform.setValues({ ...sform.values, latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) }); } catch { toastError(new Error('location')); } };
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text fw={600}>{t('att.networks_title')}</Text><Text size="sm" c="dimmed">{t('att.networks_intro')}</Text>
        <form onSubmit={nform.onSubmit((v) => addNet.mutate(v))}><Group align="flex-end" gap="xs"><TextInput label={t('att.label')} required {...nform.getInputProps('label')} /><TextInput label={t('att.cidr')} placeholder="10.0.0.0/24" required {...nform.getInputProps('cidr')} /><Button type="submit" leftSection={<IconPlus size={16} />} loading={addNet.isPending}>{t('common.add')}</Button></Group></form>
        <Table verticalSpacing="xs"><Table.Tbody>
          {(nets.data ?? []).map((n) => <Table.Tr key={n.id}><Table.Td>{n.label}</Table.Td><Table.Td><Badge variant="outline">{n.cidr}</Badge></Table.Td><Table.Td><Switch checked={n.is_active} onChange={() => toggleNet.mutate(n)} aria-label={t('common.active')} /></Table.Td>
            <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => delNet.mutate(n.id)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>)}
        </Table.Tbody></Table>
      </Stack>
      <Stack gap="sm">
        <Text fw={600}>{t('att.sites_title')}</Text><Text size="sm" c="dimmed">{t('att.sites_intro')}</Text>
        <form onSubmit={sform.onSubmit((v) => addSite.mutate(v))}>
          <Group align="flex-end" gap="xs">
            <TextInput label={t('common.name')} required {...sform.getInputProps('name')} />
            <NumberInput label={t('att.latitude')} decimalScale={6} min={-90} max={90} required w={140} {...sform.getInputProps('latitude')} />
            <NumberInput label={t('att.longitude')} decimalScale={6} min={-180} max={180} required w={140} {...sform.getInputProps('longitude')} />
            <NumberInput label={t('att.radius')} min={10} max={5000} required w={110} {...sform.getInputProps('radius_meters')} />
            <Button variant="default" leftSection={<IconCurrentLocation size={16} />} onClick={() => void here()}>{t('att.use_my_location')}</Button>
            <Button type="submit" leftSection={<IconPlus size={16} />} loading={addSite.isPending}>{t('common.add')}</Button>
          </Group>
        </form>
        <Table verticalSpacing="xs"><Table.Tbody>
          {(sites.data ?? []).map((s) => <Table.Tr key={s.id}><Table.Td>{s.name}</Table.Td><Table.Td><Text size="xs" c="dimmed">{s.latitude}, {s.longitude} · {s.radius_meters} m</Text></Table.Td><Table.Td><Switch checked={s.is_active} onChange={() => toggleSite.mutate(s)} aria-label={t('common.active')} /></Table.Td>
            <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => delSite.mutate(s.id)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>)}
        </Table.Tbody></Table>
      </Stack>
    </Stack>
  );
}

const ATT_KEYS = ['overtime_min_minutes', 'pairing_window_hours', 'punch_min_interval_seconds', 'geolocation_mode', 'geolocation_max_accuracy_meters'];
interface Setting { key: string; value: number; default: number; min: number; max: number }

export function AttendanceSettingsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [vals, setVals] = useState<Record<string, number | string>>({});
  const q = useQuery({ queryKey: ['hr-settings'], queryFn: async () => (await api.get<{ data: Setting[] }>('/hr/settings')).data.data, retry: false });
  const save = useMutation({ mutationFn: async () => api.put('/hr/settings', Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)]))), onSuccess: () => { toastOk(); setVals({}); void qc.invalidateQueries({ queryKey: ['hr-settings'] }); }, onError: toastError });
  if (q.isError) return <Text size="sm" c="dimmed">{t('att.settings_no_access')}</Text>;
  const rows = (q.data ?? []).filter((s) => ATT_KEYS.includes(s.key));
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">{t('att.settings_intro')}</Text>
      {rows.map((s) => s.key === 'geolocation_mode' ? (
        <Select key={s.key} label={t('rec.setting.geolocation_mode')} description={t('att.geo_mode_hint')} allowDeselect={false} w={360}
          data={[{ value: '0', label: t('att.geo_mode.0') }, { value: '1', label: t('att.geo_mode.1') }, { value: '2', label: t('att.geo_mode.2') }]} value={String(vals[s.key] ?? s.value)} onChange={(v) => setVals({ ...vals, [s.key]: Number(v) })} />
      ) : (
        <NumberInput key={s.key} label={t(`rec.setting.${s.key}`)} description={t('rec.setting_range', { min: s.min, max: s.max, def: s.default })} min={s.min} max={s.max} w={360} value={vals[s.key] ?? s.value} onChange={(v) => setVals({ ...vals, [s.key]: v })} />
      ))}
      <Group><Button disabled={!Object.keys(vals).length} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></Group>
    </Stack>
  );
}
