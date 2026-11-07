import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import { STATUS_COLOR, money, type InvoiceRow } from '@/pages/InvoicesPage';

interface Cfg { billing_model_id: string | null; billing_model: string | null; currency_code: string | null; budget_amount: string | null; rate_card_id: string | null; client_id: string | null;
  milestones: { id: string; name: string; completed: boolean; billing_amount: string | null }[] }

/** Delivered / Closed gates, billing set-up and invoices of one project (shown on the project page). */
export function ProjectBillingPanel({ projectId, isManager, projectStatus }: { projectId: string; isManager: boolean; projectStatus: string }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const models = useLookup('billing_model');
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState<{ model: string | null; currency: string; budget: number | string } | null>(null);

  const cfg = useQuery({ queryKey: ['project-billing', projectId], queryFn: async () => (await api.get<{ data: Cfg }>(`/projects/${projectId}/billing`)).data.data });
  const invoices = useQuery({ queryKey: ['invoices', 'project', projectId], enabled: can('billing.view'), queryFn: async () => (await api.get<{ data: InvoiceRow[] }>('/invoices', { params: { 'filter[project_id]': projectId, per_page: 50 } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['project'] }); void qc.invalidateQueries({ queryKey: ['project-billing', projectId] }); void qc.invalidateQueries({ queryKey: ['invoices'] }); };

  const deliver = useMutation({ mutationFn: async () => (await api.post<{ data: { invoice_id: string | null; invoice_error: string | null } }>(`/projects/${projectId}/deliver`)).data.data,
    onSuccess: (r) => { toastOk(); setNote(r.invoice_error ?? (r.invoice_id ? t('billing.draft_created') : null)); refresh(); }, onError: toastError });
  const close = useMutation({ mutationFn: async () => api.post(`/projects/${projectId}/close`, { exception_reason: closing || undefined }), onSuccess: () => { toastOk(); setClosing(null); refresh(); }, onError: toastError });
  const save = useMutation({ mutationFn: async () => api.put(`/projects/${projectId}/billing`, { billing_model_id: form!.model, currency_code: form!.currency || undefined, budget_amount: form!.budget === '' ? undefined : form!.budget }),
    onSuccess: () => { toastOk(); setForm(null); refresh(); }, onError: toastError });
  const generate = useMutation({ mutationFn: async () => api.post(`/projects/${projectId}/invoices/generate`), onSuccess: () => { toastOk(t('billing.draft_created')); refresh(); }, onError: toastError });
  const msAmount = useMutation({ mutationFn: async (v: { id: string; amount: string }) => api.patch(`/projects/${projectId}/milestones/${v.id}/billing`, { billing_amount: v.amount === '' ? null : v.amount }), onSuccess: refresh, onError: toastError });

  const final = ['delivered', 'closed', 'cancelled'].includes(projectStatus);
  const c = cfg.data;
  return (
    <Stack gap="md">
      <Group gap="xs"><Text fw={600}>{t('billing.project_status')}:</Text><Badge variant="light">{t(`projects.ps.${projectStatus}`, { defaultValue: projectStatus })}</Badge>
        {isManager && !final && <Button size="xs" onClick={() => deliver.mutate()} loading={deliver.isPending}>{t('billing.deliver')}</Button>}
        {isManager && projectStatus !== 'closed' && <Button size="xs" variant="default" onClick={() => setClosing('')}>{t('billing.close_project')}</Button>}</Group>
      {note && <Alert color="blue" variant="light" withCloseButton onClose={() => setNote(null)}>{note}</Alert>}

      {can('billing.configure') && c && <Stack gap={4}><Group justify="space-between"><Text fw={600}>{t('billing.setup')}</Text><Button size="xs" variant="light" onClick={() => setForm({ model: c.billing_model_id, currency: c.currency_code ?? '', budget: c.budget_amount ? Number(c.budget_amount) : '' })}>{t('common.edit')}</Button></Group>
        <Text size="sm">{models.items.find((m) => m.id === c.billing_model_id)?.label ?? t('billing.not_set')} · {c.currency_code ?? '—'} {c.budget_amount ? `· ${money(c.budget_amount)}` : ''}</Text>
        {c.billing_model === 'milestone' && c.milestones.map((m) => (
          <Group key={m.id} justify="space-between"><Text size="sm">{m.name} {m.completed && <Badge size="xs" color="green" variant="light">{t('projects.complete')}</Badge>}</Text>
            <NumberInput size="xs" w={160} placeholder={t('billing.amount')} thousandSeparator decimalScale={2} defaultValue={m.billing_amount ? Number(m.billing_amount) : ''} onBlur={(e) => msAmount.mutate({ id: m.id, amount: e.currentTarget.value.replace(/,/g, '') })} /></Group>))}</Stack>}

      {can('billing.view') && <Stack gap={4}><Group justify="space-between"><Text fw={600}>{t('billing.title')}</Text>
        {can('billing.manage') && <Button size="xs" loading={generate.isPending} onClick={() => generate.mutate()}>{t('billing.generate')}</Button>}</Group>
        {invoices.data?.length === 0 && <Text size="sm" c="dimmed">—</Text>}
        {invoices.data?.map((i) => <Group key={i.id} justify="space-between"><Text component={Link} to={`/invoices/${i.id}`} size="sm">{i.number ?? t('billing.draft_label')}</Text>
          <Group gap="xs"><Badge size="sm" color={STATUS_COLOR[i.status]} variant="light">{t(`billing.s.${i.status}`)}</Badge><Text size="sm">{money(i.total, i.currency_code)}</Text></Group></Group>)}</Stack>}

      <Modal opened={closing !== null} onClose={() => setClosing(null)} title={t('billing.close_project')} centered>
        <Stack><Text size="sm">{t('billing.close_help')}</Text>
          {can('billing.close_exception') && <Textarea label={t('billing.exception_reason')} description={t('billing.exception_note')} autosize minRows={2} value={closing ?? ''} onChange={(e) => setClosing(e.currentTarget.value)} />}
          <Group justify="flex-end"><Button color="red" loading={close.isPending} onClick={() => close.mutate()}>{t('billing.close_project')}</Button></Group></Stack>
      </Modal>
      <Modal opened={!!form} onClose={() => setForm(null)} title={t('billing.setup')} centered>
        {form && <Stack><Select label={t('billing.model')} data={models.options} value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
          <Group grow><TextInput label={t('projects.currency')} maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.currentTarget.value.toUpperCase() })} />
            <NumberInput label={t('billing.fixed_amount')} thousandSeparator decimalScale={2} min={0} value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} /></Group>
          <Text size="xs" c="dimmed">{t('billing.setup_note')}</Text>
          <Group justify="flex-end"><Button disabled={!form.model} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
    </Stack>
  );
}
