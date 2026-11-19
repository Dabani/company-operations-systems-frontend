import { Alert, Badge, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import { RichTextField } from '@/components/RichTextField';
import { ConfirmButton } from '@/components/ConfirmButton';
import { SafeHtml } from '@/components/SafeHtml';

export interface Review {
  id: string; cycle: string | null; employee: string | null; reviewer: string | null; status: string; rating: string | null; rating_level: number | null; recommendation: string | null;
  summary: string | null; goals: string | null; employee_comment: string | null; submitted_at: string | null; acknowledged_at: string | null; can_edit: boolean; can_acknowledge: boolean;
}
export const REVIEW_COLOR: Record<string, string> = { draft: 'gray', submitted: 'orange', acknowledged: 'green' };

/** One review: the reviewer edits and submits it, the employee reads and acknowledges it, everyone else only reads. */
export function ReviewModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ratings = useLookup('performance_rating');
  const recs = useLookup('review_recommendation');
  const q = useQuery({ queryKey: ['hr-review', id], enabled: !!id, queryFn: async () => (await api.get<{ data: Review }>(`/reviews/${id}`)).data.data });
  const r = q.data;
  const form = useForm({ initialValues: { rating: '' as string | null, recommendation: '' as string | null, summary: '', goals: '', employee_comment: '' } });
  useEffect(() => { if (r) form.setValues({ rating: r.rating, recommendation: r.recommendation, summary: r.summary ?? '', goals: r.goals ?? '', employee_comment: r.employee_comment ?? '' }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [r?.id, r?.status]);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-review', id] }); void qc.invalidateQueries({ queryKey: ['hr-reviews'] }); void qc.invalidateQueries({ queryKey: ['hr-mine'] }); };

  const draft = () => api.patch(`/reviews/${id}`, { rating: form.values.rating || null, recommendation: form.values.recommendation || null, summary: form.values.summary, goals: form.values.goals });
  const save = useMutation({ mutationFn: draft, onSuccess: () => { toastOk(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const submit = useMutation({ mutationFn: async () => { await draft(); return api.post(`/reviews/${id}/submit`); }, onSuccess: () => { toastOk(t('hr.review_submitted')); refresh(); onClose(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const ack = useMutation({ mutationFn: async () => api.post(`/reviews/${id}/acknowledge`, { employee_comment: form.values.employee_comment }), onSuccess: () => { toastOk(t('hr.review_acknowledged')); refresh(); onClose(); }, onError: toastError });

  const label = (items: { code: string; label: string }[], code: string | null) => items.find((i) => i.code === code)?.label ?? '—';
  return (
    <Modal opened={!!id} onClose={onClose} size="lg" centered title={r ? `${r.cycle ?? ''} — ${r.employee ?? ''}` : t('common.loading')}>
      {r && (
        <Stack gap="sm">
          <Group justify="space-between"><Text size="sm" c="dimmed">{t('hr.reviewer')}: {r.reviewer ?? '—'}</Text><Badge color={REVIEW_COLOR[r.status]} variant="light">{t(`hr.review_status.${r.status}`)}</Badge></Group>
          {r.can_edit ? (
            <form onSubmit={form.onSubmit(() => save.mutate())}>
              <Stack gap="sm">
                <Group grow align="flex-start">
                  <Select label={t('hr.rating')} required clearable data={ratings.items.map((i) => ({ value: i.code, label: `${i.sort_order} — ${i.label}` }))} {...form.getInputProps('rating')} />
                  <Select label={t('hr.recommendation')} clearable data={recs.items.map((i) => ({ value: i.code, label: i.label }))} {...form.getInputProps('recommendation')} />
                </Group>
                <RichTextField label={t('hr.summary')} minHeight={100} {...form.getInputProps('summary')} />
                <RichTextField label={t('hr.goals')} minHeight={100} {...form.getInputProps('goals')} />
                <Alert variant="light" color="blue">{t('hr.review_submit_note')}</Alert>
                <Group justify="flex-end"><Button type="submit" variant="default" loading={save.isPending}>{t('hr.save_draft')}</Button><ConfirmButton loading={submit.isPending} title={t('hr.submit_review')} text={t('confirm.submit_review')} onConfirm={() => submit.mutate()}>{t('hr.submit_review')}</ConfirmButton></Group>
              </Stack>
            </form>
          ) : (
            <Stack gap="xs">
              <Text size="sm"><b>{t('hr.rating')}:</b> {r.rating ? `${r.rating_level} — ${label(ratings.items, r.rating)}` : '—'}</Text>
              <Text size="sm"><b>{t('hr.recommendation')}:</b> {label(recs.items, r.recommendation)}</Text>
              <Text size="sm" fw={600}>{t('hr.summary')}</Text>{r.summary ? <SafeHtml html={r.summary} /> : <Text size="sm">—</Text>}
              <Text size="sm" fw={600}>{t('hr.goals')}</Text>{r.goals ? <SafeHtml html={r.goals} /> : <Text size="sm">—</Text>}
              {r.employee_comment && <><Text size="sm" fw={600}>{t('hr.employee_comment')}</Text><SafeHtml html={r.employee_comment} /></>}
            </Stack>
          )}
          {r.can_acknowledge && (
            <Stack gap="sm">
              <RichTextField label={t('hr.employee_comment')} minHeight={80} {...form.getInputProps('employee_comment')} />
              <Group justify="flex-end"><Button loading={ack.isPending} onClick={() => ack.mutate()}>{t('hr.acknowledge')}</Button></Group>
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
