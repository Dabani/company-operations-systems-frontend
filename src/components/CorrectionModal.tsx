import { Alert, Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { toApiDateTime, toInputValue } from '@/lib/attendance';
import { toastError, toastOk } from '@/lib/ui';

export interface CorrectionTarget { employeeId?: string; employeeName?: string; date: string; firstIn?: string | null; lastOut?: string | null; timezone: string }

/** Ask for a whole day to be corrected: the real times, in local time, with a reason. A manager approves it; nothing changes before that. */
export function CorrectionModal({ target, onClose }: { target: CorrectionTarget | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const form = useForm({ initialValues: { in_at: '', out_at: '', reason: '' } });
  useEffect(() => {
    if (target) form.setValues({ in_at: toInputValue(target.firstIn, target.timezone, `${target.date}T08:00`), out_at: toInputValue(target.lastOut, target.timezone, `${target.date}T17:00`), reason: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.date, target?.employeeId]);
  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/attendance/corrections', { employee_id: target?.employeeId, work_date: target!.date, in_at: toApiDateTime(v.in_at), out_at: toApiDateTime(v.out_at), reason: v.reason }),
    onSuccess: () => { toastOk(t('att.correction_sent')); void qc.invalidateQueries({ queryKey: ['att-corrections'] }); void qc.invalidateQueries({ queryKey: ['att-my-days'] }); void qc.invalidateQueries({ queryKey: ['att-team-days'] }); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Modal opened={!!target} onClose={onClose} centered title={target ? `${t('att.request_correction')} — ${target.employeeName ? `${target.employeeName}, ` : ''}${target.date}` : ''}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
        <Alert variant="light" color="blue">{t('att.correction_intro')}</Alert>
        <Group grow align="flex-start">
          <TextInput type="datetime-local" label={t('att.real_in')} required {...form.getInputProps('in_at')} />
          <TextInput type="datetime-local" label={t('att.real_out')} required {...form.getInputProps('out_at')} />
        </Group>
        <Textarea label={t('att.reason')} required minLength={3} maxLength={2000} autosize minRows={2} {...form.getInputProps('reason')} />
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('att.send_correction')}</Button></Group>
      </Stack></form>
    </Modal>
  );
}
