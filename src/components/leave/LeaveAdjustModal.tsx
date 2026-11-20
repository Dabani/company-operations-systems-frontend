import { Button, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface TypeRow { leave_type_id: string; leave_type: string; uses_balance: boolean; is_active: boolean }

/** HR adjustment of a leave balance (opening balance, correction, compensatory day). A reason is always required and the line stays in the ledger. */
export function LeaveAdjustModal({ opened, onClose, employeeId }: { opened: boolean; onClose: () => void; employeeId?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const lookup = useLookup('leave_type');
  const form = useForm({ initialValues: { employee_id: employeeId ?? '', leave_type_id: '', days: '' as number | string, entry_date: '', reason: '' } });
  const types = useQuery({ queryKey: ['leave-types'], enabled: opened, queryFn: async () => (await api.get<{ data: TypeRow[] }>('/leave/types')).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], enabled: opened && !employeeId, queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/leave/adjustments', { ...v, employee_id: employeeId ?? v.employee_id, entry_date: v.entry_date || undefined }),
    onSuccess: () => { toastOk(); form.reset(); onClose(); void qc.invalidateQueries({ queryKey: ['leave-balances'] }); void qc.invalidateQueries({ queryKey: ['leave-ledger'] }); void qc.invalidateQueries({ queryKey: ['leave-me'] }); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={t('leave.adjust_title')} centered>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
        {!employeeId && <Select label={t('leave.employee')} required searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('employee_id')} />}
        <Select label={t('leave.type')} required data={(types.data ?? []).filter((x) => x.uses_balance && x.is_active).map((x) => ({ value: x.leave_type_id, label: lookup.items.find((l) => l.code === x.leave_type)?.label ?? x.leave_type }))} {...form.getInputProps('leave_type_id')} />
        <Group grow align="flex-start">
          <NumberInput label={t('leave.adjust_days')} description={t('leave.adjust_days_hint')} required decimalScale={2} allowNegative {...form.getInputProps('days')} />
          <TextInput type="date" label={t('leave.date')} description={t('common.optional')} {...form.getInputProps('entry_date')} />
        </Group>
        <Textarea label={t('leave.adjust_reason')} required autosize minRows={2} maxLength={2000} {...form.getInputProps('reason')} />
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
      </Stack></form>
    </Modal>
  );
}
