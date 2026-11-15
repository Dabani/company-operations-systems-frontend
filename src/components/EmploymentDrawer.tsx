import { Alert, Badge, Button, Card, Drawer, Group, NumberInput, Select, SimpleGrid, Stack, Tabs, Text, Textarea, TextInput, Timeline } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCircleCheck, IconClockHour4, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CurrencySelect } from '@/components/CurrencySelect';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

export interface HistoryRow {
  id: string; change_type: string; status: string; effective_from: string; valid_to: string | null; category: string | null; category_id: string;
  position: string | null; grade: string | null; department: string | null; contract_end_on: string | null; probation_end_on: string | null;
  reason: string | null; salary_amount?: string | null; salary_currency?: string | null; applied: boolean;
}
const STATUS_COLOR: Record<string, string> = { effective: 'green', pending_approval: 'orange', rejected: 'red', cancelled: 'gray' };
export const CHANGE_TYPES = ['promotion', 'confirmation', 'transfer', 'category_change', 'salary_change', 'manager_change'] as const;

/** Dated history, newest first. Shared by the employee drawer and the employee's own page. */
export function HistoryTimeline({ rows }: { rows: HistoryRow[] }) {
  const { t } = useTranslation();
  const cats = useLookup('employee_category');
  if (!rows.length) return <Text c="dimmed" size="sm">{t('hr.no_history')}</Text>;
  return (
    <Timeline active={rows.length} bulletSize={22} lineWidth={2}>
      {rows.map((r) => (
        <Timeline.Item key={r.id} bullet={r.status === 'effective' ? <IconCircleCheck size={14} /> : r.status === 'pending_approval' ? <IconClockHour4 size={14} /> : <IconX size={14} />}
          color={STATUS_COLOR[r.status] ?? 'gray'} title={<Group gap="xs"><Text size="sm" fw={600}>{t(`hr.type.${r.change_type}`)}</Text><Badge size="xs" variant="light" color={STATUS_COLOR[r.status]}>{t(`hr.status.${r.status}`)}</Badge></Group>}>
          <Text size="xs" c="dimmed">{r.effective_from}{r.status === 'effective' ? ` → ${r.valid_to ?? t('hr.present')}` : ''}{r.status === 'effective' && !r.applied ? ` · ${t('hr.scheduled')}` : ''}</Text>
          <Text size="sm" mt={4}>{[cats.byId(r.category_id)?.label, r.position, r.grade, r.department].filter(Boolean).join(' · ')}</Text>
          {(r.probation_end_on || r.contract_end_on) && <Text size="xs" c="dimmed">{r.probation_end_on ? `${t('hr.probation_end')}: ${r.probation_end_on} ` : ''}{r.contract_end_on ? `${t('hr.contract_end')}: ${r.contract_end_on}` : ''}</Text>}
          {r.salary_amount != null && <Text size="sm" fw={500}>{t('hr.salary')}: {Number(r.salary_amount).toLocaleString()} {r.salary_currency}</Text>}
          {r.reason && <Text size="xs" c="dimmed" mt={2} style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</Text>}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

interface Career { grade_id: string | null; months_in_grade: number | null; latest_rating_level: number | null; probation_end_on: string | null; contract_end_on: string | null;
  next_grades: { to_grade_id: string; to_grade: string; min_months_in_grade: number; min_rating_level: number | null; eligible: boolean; missing: string[] }[] }

function CareerPanel({ id }: { id: string }) {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['hr-career', id], queryFn: async () => (await api.get<{ data: Career }>(`/employees/${id}/career`)).data.data });
  const c = q.data;
  if (!c) return null;
  return (
    <Stack gap="sm">
      <SimpleGrid cols={2}>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('hr.months_in_grade')}</Text><Text fw={700} size="lg">{c.months_in_grade ?? '—'}</Text></Card>
        <Card withBorder padding="sm"><Text size="xs" c="dimmed">{t('hr.latest_rating')}</Text><Text fw={700} size="lg">{c.latest_rating_level ?? '—'}</Text></Card>
      </SimpleGrid>
      {c.probation_end_on && <Text size="sm">{t('hr.probation_end')}: <b>{c.probation_end_on}</b></Text>}
      {c.contract_end_on && <Text size="sm">{t('hr.contract_end')}: <b>{c.contract_end_on}</b></Text>}
      {!c.next_grades.length && <Text size="sm" c="dimmed">{t('hr.no_criteria')}</Text>}
      {c.next_grades.map((g) => (
        <Card key={g.to_grade_id} withBorder padding="sm">
          <Group justify="space-between"><Text size="sm" fw={600}>{g.to_grade}</Text><Badge color={g.eligible ? 'green' : 'orange'} variant="light">{g.eligible ? t('hr.eligible') : t('hr.not_yet')}</Badge></Group>
          <Text size="xs" c="dimmed">{t('hr.criteria_line', { months: g.min_months_in_grade, rating: g.min_rating_level ?? '—' })}</Text>
          {g.missing.length > 0 && <Text size="xs" c="orange">{t('hr.missing')}: {g.missing.map((m) => t(`hr.missing_${m}`)).join(', ')}</Text>}
        </Card>
      ))}
    </Stack>
  );
}

const blank = { change_type: 'transfer', effective_from: new Date().toISOString().slice(0, 10), category_id: '', position_id: '', grade_id: '', department_id: '', manager_employee_id: '',
  contract_type_id: '', contract_end_on: '', salary_amount: '' as number | string, salary_currency: '', reason: '' };

function ChangeForm({ employee, onDone }: { employee: { id: string }; onDone: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const form = useForm({ initialValues: blank });
  const cats = useLookup('employee_category');
  const contracts = useLookup('contract_type');
  const positions = useQuery({ queryKey: ['hr-positions'], queryFn: async () => (await api.get<{ data: { id: string; title: string }[] }>('/hr/positions')).data.data });
  const grades = useQuery({ queryKey: ['hr-grades'], queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/hr/grades')).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const type = form.values.change_type;
  const types = CHANGE_TYPES.filter((x) => x !== 'salary_change' || can('hr.salary.view'));

  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const keep: Record<string, string[]> = { promotion: ['position_id', 'grade_id'], confirmation: ['category_id'], transfer: ['department_id'], category_change: ['category_id', 'contract_type_id', 'contract_end_on'],
        salary_change: ['salary_amount', 'salary_currency'], manager_change: ['manager_employee_id'] };
      const body: Record<string, unknown> = { change_type: v.change_type, effective_from: v.effective_from, reason: v.reason || undefined };
      for (const k of keep[v.change_type]) { const x = (v as Record<string, unknown>)[k]; if (x !== '' && x != null) body[k] = x; }
      return (await api.post<{ data: { status: string } }>(`/employees/${employee.id}/employment-changes`, body)).data.data;
    },
    onSuccess: (r) => { toastOk(r.status === 'pending_approval' ? t('hr.sent_for_approval') : t('hr.change_recorded')); form.reset(); onDone(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const opt = (rows: { id: string; [k: string]: unknown }[] | undefined, key = 'name') => (rows ?? []).map((r) => ({ value: r.id, label: String(r[key]) }));

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
      <Stack gap="sm">
        <Alert variant="light" color="blue">{t('hr.change_intro')}</Alert>
        <Select label={t('hr.change_type')} required allowDeselect={false} data={types.map((x) => ({ value: x, label: t(`hr.type.${x}`) }))} {...form.getInputProps('change_type')} />
        <TextInput type="date" label={t('hr.effective_from')} required {...form.getInputProps('effective_from')} />
        {type === 'promotion' && <><Select label={t('hr.position')} clearable searchable data={opt(positions.data, 'title')} {...form.getInputProps('position_id')} /><Select label={t('hr.grade')} clearable data={opt(grades.data)} {...form.getInputProps('grade_id')} /></>}
        {(type === 'confirmation' || type === 'category_change') && <Select label={t('hr.new_category')} required data={cats.options} {...form.getInputProps('category_id')} />}
        {type === 'category_change' && <><Select label={t('hr.contract_type')} clearable data={contracts.options} {...form.getInputProps('contract_type_id')} /><TextInput type="date" label={t('hr.contract_end')} {...form.getInputProps('contract_end_on')} /></>}
        {type === 'transfer' && <Select label={t('employees.department')} required clearable data={opt(depts.data)} {...form.getInputProps('department_id')} />}
        {type === 'manager_change' && <Select label={t('employees.manager')} required searchable clearable data={(emps.data ?? []).filter((x) => x.id !== employee.id).map((x) => ({ value: x.id, label: x.full_name }))} {...form.getInputProps('manager_employee_id')} />}
        {type === 'salary_change' && <Group grow align="flex-start"><NumberInput label={t('hr.salary')} required min={0} thousandSeparator="," {...form.getInputProps('salary_amount')} /><CurrencySelect required label={t('hr.currency')} value={form.values.salary_currency} onChange={(v) => form.setFieldValue('salary_currency', v)} error={form.errors.salary_currency as string | undefined} /></Group>}
        <Textarea label={t('hr.reason')} autosize minRows={2} maxLength={2000} {...form.getInputProps('reason')} />
        <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('hr.record_change')}</Button></Group>
      </Stack>
    </form>
  );
}

export function EmploymentDrawer({ employee, onClose }: { employee: { id: string; full_name: string } | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const id = employee?.id ?? '';
  const history = useQuery({ queryKey: ['hr-history', id], enabled: !!id, queryFn: async () => (await api.get<{ data: HistoryRow[] }>(`/employees/${id}/history`)).data.data });
  const done = () => { void qc.invalidateQueries({ queryKey: ['hr-history', id] }); void qc.invalidateQueries({ queryKey: ['hr-career', id] }); void qc.invalidateQueries({ queryKey: ['employees'] }); void qc.invalidateQueries({ queryKey: ['hr-changes'] }); };
  return (
    <Drawer opened={!!employee} onClose={onClose} position="right" size="lg" title={employee ? `${t('hr.employment')} — ${employee.full_name}` : ''}>
      {employee && (
        <Tabs defaultValue="history">
          <Tabs.List mb="md">
            <Tabs.Tab value="history">{t('hr.history')}</Tabs.Tab>
            <Tabs.Tab value="career">{t('hr.career')}</Tabs.Tab>
            <Tabs.Tab value="onboarding">{t('rec.onboarding')}</Tabs.Tab>
            {can('hr.history.manage') && <Tabs.Tab value="change">{t('hr.record_change')}</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="history">{history.data ? <HistoryTimeline rows={history.data} /> : null}</Tabs.Panel>
          <Tabs.Panel value="career"><CareerPanel id={employee.id} /></Tabs.Panel>
          <Tabs.Panel value="onboarding"><OnboardingChecklist employeeId={employee.id} /></Tabs.Panel>
          {can('hr.history.manage') && <Tabs.Panel value="change"><ChangeForm employee={employee} onDone={done} /></Tabs.Panel>}
        </Tabs>
      )}
    </Drawer>
  );
}
