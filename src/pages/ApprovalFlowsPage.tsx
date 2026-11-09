import { ActionIcon, Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';

interface Step { step_order: number; label: string; step_type: string; step_type_id?: string; role_id?: string | null; role: string | null; escalate_after_hours: number | null }
interface Flow { id: string; code: string; name: string; version: number; is_active: boolean; created_by: string; effective_from: string; subject_type: string | null; subject_type_id?: string | null; steps: Step[] }
interface StepForm { label: string; step_type_id: string; role_id: string | null; escalate_after_hours: number | string }

export function ApprovalFlowsPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<Flow | null>(null);
  const types = useLookup('approval_step_type');
  const subjects = useLookup('approval_subject_type');
  const roles = useQuery({ queryKey: ['roles-options'], queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/roles', { params: { per_page: 100 } })).data.data });
  const flows = useQuery({ queryKey: ['flows'], queryFn: async () => (await api.get<{ data: Flow[] }>('/approval-flows')).data.data });
  const form = useForm({ initialValues: { code: '', name: '', subject_type_id: null as string | null, effective_from: new Date().toISOString().slice(0, 10), steps: [{ label: '', step_type_id: '', role_id: null, escalate_after_hours: 48 }] as StepForm[] } });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['flows'] });
  const today = () => new Date().toISOString().slice(0, 10);
  const openNew = () => { setBase(null); form.setValues({ code: '', name: '', subject_type_id: null, effective_from: today(), steps: [{ label: '', step_type_id: '', role_id: null, escalate_after_hours: 48 }] }); setOpen(true); };
  const openVersion = (f: Flow) => {
    setBase(f);
    form.setValues({ code: '', name: f.name, subject_type_id: f.subject_type_id ?? null, effective_from: today(),
      steps: f.steps.map((s) => ({ label: s.label, step_type_id: s.step_type_id ?? '', role_id: s.role_id ?? null, escalate_after_hours: s.escalate_after_hours ?? '' })) });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/approval-flows', { ...v, new_version_of: base?.id, steps: v.steps.map((s) => ({ ...s, escalate_after_hours: s.escalate_after_hours === '' ? null : s.escalate_after_hours })) }),
    onSuccess: () => { toastOk(); setOpen(false); refresh(); }, onError: toastError,
  });
  const activate = useMutation({ mutationFn: async (id: string) => api.post(`/approval-flows/${id}/activate`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('flows.title')} description={t('flows.intro')} actions={<Button leftSection={<IconPlus size={16} />} onClick={openNew}>{t('flows.new')}</Button>} />
      <Stack>
        {flows.data?.map((f) => (
          <Card key={f.id} withBorder>
            <Group justify="space-between" mb="xs" wrap="wrap">
              <Group gap="xs"><Text fw={600}>{f.name}</Text><Badge variant="outline">{f.code} v{f.version}</Badge>
                <Badge color={f.is_active ? 'green' : 'gray'} variant="light">{f.is_active ? t('common.active') : t('flows.pending_activation')}</Badge></Group>
              <Group gap="xs"><Button size="xs" variant="subtle" onClick={() => openVersion(f)}>{t('flows.new_version')}</Button>{!f.is_active && f.created_by !== me?.id && <Button size="xs" onClick={() => activate.mutate(f.id)}>{t('flows.activate')}</Button>}</Group>
              {!f.is_active && f.created_by === me?.id && <Text size="xs" c="dimmed">{t('flows.needs_other_person')}</Text>}
            </Group>
            {f.steps.map((s) => <Text key={s.step_order} size="sm">{s.step_order}. {s.label} — {t(`flows.type.${s.step_type}`, { defaultValue: s.step_type })}{s.role ? ` (${s.role})` : ''}{s.escalate_after_hours ? ` · ${s.escalate_after_hours}h` : ''}</Text>)}
          </Card>
        ))}
      </Stack>

      <Modal opened={open} onClose={() => setOpen(false)} title={base ? `${t('flows.new_version')} — ${base.code}` : t('flows.new')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Group grow><TextInput label={t('common.name')} required {...form.getInputProps('name')} /></Group>
          <Group grow><Select label={t('flows.subject')} clearable data={subjects.options} {...form.getInputProps('subject_type_id')} /><TextInput type="date" label={t('rules.effective_from')} required {...form.getInputProps('effective_from')} /></Group>
          <Text fw={600} size="sm">{t('flows.steps')}</Text>
          {form.values.steps.map((_, i) => (
            <Group key={i} align="flex-end" wrap="nowrap">
              <TextInput placeholder={t('flows.step_label')} required style={{ flex: 2 }} {...form.getInputProps(`steps.${i}.label`)} />
              <Select data={types.options} required style={{ flex: 2 }} {...form.getInputProps(`steps.${i}.step_type_id`)} />
              <Select data={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))} clearable placeholder={t('flows.role')} style={{ flex: 2 }} {...form.getInputProps(`steps.${i}.role_id`)} />
              <NumberInput min={1} placeholder="h" style={{ flex: 1 }} {...form.getInputProps(`steps.${i}.escalate_after_hours`)} />
              <ActionIcon color="red" variant="subtle" disabled={form.values.steps.length === 1} onClick={() => form.removeListItem('steps', i)}><IconTrash size={16} /></ActionIcon>
            </Group>))}
          <Button variant="light" size="xs" onClick={() => form.insertListItem('steps', { label: '', step_type_id: '', role_id: null, escalate_after_hours: 48 })}>{t('flows.add_step')}</Button>
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
