import { Alert, Anchor, Badge, Button, Group, Modal, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface Row {
  id: string; reference: string; title: string; status: LV; severity: LV | null; requester: { name: string } | null; detected_at: string | null;
  containment_due_at: string | null; contained_at: string | null; rca_due_at: string | null; rca_completed_at: string | null;
  containment_overdue: boolean; rca_overdue: boolean; personal_data_breach: boolean;
}

function Due({ due, done, overdue, lang }: { due: string | null; done: string | null; overdue: boolean; lang: string }) {
  if (done) return <Badge color="green" variant="light">{fmtDateTime(done, lang)}</Badge>;
  if (!due) return <>—</>;
  return <Text size="xs" c={overdue ? 'red' : 'dimmed'} fw={overdue ? 700 : 400}>{fmtDateTime(due, lang)}</Text>;
}

export function IncidentsPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const severities = useLookup('incident_severity'); const statuses = useLookup('case_status');
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const assets = useQuery({ queryKey: ['asset-options'], enabled: reporting && can('asset.view'), queryFn: async () => (await api.get<Paginated<{ id: string; asset_tag: string; name: string }>>('/assets', { params: { per_page: 100, sort: 'asset_tag' } })).data.data });

  const form = useForm({
    initialValues: { title: '', severity_id: null as string | null, detected_at: '', description: '', impact: '', immediate_action: '', personal_data_breach: false, department_id: null as string | null, affected_asset_id: null as string | null },
    validate: { title: (v) => (v.trim() ? null : t('case.subject')), description: (v) => (v ? null : t('incident.what')) },
  });

  const report = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post<{ data: { id: string; reference: string } }>('/incidents', { ...v, detected_at: v.detected_at || null })).data.data,
    onSuccess: (r) => { toastOk(t('case.submitted', { ref: r.reference })); setReporting(false); form.reset(); void qc.invalidateQueries({ queryKey: ['incidents'] }); nav(`/cases/${r.id}`); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const columns: Column<Row>[] = [
    { key: 'reference', label: t('case.reference'), sortable: true, render: (r) => <Anchor size="sm" fw={600} ff="monospace" onClick={() => nav(`/cases/${r.id}`)}>{r.reference}</Anchor> },
    { key: 'title', label: t('case.subject'), sortable: true, render: (r) => <div><Group gap={6} wrap="nowrap"><Text size="sm" fw={600} lineClamp={1}>{r.title}</Text>{r.personal_data_breach && <Badge size="xs" color="red">{t('incident.breach_flag')}</Badge>}</Group><Text size="xs" c="dimmed">{r.requester?.name}</Text></div> },
    { key: 'severity', label: t('incident.severity'), render: (r) => r.severity ? <StatusBadge label={r.severity.label} color={r.severity.color} /> : '—' },
    { key: 'status', label: t('common.status'), render: (r) => <StatusBadge label={r.status.label} color={r.status.color} /> },
    { key: 'containment', label: t('incident.containment'), visibleFrom: 'md', render: (r) => <Due due={r.containment_due_at} done={r.contained_at} overdue={r.containment_overdue} lang={i18n.language} /> },
    { key: 'rca', label: t('incident.rca'), visibleFrom: 'lg', render: (r) => <Due due={r.rca_due_at} done={r.rca_completed_at} overdue={r.rca_overdue} lang={i18n.language} /> },
  ];

  return (
    <>
      <PageHeader title={t('incident.title')} />
      <DataList<Row> title={t('incident.title')} endpoint="/incidents" queryKey="incidents" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        extraParams={onlyOverdue ? { overdue: 1 } : undefined} onRowClick={(r) => nav(`/cases/${r.id}`)}
        filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]}
        toolbar={<>
          {can('incident.manage') && <Switch label={t('incident.only_overdue')} checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.currentTarget.checked)} />}
          {can('case.create') && <Button color="red" leftSection={<IconPlus size={16} />} onClick={() => setReporting(true)}>{t('incident.report')}</Button>}
        </>} />

      <Modal opened={reporting} onClose={() => setReporting(false)} title={<Group gap={6}><IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />{t('incident.report')}</Group>} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => report.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('case.subject')} required maxLength={200} {...form.getInputProps('title')} />
            <Group grow align="flex-start"><Select label={t('incident.severity')} data={severities.options} clearable {...form.getInputProps('severity_id')} /><TextInput type="datetime-local" label={t('incident.detected')} {...form.getInputProps('detected_at')} /></Group>
            <RichTextField label={t('incident.what')} required value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} error={form.errors.description as string} minHeight={110} />
            <RichTextField label={t('incident.impact')} value={form.values.impact} onChange={(v) => form.setFieldValue('impact', v)} minHeight={70} />
            <RichTextField label={t('incident.immediate')} value={form.values.immediate_action} onChange={(v) => form.setFieldValue('immediate_action', v)} minHeight={70} />
            <Group grow align="flex-start">
              {can('department.view') && <Select label={t('case.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />}
              {can('asset.view') && <Select label={t('incident.asset')} clearable searchable data={(assets.data ?? []).map((a) => ({ value: a.id, label: `${a.asset_tag} — ${a.name}` }))} {...form.getInputProps('affected_asset_id')} />}
            </Group>
            <Switch label={t('incident.breach')} {...form.getInputProps('personal_data_breach', { type: 'checkbox' })} />
            {form.values.personal_data_breach && <Alert color="red" variant="light">{t('incident.regulator')} / {t('incident.subjects')}</Alert>}
            <Group justify="flex-end"><Button variant="default" onClick={() => setReporting(false)}>{t('common.cancel')}</Button><Button type="submit" color="red" loading={report.isPending}>{t('incident.report')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
