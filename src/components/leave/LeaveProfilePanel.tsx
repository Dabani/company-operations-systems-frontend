import { Alert, Button, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface Profile { employee_id: string; date_of_birth: string | null; sex: string | null; weekly_hours: string | null }

/** Date of birth, sex and weekly hours: only what a statutory leave rule can depend on. Encrypted by the server; every view is audited. */
export function LeaveProfilePanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const sexes = useLookup('employee_sex');
  const [emp, setEmp] = useState<string | null>(null);
  const form = useForm({ initialValues: { date_of_birth: '', sex_id: '', weekly_hours: '' as number | string } });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const prof = useQuery({ queryKey: ['leave-profile', emp], enabled: !!emp, gcTime: 0, queryFn: async () => (await api.get<{ data: Profile }>(`/leave/profiles/${emp}`)).data.data });
  useEffect(() => {
    if (prof.data) form.setValues({ date_of_birth: prof.data.date_of_birth ?? '', sex_id: sexes.items.find((s) => s.code === prof.data.sex)?.id ?? '', weekly_hours: prof.data.weekly_hours === null ? '' : Number(prof.data.weekly_hours) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prof.data, sexes.items.length]);
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.put(`/leave/profiles/${emp}`, { date_of_birth: v.date_of_birth || null, sex_id: v.sex_id || null, weekly_hours: v.weekly_hours === '' ? null : v.weekly_hours }),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['leave-status'] }); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Stack gap="sm" maw={520}>
      <Alert color="blue" variant="light">{t('leave.profile_hint')}</Alert>
      <Select label={t('leave.employee')} searchable value={emp} onChange={setEmp} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} />
      {emp && prof.isSuccess && (
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
          <TextInput type="date" label={t('leave.dob')} {...form.getInputProps('date_of_birth')} />
          <Select label={t('leave.sex')} clearable data={sexes.options} {...form.getInputProps('sex_id')} />
          <NumberInput label={t('leave.weekly_hours')} description={t('leave.weekly_hours_hint')} min={1} max={168} decimalScale={2} {...form.getInputProps('weekly_hours')} />
          <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      )}
      {!emp && <Text size="sm" c="dimmed">{t('leave.profile_pick')}</Text>}
    </Stack>
  );
}
