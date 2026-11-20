import { Button, Group, Modal, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Props { opened: boolean; onClose: () => void; tripId: string; travelers: { employee_id: string; name: string | null }[]; from: string; to: string; currency: string }

/** One expense line. Per diem is never typed here: it is generated from the rate table. A receipt is attached afterwards, and is required before the report. */
export function TripExpenseModal({ opened, onClose, tripId, travelers, from, to, currency }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cats = useLookup('trip_expense_category');
  const form = useForm({ initialValues: { employee_id: travelers[0]?.employee_id ?? '', category_id: '', expense_date: from, description: '', amount: '' as number | string } });
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.post(`/trips/${tripId}/expenses`, v),
    onSuccess: () => { toastOk(); form.setValues({ description: '', amount: '' }); onClose(); void qc.invalidateQueries({ queryKey: ['trip', tripId] }); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Modal opened={opened} onClose={onClose} title={t('trips.add_expense')} centered>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
        {travelers.length > 1 && <Select label={t('trips.traveler')} required data={travelers.map((x) => ({ value: x.employee_id, label: x.name ?? x.employee_id }))} {...form.getInputProps('employee_id')} />}
        <Select label={t('trips.category')} required data={cats.options.filter((o) => cats.items.find((c) => c.id === o.value)?.code !== 'per_diem')} {...form.getInputProps('category_id')} />
        <Group grow align="flex-start"><TextInput type="date" label={t('trips.expense_date')} required min={from} max={to} {...form.getInputProps('expense_date')} /><NumberInput label={`${t('trips.amount')} (${currency})`} required min={0.01} decimalScale={2} thousandSeparator=" " {...form.getInputProps('amount')} /></Group>
        <TextInput label={t('common.description')} required maxLength={255} {...form.getInputProps('description')} />
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
      </Stack></form>
    </Modal>
  );
}
