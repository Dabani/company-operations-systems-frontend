import { Alert, Badge, Button, Drawer, Group, Modal, Paper, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconSend } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

type AuditForm = { title: string; period_label: string; description: string; lead_auditor_id: string | null };
type FindingForm = { title: string; description: string; severity_id: string | null; owner_id: string | null; due_on: string; status_id: string | null; resolution_note: string };
interface Finding { id: string; title: string; description: string | null; severity: LV; status: LV; owner: { id: string; name: string } | null; due_on: string | null; closed_on: string | null; resolution_note: string | null; overdue: boolean }
interface Audit { id: string; reference: string; title: string; period_label: string | null; status: LV; lead: { id: string; name: string }; started_on: string | null; completed_on: string | null; reported_at: string | null; findings_total: number; findings_open: number; scope?: string | null; summary?: string | null; findings?: Finding[] }

export function AuditsPage() {
  const { t, i18n } = useTranslation();
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const manage = can('compliance.manage');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Audit | 'new' | null>(null);
  const [finding, setFinding] = useState<Finding | 'new' | null>(null);
  const [completing, setCompleting] = useState(false);
  const [summary, setSummary] = useState('');
  const severities = useLookup('incident_severity'); const fstatus = useLookup('finding_status');

  useEffect(() => { const id = params.get('open'); if (id) { setOpen(id); params.delete('open'); setParams(params, { replace: true }); } }, [params, setParams]);

  const list = useQuery({ queryKey: ['audits'], queryFn: async () => (await api.get<{ data: Audit[] }>('/audits')).data.data });
  const detail = useQuery({ queryKey: ['audit', open], enabled: !!open, queryFn: async () => (await api.get<{ data: Audit }>(`/audits/${open}`)).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });
  const a = detail.data;
  const userOptions = (users.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const refresh = () => { ['audits', 'audit', 'obligations', 'management-reports'].forEach((k) => void qc.invalidateQueries({ queryKey: [k] })); };

  const aForm = useForm<AuditForm>({ initialValues: { title: '', period_label: '', description: '', lead_auditor_id: null }, validate: { title: (v) => (v.trim() ? null : t('case.subject')), lead_auditor_id: (v) => (v ? null : t('aud.lead')) } });
  const fForm = useForm<FindingForm>({ initialValues: { title: '', description: '', severity_id: null, owner_id: null, due_on: '', status_id: null, resolution_note: '' } });

  const openAudit = (x: Audit | 'new') => {
    setEditing(x);
    const v: AuditForm = x === 'new'
      ? { title: '', period_label: '', description: '', lead_auditor_id: me?.id ?? null }
      : { title: x.title, period_label: x.period_label ?? '', description: x.scope ?? '', lead_auditor_id: x.lead.id };
    aForm.setValues(v);
  };
  const openFinding = (x: Finding | 'new') => {
    setFinding(x);
    const v: FindingForm = x === 'new'
      ? { title: '', description: '', severity_id: null, owner_id: null, due_on: '', status_id: null, resolution_note: '' }
      : { title: x.title, description: x.description ?? '', severity_id: x.severity.id, owner_id: x.owner?.id ?? null, due_on: x.due_on ?? '', status_id: x.status.id, resolution_note: x.resolution_note ?? '' };
    fForm.setValues(v);
  };

  const saveAudit = useMutation({
    mutationFn: async (v: typeof aForm.values) => editing === 'new' ? (await api.post<{ data: Audit }>('/audits', v)).data.data : (await api.patch<{ data: Audit }>(`/audits/${(editing as Audit).id}`, v)).data.data,
    onSuccess: (r) => { toastOk(); setEditing(null); refresh(); setOpen(r.id); }, onError: (e) => { aForm.setErrors(parseError(e).fields); toastError(e); },
  });
  const act = useMutation({
    mutationFn: async (a2: { path: string; body?: Record<string, unknown> }) => api.post(`/audits/${open}/${a2.path}`, a2.body ?? {}),
    onSuccess: () => { toastOk(); setCompleting(false); refresh(); }, onError: toastError,
  });
  const saveFinding = useMutation({
    mutationFn: async (v: typeof fForm.values) => finding === 'new' ? api.post(`/audits/${open}/findings`, { ...v, due_on: v.due_on || null }) : api.patch(`/audit-findings/${(finding as Finding).id}`, manage ? { ...v, due_on: v.due_on || null } : { status_id: v.status_id, resolution_note: v.resolution_note }),
    onSuccess: () => { toastOk(); setFinding(null); refresh(); }, onError: (e) => { fForm.setErrors(parseError(e).fields); toastError(e); },
  });

  return (
    <>
      <PageHeader title={t('aud.title')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => openAudit('new')}>{t('aud.new')}</Button> : undefined} />
      <Paper withBorder>
        <Table.ScrollContainer minWidth={620}>
          <Table highlightOnHover striped="odd" verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>{t('case.reference')}</Table.Th><Table.Th>{t('case.subject')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('aud.lead')}</Table.Th><Table.Th>{t('aud.findings')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{(list.data ?? []).map((x) => (
              <Table.Tr key={x.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(x.id)}>
                <Table.Td ff="monospace">{x.reference}</Table.Td><Table.Td><Text size="sm" fw={600}>{x.title}</Text><Text size="xs" c="dimmed">{x.period_label}</Text></Table.Td>
                <Table.Td><StatusBadge label={x.status.label} color={x.status.color} /></Table.Td><Table.Td>{x.lead.name}</Table.Td>
                <Table.Td>{x.findings_open > 0 ? <Badge color="orange" variant="light">{x.findings_open} / {x.findings_total}</Badge> : x.findings_total}</Table.Td>
              </Table.Tr>))}</Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {(list.data ?? []).length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">{t('common.no_data')}</Text>}
      </Paper>

      <Drawer opened={!!open} onClose={() => setOpen(null)} position="right" size="xl" title={a ? <Group gap="xs"><Badge variant="outline" ff="monospace">{a.reference}</Badge><StatusBadge label={a.status.label} color={a.status.color} /></Group> : ''}>
        {a && (
          <Stack gap="md">
            <Text fz="lg" fw={700}>{a.title}</Text>
            <Text size="sm" c="dimmed">{a.period_label ?? ''} · {t('aud.lead')}: {a.lead.name}{a.reported_at ? ` · ${t('aud.reported_at')} ${fmtDateTime(a.reported_at, i18n.language)}` : ''}</Text>
            {a.scope && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('aud.scope')}</Text><SafeHtml html={a.scope} /></div>}
            {a.summary && <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('aud.summary')}</Text><SafeHtml html={a.summary} /></div>}
            {manage && a.status.code !== 'reported' && (
              <Group>
                {a.status.code === 'planned' && <Button onClick={() => act.mutate({ path: 'start' })}>{t('aud.start')}</Button>}
                {a.status.code === 'in_progress' && <Button onClick={() => { setSummary(a.summary ?? ''); setCompleting(true); }}>{t('aud.complete')}</Button>}
                {a.status.code === 'completed' && <Button leftSection={<IconSend size={16} />} loading={act.isPending} onClick={() => act.mutate({ path: 'report' })}>{t('aud.report')}</Button>}
                <Button variant="default" onClick={() => openAudit(a)}>{t('common.edit')}</Button>
              </Group>)}

            <Group justify="space-between"><Text fw={700}>{t('aud.findings')} ({a.findings?.length ?? 0})</Text>{manage && a.status.code !== 'reported' && <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => openFinding('new')}>{t('aud.add_finding')}</Button>}</Group>
            <Stack gap="xs">{(a.findings ?? []).map((f) => (
              <Paper key={f.id} withBorder p="sm" style={{ cursor: manage || f.owner?.id === me?.id ? 'pointer' : 'default' }} onClick={() => (manage || f.owner?.id === me?.id) && openFinding(f)}>
                <Group justify="space-between" wrap="nowrap" align="flex-start"><div style={{ minWidth: 0 }}><Group gap={6}><StatusBadge label={f.severity.label} color={f.severity.color} /><Text size="sm" fw={600}>{f.title}</Text></Group>
                  <Text size="xs" c="dimmed">{f.owner?.name ?? '—'}{f.due_on ? ` · ${t('aud.due')} ${f.due_on}` : ''}</Text></div>
                  <Group gap={4}>{f.overdue && <Badge color="red" size="sm">{t('rec.overdue')}</Badge>}<StatusBadge label={f.status.label} color={f.status.color} /></Group></Group>
                {f.resolution_note && <Text size="xs" mt={4}>{f.resolution_note}</Text>}
              </Paper>))}</Stack>
          </Stack>
        )}
      </Drawer>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('aud.new') : t('aud.edit')} size="lg" centered>
        <form onSubmit={aForm.onSubmit((v) => saveAudit.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('case.subject')} required {...aForm.getInputProps('title')} />
            <Group grow align="flex-start"><TextInput label={t('aud.period')} placeholder="2026 H1" {...aForm.getInputProps('period_label')} /><Select label={t('aud.lead')} required searchable data={userOptions} {...aForm.getInputProps('lead_auditor_id')} /></Group>
            <RichTextField label={t('aud.scope')} value={aForm.values.description} onChange={(v) => aForm.setFieldValue('description', v)} minHeight={80} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={saveAudit.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={completing} onClose={() => setCompleting(false)} title={t('aud.complete')} size="lg" centered>
        <Stack><Alert variant="light" color="blue">{t('aud.summary')}</Alert>
          <RichTextField value={summary} onChange={setSummary} minHeight={140} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCompleting(false)}>{t('common.cancel')}</Button><Button disabled={!summary} loading={act.isPending} onClick={() => act.mutate({ path: 'complete', body: { summary } })}>{t('aud.complete')}</Button></Group></Stack>
      </Modal>

      <Modal opened={!!finding} onClose={() => setFinding(null)} title={finding === 'new' ? t('aud.add_finding') : t('aud.findings')} size="lg" centered>
        <form onSubmit={fForm.onSubmit((v) => saveFinding.mutate(v))}>
          <Stack gap="sm">
            {manage && <><TextInput label={t('case.subject')} required {...fForm.getInputProps('title')} />
              <Group grow align="flex-start"><Select label={t('aud.severity')} required data={severities.options} {...fForm.getInputProps('severity_id')} /><TextInput type="date" label={t('aud.due')} {...fForm.getInputProps('due_on')} /></Group>
              <Select label={t('aud.owner')} clearable searchable data={userOptions} {...fForm.getInputProps('owner_id')} />
              <RichTextField label={t('common.description')} value={fForm.values.description} onChange={(v) => fForm.setFieldValue('description', v)} minHeight={80} /></>}
            {finding !== 'new' && <><Select label={t('common.status')} data={fstatus.options} allowDeselect={false} {...fForm.getInputProps('status_id')} /><TextInput label={t('aud.resolution')} maxLength={1000} {...fForm.getInputProps('resolution_note')} /></>}
            <Group justify="flex-end"><Button variant="default" onClick={() => setFinding(null)}>{t('common.cancel')}</Button><Button type="submit" loading={saveFinding.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
