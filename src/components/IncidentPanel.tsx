import { Alert, Badge, Button, Card, Group, Select, Skeleton, Stack, Switch, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconShieldCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV } from '@/types';

interface Inc {
  case_id: string; severity: LV; detected_at: string | null; impact: string | null; immediate_action: string | null;
  containment_due_at: string | null; contained_at: string | null; rca_due_at: string | null; rca_completed_at: string | null; containment_overdue: boolean; rca_overdue: boolean;
  root_cause: string | null; preventive_action_plan: string | null; follow_up_required: boolean; personal_data_breach: boolean;
  regulator_notified_at: string | null; data_subjects_notified_at: string | null; affected_asset: { id: string; label: string } | null; can_manage: boolean;
}

/** Response-target tracker + root cause / preventive plan for cases of type "incident". */
export function IncidentPanel({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const severities = useLookup('incident_severity');
  const q = useQuery({ queryKey: ['incident', caseId], queryFn: async () => (await api.get<{ data: Inc }>(`/cases/${caseId}/incident`)).data.data });
  const i = q.data;

  const form = useForm({ initialValues: { severity_id: '', root_cause: '', preventive_action_plan: '', impact: '', immediate_action: '', follow_up_required: false, personal_data_breach: false, contained: false, rca_completed: false, regulator_notified: false, data_subjects_notified: false } });
  useEffect(() => {
    if (!i) return;
    form.setValues({ severity_id: i.severity.id, root_cause: i.root_cause ?? '', preventive_action_plan: i.preventive_action_plan ?? '', impact: i.impact ?? '', immediate_action: i.immediate_action ?? '',
      follow_up_required: i.follow_up_required, personal_data_breach: i.personal_data_breach, contained: !!i.contained_at, rca_completed: !!i.rca_completed_at,
      regulator_notified: !!i.regulator_notified_at, data_subjects_notified: !!i.data_subjects_notified_at });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.put(`/cases/${caseId}/incident`, v),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['incident', caseId] }); void qc.invalidateQueries({ queryKey: ['incidents'] }); void qc.invalidateQueries({ queryKey: ['case', caseId] }); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  if (q.isLoading || !i) return <Skeleton h={120} />;
  const lang = i18n.language;

  const Target = ({ label, due, done, overdue }: { label: string; due: string | null; done: string | null; overdue: boolean }) => (
    <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      {done ? <Badge color="green" variant="light" leftSection={<IconShieldCheck size={12} />}>{fmtDateTime(done, lang)}</Badge>
        : <Text size="sm" c={overdue ? 'red' : undefined} fw={overdue ? 700 : 400}>{due ? fmtDateTime(due, lang) : '—'} {overdue && <Badge size="xs" color="red">{t('incident.overdue')}</Badge>}</Text>}</div>
  );

  return (
    <Card padding="lg" style={{ borderColor: 'var(--mantine-color-red-4)' }}>
      <Group gap={6} mb="sm"><IconAlertTriangle size={18} color="var(--mantine-color-red-6)" /><Text fw={700}>{t('incident.details')}</Text><StatusBadge label={i.severity.label} color={i.severity.color} />
        {i.personal_data_breach && <Badge color="red">{t('incident.breach_flag')}</Badge>}</Group>

      <Group grow align="flex-start" mb="md">
        <Target label={`${t('incident.containment')} · ${t('incident.due')}`} due={i.containment_due_at} done={i.contained_at} overdue={i.containment_overdue} />
        <Target label={`${t('incident.rca')} · ${t('incident.due')}`} due={i.rca_due_at} done={i.rca_completed_at} overdue={i.rca_overdue} />
      </Group>
      {i.affected_asset && <Text size="sm" mb="sm"><b>{t('incident.asset')}:</b> {i.affected_asset.label}</Text>}

      {!i.can_manage ? (
        <Stack gap="sm">
          {i.impact && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('incident.impact')}</Text><SafeHtml html={i.impact} /></div>}
          {i.immediate_action && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('incident.immediate')}</Text><SafeHtml html={i.immediate_action} /></div>}
          {i.root_cause && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('incident.root_cause')}</Text><SafeHtml html={i.root_cause} /></div>}
          {i.preventive_action_plan && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('incident.plan')}</Text><SafeHtml html={i.preventive_action_plan} /></div>}
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Select label={t('incident.severity')} data={severities.options} allowDeselect={false} {...form.getInputProps('severity_id')} />
            <RichTextField label={t('incident.impact')} value={form.values.impact} onChange={(v) => form.setFieldValue('impact', v)} minHeight={70} />
            <RichTextField label={t('incident.immediate')} value={form.values.immediate_action} onChange={(v) => form.setFieldValue('immediate_action', v)} minHeight={70} />
            <Switch label={t('incident.mark_contained')} {...form.getInputProps('contained', { type: 'checkbox' })} />
            <RichTextField label={t('incident.root_cause')} value={form.values.root_cause} onChange={(v) => form.setFieldValue('root_cause', v)} minHeight={80} />
            <RichTextField label={t('incident.plan')} value={form.values.preventive_action_plan} onChange={(v) => form.setFieldValue('preventive_action_plan', v)} minHeight={80} error={form.errors.rca_completed as string} />
            <Switch label={t('incident.mark_rca')} {...form.getInputProps('rca_completed', { type: 'checkbox' })} />
            <Group>
              <Switch label={t('incident.followup')} {...form.getInputProps('follow_up_required', { type: 'checkbox' })} />
              <Switch label={t('incident.breach')} {...form.getInputProps('personal_data_breach', { type: 'checkbox' })} />
            </Group>
            {form.values.personal_data_breach && <Alert color="red" variant="light"><Group><Switch label={t('incident.regulator')} {...form.getInputProps('regulator_notified', { type: 'checkbox' })} /><Switch label={t('incident.subjects')} {...form.getInputProps('data_subjects_notified', { type: 'checkbox' })} /></Group></Alert>}
            <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      )}
    </Card>
  );
}
