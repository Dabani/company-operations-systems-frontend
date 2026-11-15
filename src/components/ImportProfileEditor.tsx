import { ActionIcon, Alert, Autocomplete, Button, Group, Modal, NumberInput, Radio, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';

export interface Profile {
  id: string; name: string; description: string | null; is_system: boolean; layout: 'punches' | 'daily'; sheet: string | null; header_row: number; identify_by: 'employee_number' | 'device_code' | 'either';
  employee_column: string | null; timestamp_column: string | null; date_column: string | null; time_column: string | null; direction_column: string | null;
  in_values: string | null; out_values: string | null; ignore_values: string | null; date_formats: string | null; device_timezone: string | null; slots: { column: string; direction: 'in' | 'out' }[];
}
const blank = { name: '', description: '', layout: 'punches' as 'punches' | 'daily', sheet: '', header_row: 1 as number | string, identify_by: 'either', employee_column: '', timestamp_column: '', date_column: '', time_column: '', direction_column: '',
  in_values: '', out_values: '', ignore_values: '', date_formats: '', device_timezone: '' as string | null, slots: [{ column: 'In', direction: 'in' }, { column: 'Out', direction: 'out' }] as { column: string; direction: string }[] };

function zones(): string[] {
  try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { return ['Africa/Kigali', 'Africa/Nairobi', 'Africa/Kampala', 'UTC']; }
}

/** Create or adapt an import profile: how to read one kind of file. Every field is optional except the name: leave a column empty to have it recognised automatically. */
export function ImportProfileEditor({ profile, columns, onClose, onSaved }: { profile: Profile | 'new' | null; columns?: string[]; onClose: () => void; onSaved?: (id: string) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const form = useForm({ initialValues: blank });
  const [twoCols, setTwoCols] = useState(false);
  const system = profile !== null && profile !== 'new' && profile.is_system;
  useEffect(() => {
    if (profile === null) return;
    if (profile === 'new') { form.setValues(blank); setTwoCols(false); return; }
    form.setValues({ name: profile.name, description: profile.description ?? '', layout: profile.layout, sheet: profile.sheet ?? '', header_row: profile.header_row, identify_by: profile.identify_by, employee_column: profile.employee_column ?? '',
      timestamp_column: profile.timestamp_column ?? '', date_column: profile.date_column ?? '', time_column: profile.time_column ?? '', direction_column: profile.direction_column ?? '', in_values: profile.in_values ?? '', out_values: profile.out_values ?? '',
      ignore_values: profile.ignore_values ?? '', date_formats: profile.date_formats ?? '', device_timezone: profile.device_timezone ?? '', slots: profile.slots.length ? profile.slots : blank.slots });
    setTwoCols(!!(profile.date_column || profile.time_column) && !profile.timestamp_column);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile === 'new' ? 'new' : profile?.id]);

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => {
      const body: Record<string, unknown> = { ...v, sheet: v.sheet || null, device_timezone: v.device_timezone || null };
      for (const k of ['description', 'employee_column', 'timestamp_column', 'date_column', 'time_column', 'direction_column', 'in_values', 'out_values', 'ignore_values', 'date_formats']) body[k] = (v as Record<string, unknown>)[k] || null;
      if (v.layout === 'punches') { if (twoCols) body.timestamp_column = null; else { body.date_column = null; body.time_column = null; } delete body.slots; } else { body.timestamp_column = null; body.time_column = null; body.direction_column = null; body.slots = v.slots.filter((s) => s.column.trim()); }
      return (await (profile === 'new' ? api.post<{ data: Profile }>('/attendance/import-profiles', body) : api.patch<{ data: Profile }>(`/attendance/import-profiles/${(profile as Profile).id}`, body))).data.data;
    },
    onSuccess: (p) => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-profiles'] }); onSaved?.(p.id); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const copy = useMutation({ mutationFn: async () => (await api.post<{ data: Profile }>(`/attendance/import-profiles/${(profile as Profile).id}/duplicate`)).data.data,
    onSuccess: (p) => { toastOk(t('att.profile_copied')); void qc.invalidateQueries({ queryKey: ['att-profiles'] }); onSaved?.(p.id); onClose(); }, onError: toastError });

  const sug = columns ?? [];
  const col = (key: 'employee_column' | 'timestamp_column' | 'date_column' | 'time_column' | 'direction_column', label: string, hint?: string) =>
    <Autocomplete label={label} description={hint} placeholder={t('att.auto_detect')} data={sug} disabled={system} {...form.getInputProps(key)} />;

  return (
    <Modal opened={profile !== null} onClose={onClose} size="xl" centered title={profile === 'new' ? t('att.new_profile') : profile ? profile.name : ''}>
      {system && <Alert variant="light" color="blue" mb="sm" title={t('att.shipped_profile')}>{t('att.shipped_profile_note')}<Group mt="xs"><Button size="xs" loading={copy.isPending} onClick={() => copy.mutate()}>{t('att.duplicate_edit')}</Button></Group></Alert>}
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <Group grow align="flex-start"><TextInput label={t('common.name')} required disabled={system} {...form.getInputProps('name')} />
            <Select label={t('att.layout')} allowDeselect={false} disabled={system} data={[{ value: 'punches', label: t('att.layout_punches') }, { value: 'daily', label: t('att.layout_daily') }]} {...form.getInputProps('layout')} /></Group>
          <Textarea label={t('common.description')} autosize minRows={1} disabled={system} {...form.getInputProps('description')} />
          <Group grow align="flex-start">
            <NumberInput label={t('att.header_row')} description={t('att.header_row_hint')} min={0} max={50} disabled={system} {...form.getInputProps('header_row')} />
            <TextInput label={t('att.sheet')} description={t('att.sheet_hint')} disabled={system} {...form.getInputProps('sheet')} />
            <Select label={t('att.identify_by')} description={t('att.identify_hint')} allowDeselect={false} disabled={system} data={[{ value: 'either', label: t('att.identify_either') }, { value: 'employee_number', label: t('att.identify_number') }, { value: 'device_code', label: t('att.identify_code') }]} {...form.getInputProps('identify_by')} />
          </Group>
          <Text size="xs" c="dimmed">{t('att.columns_hint')}</Text>
          <Group grow align="flex-start">{col('employee_column', t('att.col_employee'))}{form.values.layout === 'punches' && col('direction_column', t('att.col_direction'))}</Group>
          {form.values.layout === 'punches' ? (
            <>
              <Radio.Group value={twoCols ? 'two' : 'one'} onChange={(v) => setTwoCols(v === 'two')} label={t('att.when_is_written')}>
                <Group mt={4}><Radio value="one" label={t('att.one_column')} disabled={system} /><Radio value="two" label={t('att.two_columns')} disabled={system} /></Group>
              </Radio.Group>
              {twoCols ? <Group grow align="flex-start">{col('date_column', t('att.col_date'))}{col('time_column', t('att.col_time'))}</Group> : col('timestamp_column', t('att.col_timestamp'))}
              <Group grow align="flex-start">
                <TextInput label={t('att.in_values')} placeholder="in, 0, Entree" description={t('att.values_hint')} disabled={system} {...form.getInputProps('in_values')} />
                <TextInput label={t('att.out_values')} placeholder="out, 1, Sortie" disabled={system} {...form.getInputProps('out_values')} />
                <TextInput label={t('att.ignore_values')} placeholder="break, 9" disabled={system} {...form.getInputProps('ignore_values')} />
              </Group>
            </>
          ) : (
            <Stack gap="xs">
              {col('date_column', t('att.col_date'))}
              <Text size="sm" fw={600}>{t('att.time_columns')}</Text><Text size="xs" c="dimmed">{t('att.time_columns_hint')}</Text>
              {form.values.slots.map((s, i) => (
                <Group key={i} align="flex-end" gap="xs">
                  <Autocomplete label={i === 0 ? t('att.slot_column') : undefined} data={sug} disabled={system} style={{ flex: 1 }} value={s.column} onChange={(v) => form.setFieldValue('slots', form.values.slots.map((x, j) => j === i ? { ...x, column: v } : x))} />
                  <Select label={i === 0 ? t('att.slot_direction') : undefined} w={110} allowDeselect={false} disabled={system} data={[{ value: 'in', label: t('att.dir.in') }, { value: 'out', label: t('att.dir.out') }]} value={s.direction} onChange={(v) => form.setFieldValue('slots', form.values.slots.map((x, j) => j === i ? { ...x, direction: v ?? 'in' } : x))} />
                  {!system && <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => form.setFieldValue('slots', form.values.slots.filter((_, j) => j !== i))}><IconTrash size={16} /></ActionIcon>}
                </Group>
              ))}
              {!system && <Group><Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => form.setFieldValue('slots', [...form.values.slots, { column: '', direction: 'in' }])}>{t('att.add_time_column')}</Button></Group>}
            </Stack>
          )}
          <Group grow align="flex-start">
            <TextInput label={t('att.date_formats')} placeholder="d/m/Y H:i" description={t('att.date_formats_hint')} disabled={system} {...form.getInputProps('date_formats')} />
            <Select label={t('att.device_timezone')} description={t('att.device_timezone_hint')} searchable clearable disabled={system} data={zones()} {...form.getInputProps('device_timezone')} />
          </Group>
          {!system && <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>}
        </Stack>
      </form>
    </Modal>
  );
}
