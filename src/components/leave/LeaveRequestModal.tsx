import { Alert, Badge, Button, Checkbox, Group, List, Modal, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { formatDays, isSubmittable, type LeavePreview } from '@/lib/leave';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface TypeRow { leave_type_id: string; leave_type: string; allow_half_days: boolean; is_requestable: boolean; is_active: boolean; uses_balance: boolean }
interface Props { opened: boolean; onClose: () => void; /** HR requesting for somebody else */ onBehalf?: boolean }

/** Request leave. Every change is previewed by the server first (days counted, balance after, blockers, warnings): the button is on only when nothing blocks. */
export function LeaveRequestModal({ opened, onClose, onBehalf }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const lookup = useLookup('leave_type');
  const form = useForm({ initialValues: { employee_id: '', leave_type_id: '', start_date: '', end_date: '', start_half: false, end_half: false, reason: '' } });
  const types = useQuery({ queryKey: ['leave-types'], enabled: opened, queryFn: async () => (await api.get<{ data: TypeRow[] }>('/leave/types')).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], enabled: opened && !!onBehalf, queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const usable = (types.data ?? []).filter((x) => x.is_requestable && x.is_active);
  const chosen = usable.find((x) => x.leave_type_id === form.values.leave_type_id);
  const [dv] = useDebouncedValue(form.values, 400);
  const ready = !!dv.leave_type_id && !!dv.start_date && !!dv.end_date && (!onBehalf || !!dv.employee_id);
  const preview = useQuery({
    queryKey: ['leave-preview', dv], enabled: opened && ready, retry: false,
    queryFn: async () => (await api.post<{ data: LeavePreview }>('/leave/requests/preview', { ...dv, employee_id: dv.employee_id || undefined })).data.data,
  });
  const submit = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/leave/requests', { ...v, employee_id: v.employee_id || undefined, reason: v.reason || undefined }),
    onSuccess: () => { toastOk(t('leave.request_sent')); form.reset(); onClose(); void qc.invalidateQueries({ queryKey: ['leave-me'] }); void qc.invalidateQueries({ queryKey: ['leave-requests'] }); void qc.invalidateQueries({ queryKey: ['leave-calendar'] }); void qc.invalidateQueries({ queryKey: ['leave-balances'] }); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const p = preview.data;
  const settled = ready && !preview.isFetching && dv === form.values;

  return (
    <Modal opened={opened} onClose={onClose} title={onBehalf ? t('leave.request_for') : t('leave.request_title')} centered size="lg">
      <form onSubmit={form.onSubmit((v) => submit.mutate(v))}><Stack gap="sm">
        {onBehalf && <Select label={t('leave.employee')} required searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('employee_id')} />}
        <Select label={t('leave.type')} required data={usable.map((x) => ({ value: x.leave_type_id, label: lookup.items.find((l) => l.code === x.leave_type)?.label ?? x.leave_type }))} {...form.getInputProps('leave_type_id')} />
        <Group grow align="flex-start">
          <TextInput type="date" label={t('leave.from')} required {...form.getInputProps('start_date')} />
          <TextInput type="date" label={t('leave.to')} required min={form.values.start_date || undefined} {...form.getInputProps('end_date')} />
        </Group>
        {chosen?.allow_half_days && <Group>
          <Checkbox label={t('leave.start_half')} {...form.getInputProps('start_half', { type: 'checkbox' })} />
          <Checkbox label={t('leave.end_half')} {...form.getInputProps('end_half', { type: 'checkbox' })} />
        </Group>}
        <Textarea label={t('leave.reason')} autosize minRows={2} maxLength={5000} {...form.getInputProps('reason')} />

        {ready && p && (
          <Stack gap="xs" aria-live="polite">
            <Group gap="xs">
              <Badge size="lg" variant="light">{t('leave.days_counted', { days: formatDays(p.days) })}</Badge>
              {p.available !== null && <Badge size="lg" variant="outline" color="gray">{t('leave.available_after', { available: formatDays(p.available), after: formatDays(p.balance_after) })}</Badge>}
            </Group>
            {p.blockers.length > 0 && <Alert color="red" variant="light" title={t('leave.cannot_submit')}><List size="sm">{p.blockers.map((b) => <List.Item key={b.code}>{b.message}</List.Item>)}</List></Alert>}
            {p.warnings.length > 0 && <Alert color="orange" variant="light" title={t('leave.warnings')}><List size="sm">{p.warnings.map((w) => <List.Item key={w.code}>{w.message}</List.Item>)}</List></Alert>}
            {p.missing_profile.length > 0 && <Alert color="yellow" variant="light">{t('leave.profile_missing')}</Alert>}
          </Stack>
        )}
        {ready && preview.isError && <Text size="sm" c="red">{parseError(preview.error).message}</Text>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={submit.isPending} disabled={!settled || !isSubmittable(p)}>{t('leave.submit')}</Button>
        </Group>
      </Stack></form>
    </Modal>
  );
}
