import { Alert, Badge, Button, Card, Drawer, Group, Modal, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Tabs, Text, TextInput, Textarea, Timeline } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDownload, IconUserCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CurrencySelect } from '@/components/CurrencySelect';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

export const STAGE_COLOR: Record<string, string> = { applied: 'gray', screened: 'blue', interview: 'blue', assessment: 'violet', offer: 'orange', hired: 'green', rejected: 'red' };
export const OFFER_COLOR: Record<string, string> = { draft: 'gray', issued: 'blue', accepted: 'green', declined: 'red', withdrawn: 'gray' };
const MANUAL = ['applied', 'screened', 'interview', 'assessment'];

interface Detail {
  id: string; code: string; name: string; first_name: string; last_name: string; email: string; phone: string | null; source: string | null; notes: string | null; stage: string; vacancy: string | null;
  applied_on: string; retention_until: string | null; anonymized: boolean; consent_recorded_at: string | null; rejection_reason: string | null; can_convert: boolean; converted_employee_id: string | null;
  history: { stage: string; note: string | null; at: string }[];
  interviews: { id: string; type: string; status: string; scheduled_at: string; panel: string[]; scorecards: number }[];
  references: { id: string; referee_name: string; referee_contact: string | null; relationship: string | null; result: string; notes: string | null; checked_on: string | null }[];
  offers: { id: string; code: string; status: string; position: string | null; start_date: string; valid_until: string | null; salary_amount?: string; salary_currency?: string; salary_period?: string }[];
}
type Opt = { value: string; label: string };

export function ApplicantDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [anon, setAnon] = useState(false);
  const [answer, setAnswer] = useState<{ id: string; decision: 'accepted' | 'declined' } | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['hr-applicant', id], enabled: !!id, queryFn: async () => (await api.get<{ data: Detail }>(`/applicants/${id}`)).data.data });
  const a = q.data;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-applicant', id] }); void qc.invalidateQueries({ queryKey: ['hr-applicants'] }); void qc.invalidateQueries({ queryKey: ['hr-vacancies'] }); void qc.invalidateQueries({ queryKey: ['hr-offers'] }); void qc.invalidateQueries({ queryKey: ['hr-interviews'] }); };
  const useAct = <T,>(fn: (v: T) => Promise<unknown>, ok?: string, after?: () => void) => useMutation({ mutationFn: fn, onSuccess: () => { toastOk(ok); refresh(); after?.(); }, onError: toastError });

  const move = useAct(async () => api.post(`/applicants/${id}/stage`, { stage }), undefined, () => setStage(null));
  const select = useAct(async () => api.post(`/applicants/${id}/selection`), t('rec.selection_sent'));
  const anonymize = useAct(async () => api.post(`/applicants/${id}/anonymize`), t('rec.anonymised'), () => setAnon(false));
  const rejectForm = useForm({ initialValues: { reason: '' } });
  const reject = useMutation({ mutationFn: async (v: { reason: string }) => api.post(`/applicants/${id}/reject`, v), onSuccess: () => { toastOk(); setRejectOpen(false); rejectForm.reset(); refresh(); }, onError: (e) => { rejectForm.setErrors(parseError(e).fields); toastError(e); } });
  const extForm = useForm({ initialValues: { until: '', reason: '' } });
  const extend = useMutation({ mutationFn: async (v: typeof extForm.values) => api.post(`/applicants/${id}/extend-retention`, v), onSuccess: () => { toastOk(); setExtendOpen(false); extForm.reset(); refresh(); }, onError: (e) => { extForm.setErrors(parseError(e).fields); toastError(e); } });
  const locked = !a || ['offer', 'hired', 'rejected'].includes(a.stage);

  return (
    <Drawer opened={!!id} onClose={onClose} position="right" size="xl" title={a ? `${a.name} · ${a.code}` : t('common.loading')}>
      {a && (
        <Tabs defaultValue="overview">
          <Tabs.List mb="md">
            <Tabs.Tab value="overview">{t('rec.tab_overview')}</Tabs.Tab><Tabs.Tab value="interviews">{t('rec.tab_interviews')}</Tabs.Tab>
            <Tabs.Tab value="references">{t('rec.tab_references')}</Tabs.Tab><Tabs.Tab value="offer">{t('rec.tab_offer')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview"><Stack gap="md">
            <Group justify="space-between"><Badge size="lg" color={STAGE_COLOR[a.stage]} variant="light">{t(`rec.stage.${a.stage}`)}</Badge><Text size="sm" c="dimmed">{a.vacancy}</Text></Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <Text size="sm"><b>{t('rec.email')}:</b> {a.email}</Text><Text size="sm"><b>{t('rec.phone')}:</b> {a.phone ?? '—'}</Text>
              <Text size="sm"><b>{t('rec.source')}:</b> {a.source ?? '—'}</Text><Text size="sm"><b>{t('rec.applied_on')}:</b> {a.applied_on}</Text>
              <Text size="sm"><b>{t('rec.consent')}:</b> {a.consent_recorded_at?.slice(0, 10) ?? '—'}</Text><Text size="sm"><b>{t('rec.retention_until')}:</b> {a.retention_until ?? '—'}</Text>
            </SimpleGrid>
            {a.notes && <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{a.notes}</Text>}
            {a.rejection_reason && <Alert color="red" variant="light">{a.rejection_reason}</Alert>}
            {!a.anonymized && !locked && (
              <Card withBorder padding="sm"><Stack gap="xs">
                <Group align="flex-end" gap="xs"><Select label={t('rec.move_to')} data={MANUAL.map((s) => ({ value: s, label: t(`rec.stage.${s}`) }))} value={stage} onChange={setStage} style={{ flex: 1 }} />
                  <Button disabled={!stage || stage === a.stage} loading={move.isPending} onClick={() => move.mutate(undefined as never)}>{t('rec.move')}</Button></Group>
                <Group gap="xs">
                  {['interview', 'assessment'].includes(a.stage) && <Button variant="light" loading={select.isPending} onClick={() => select.mutate(undefined as never)}>{t('rec.request_selection')}</Button>}
                  <Button variant="light" color="red" onClick={() => setRejectOpen(true)}>{t('rec.reject')}</Button>
                </Group>
              </Stack></Card>
            )}
            {a.stage === 'offer' && <Group><Button variant="light" color="red" onClick={() => setRejectOpen(true)}>{t('rec.reject')}</Button></Group>}
            {!a.anonymized && (a.stage === 'rejected' || (!!a.retention_until && a.retention_until <= new Date().toISOString().slice(0, 10) && !a.converted_employee_id)) && (
              <Group gap="xs"><Button variant="light" onClick={() => setExtendOpen(true)}>{t('rec.extend_retention')}</Button><Button variant="light" color="red" onClick={() => setAnon(true)}>{t('rec.anonymise')}</Button></Group>
            )}
            {a.anonymized && <Alert variant="light" color="gray">{t('rec.is_anonymised')}</Alert>}
            <Text size="sm" fw={600}>{t('rec.history')}</Text>
            <Timeline active={a.history.length} bulletSize={14} lineWidth={2}>
              {a.history.map((h, i) => (<Timeline.Item key={i} title={<Text size="sm">{t(`rec.stage.${h.stage}`)}</Text>}><Text size="xs" c="dimmed">{h.at.slice(0, 16).replace('T', ' ')}</Text>{h.note && <Text size="xs">{h.note}</Text>}</Timeline.Item>))}
            </Timeline>
          </Stack></Tabs.Panel>

          <Tabs.Panel value="interviews"><InterviewsTab a={a} onDone={refresh} /></Tabs.Panel>
          <Tabs.Panel value="references"><ReferencesTab a={a} onDone={refresh} /></Tabs.Panel>
          <Tabs.Panel value="offer"><OfferTab a={a} onDone={refresh} onAnswer={(oid, decision) => setAnswer({ id: oid, decision })} can={can('hr.salary.view')} /></Tabs.Panel>
        </Tabs>
      )}

      <Modal opened={rejectOpen} onClose={() => setRejectOpen(false)} title={t('rec.reject')} centered>
        <form onSubmit={rejectForm.onSubmit((v) => reject.mutate(v))}><Stack gap="sm">
          <Textarea label={t('rec.reject_reason')} required autosize minRows={3} maxLength={1000} {...rejectForm.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setRejectOpen(false)}>{t('common.cancel')}</Button><Button color="red" type="submit" loading={reject.isPending}>{t('rec.reject')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={extendOpen} onClose={() => setExtendOpen(false)} title={t('rec.extend_retention')} centered>
        <form onSubmit={extForm.onSubmit((v) => extend.mutate(v))}><Stack gap="sm">
          <TextInput type="date" label={t('rec.keep_until')} required {...extForm.getInputProps('until')} />
          <Textarea label={t('rec.extend_reason')} required autosize minRows={2} maxLength={1000} {...extForm.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setExtendOpen(false)}>{t('common.cancel')}</Button><Button type="submit" loading={extend.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={anon} onClose={() => setAnon(false)} onConfirm={() => anonymize.mutate(undefined as never)} loading={anonymize.isPending} title={t('rec.anonymise')} text={t('rec.anonymise_confirm')} />
      <AnswerModal answer={answer} onClose={() => setAnswer(null)} onDone={() => { setAnswer(null); refresh(); }} />
    </Drawer>
  );
}

function InterviewsTab({ a, onDone }: { a: Detail; onDone: () => void }) {
  const { t } = useTranslation();
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const form = useForm({ initialValues: { type: 'interview', scheduled_at: '', location: '', notes: '', panel_employee_ids: [] as string[] } });
  const save = useMutation({ mutationFn: async (v: typeof form.values) => api.post(`/applicants/${a.id}/interviews`, v), onSuccess: () => { toastOk(); form.reset(); onDone(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const canSchedule = MANUAL.includes(a.stage);
  return (
    <Stack gap="md">
      {a.interviews.map((i) => (
        <Card key={i.id} withBorder padding="sm"><Group justify="space-between"><Text size="sm" fw={600}>{t(`rec.itype.${i.type}`)} · {i.scheduled_at.slice(0, 16).replace('T', ' ')}</Text><Badge variant="light">{t(`rec.istatus.${i.status}`)}</Badge></Group>
          <Text size="xs" c="dimmed">{t('rec.panel')}: {i.panel.join(', ')} · {t('rec.scorecards_count', { count: i.scorecards })}</Text></Card>
      ))}
      {!a.interviews.length && <Text size="sm" c="dimmed">{t('rec.no_interviews')}</Text>}
      {canSchedule && !a.anonymized && (
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm"><Text fw={600} size="sm">{t('rec.schedule_interview')}</Text>
          <Group grow align="flex-start"><Select label={t('rec.itype_label')} allowDeselect={false} data={['interview', 'assessment'].map((x) => ({ value: x, label: t(`rec.itype.${x}`) }))} {...form.getInputProps('type')} />
            <TextInput type="datetime-local" label={t('rec.when')} required {...form.getInputProps('scheduled_at')} /></Group>
          <TextInput label={t('rec.where')} {...form.getInputProps('location')} />
          <MultiSelect label={t('rec.panel')} required searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} {...form.getInputProps('panel_employee_ids')} />
          <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('rec.schedule')}</Button></Group>
        </Stack></form>
      )}
    </Stack>
  );
}

function ReferencesTab({ a, onDone }: { a: Detail; onDone: () => void }) {
  const { t } = useTranslation();
  const form = useForm({ initialValues: { referee_name: '', referee_contact: '', relationship: '', result: 'pending', notes: '', checked_on: '' } });
  const add = useMutation({ mutationFn: async (v: typeof form.values) => api.post(`/applicants/${a.id}/references`, { ...v, checked_on: v.checked_on || undefined }), onSuccess: () => { toastOk(); form.reset(); onDone(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const upd = useMutation({ mutationFn: async (p: { id: string; result: string }) => api.patch(`/references/${p.id}`, { result: p.result }), onSuccess: () => { toastOk(); onDone(); }, onError: toastError });
  const results = ['pending', 'satisfactory', 'concerns'].map((x) => ({ value: x, label: t(`rec.ref.${x}`) }));
  return (
    <Stack gap="md">
      {a.references.map((r) => (
        <Card key={r.id} withBorder padding="sm"><Group justify="space-between" align="flex-start"><div><Text size="sm" fw={600}>{r.referee_name}</Text><Text size="xs" c="dimmed">{[r.relationship, r.referee_contact].filter(Boolean).join(' · ')}</Text>{r.notes && <Text size="xs">{r.notes}</Text>}</div>
          <Select size="xs" w={150} allowDeselect={false} data={results} value={r.result} onChange={(v) => v && upd.mutate({ id: r.id, result: v })} /></Group></Card>
      ))}
      {!a.references.length && <Text size="sm" c="dimmed">{t('rec.no_references')}</Text>}
      {!a.anonymized && (
        <form onSubmit={form.onSubmit((v) => add.mutate(v))}><Stack gap="sm"><Text fw={600} size="sm">{t('rec.add_reference')}</Text>
          <Group grow align="flex-start"><TextInput label={t('rec.referee')} required {...form.getInputProps('referee_name')} /><TextInput label={t('rec.referee_contact')} {...form.getInputProps('referee_contact')} /></Group>
          <Group grow align="flex-start"><TextInput label={t('rec.relationship')} {...form.getInputProps('relationship')} /><Select label={t('rec.ref_result')} allowDeselect={false} data={results} {...form.getInputProps('result')} /><TextInput type="date" label={t('rec.checked_on')} {...form.getInputProps('checked_on')} /></Group>
          <Textarea label={t('rec.notes')} autosize minRows={2} {...form.getInputProps('notes')} />
          <Group justify="flex-end"><Button type="submit" loading={add.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      )}
    </Stack>
  );
}

function OfferTab({ a, onDone, onAnswer, can }: { a: Detail; onDone: () => void; onAnswer: (id: string, d: 'accepted' | 'declined') => void; can: boolean }) {
  const { t } = useTranslation();
  const cats = useLookup('employee_category');
  const contracts = useLookup('contract_type');
  const positions = useQuery({ queryKey: ['hr-positions'], queryFn: async () => (await api.get<{ data: { id: string; title: string }[] }>('/hr/positions')).data.data });
  const grades = useQuery({ queryKey: ['hr-grades'], queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/hr/grades')).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const [manager, setManager] = useState<string | null>(null);
  const active = a.offers.some((o) => ['draft', 'issued', 'accepted'].includes(o.status));
  const form = useForm({ initialValues: { category_id: null as string | null, contract_type_id: null as string | null, position_id: null as string | null, grade_id: null as string | null, department_id: null as string | null, start_date: '',
    probation_months: 0 as number | string, contract_end_on: '', salary_amount: '' as number | string, salary_currency: '', salary_period: 'monthly', terms: '', band_exception_reason: '' } });
  const opt = (rows: { id: string; [k: string]: unknown }[] | undefined, key = 'name'): Opt[] => (rows ?? []).map((r) => ({ value: r.id, label: String(r[key]) }));
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => { const body: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (x !== '' && x != null) body[k] = x; return api.post(`/applicants/${a.id}/offers`, body); },
    onSuccess: () => { toastOk(); form.reset(); onDone(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const useStep = (path: string, body?: object) => useMutation({ mutationFn: async (id: string) => api.post(`/offers/${id}/${path}`, body ?? {}), onSuccess: () => { toastOk(); onDone(); }, onError: toastError });
  const issue = useStep('issue');
  const withdraw = useStep('withdraw');
  const convert = useMutation({ mutationFn: async () => (await api.post<{ data: { employee_number: string } }>(`/applicants/${a.id}/convert`, { manager_employee_id: manager || undefined })).data.data,
    onSuccess: (r) => { toastOk(t('rec.converted', { number: r.employee_number })); onDone(); }, onError: toastError });
  const pdf = async (id: string, code: string, lang: string) => {
    try {
      const r = await api.get<Blob>(`/offers/${id}/pdf`, { params: { lang }, responseType: 'blob' });
      const url = URL.createObjectURL(r.data); const el = document.createElement('a'); el.href = url; el.download = `${code}.pdf`; el.click(); URL.revokeObjectURL(url);
    } catch (e) { toastError(e); }
  };
  const lines = a.stage === 'offer' && !active && !a.anonymized;

  return (
    <Stack gap="md">
      {a.offers.map((o) => (
        <Card key={o.id} withBorder padding="sm"><Stack gap={6}>
          <Group justify="space-between"><Text size="sm" fw={600}>{o.code} · {o.position ?? a.vacancy}</Text><Badge color={OFFER_COLOR[o.status]} variant="light">{t(`rec.ostatus.${o.status}`)}</Badge></Group>
          <Text size="xs" c="dimmed">{t('rec.start_date')}: {o.start_date}{o.valid_until ? ` · ${t('rec.valid_until')}: ${o.valid_until}` : ''}</Text>
          {o.salary_amount != null && <Text size="sm">{Number(o.salary_amount).toLocaleString()} {o.salary_currency} {t(`rec.period.${o.salary_period ?? 'monthly'}`)}</Text>}
          <Group gap="xs">
            {o.status === 'draft' && <Button size="compact-sm" onClick={() => issue.mutate(o.id)} loading={issue.isPending}>{t('rec.issue')}</Button>}
            {o.status === 'issued' && <><Button size="compact-sm" color="green" onClick={() => onAnswer(o.id, 'accepted')}>{t('rec.accepted')}</Button><Button size="compact-sm" color="red" variant="light" onClick={() => onAnswer(o.id, 'declined')}>{t('rec.declined')}</Button></>}
            {['draft', 'issued', 'accepted'].includes(o.status) && !a.converted_employee_id && <Button size="compact-sm" variant="subtle" color="red" onClick={() => withdraw.mutate(o.id)}>{t('rec.withdraw')}</Button>}
            {can && <Select size="xs" w={110} placeholder={t('rec.letter')} leftSection={<IconDownload size={14} />} data={['en', 'fr', 'rw', 'sw'].map((l) => ({ value: l, label: l.toUpperCase() }))} value={null} onChange={(l) => l && void pdf(o.id, o.code, l)} />}
          </Group>
        </Stack></Card>
      ))}
      {!a.offers.length && <Text size="sm" c="dimmed">{a.stage === 'offer' ? t('rec.no_offers') : t('rec.offer_after_selection')}</Text>}

      {a.can_convert && (
        <Card withBorder padding="sm" bg="var(--mantine-color-green-light)"><Stack gap="xs"><Text size="sm" fw={600}>{t('rec.ready_to_convert')}</Text><Text size="xs">{t('rec.convert_note')}</Text>
          <Select label={t('employees.manager')} clearable searchable data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} value={manager} onChange={setManager} />
          <Group justify="flex-end"><Button leftSection={<IconUserCheck size={16} />} loading={convert.isPending} onClick={() => convert.mutate()}>{t('rec.convert')}</Button></Group></Stack></Card>
      )}
      {a.converted_employee_id && <Alert color="green" variant="light">{t('rec.already_employee')}</Alert>}

      {lines && !can && <Alert variant="light" color="orange">{t('rec.salary_permission')}</Alert>}
      {lines && can && (
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm"><Text fw={600} size="sm">{t('rec.create_offer')}</Text>
          <Group grow align="flex-start"><Select label={t('hr.new_category')} required data={cats.options} {...form.getInputProps('category_id')} /><Select label={t('hr.contract_type')} clearable data={contracts.options} {...form.getInputProps('contract_type_id')} /></Group>
          <Group grow align="flex-start"><Select label={t('hr.position')} clearable searchable data={opt(positions.data, 'title')} {...form.getInputProps('position_id')} /><Select label={t('hr.grade')} clearable data={opt(grades.data)} {...form.getInputProps('grade_id')} /><Select label={t('employees.department')} clearable data={opt(depts.data)} {...form.getInputProps('department_id')} /></Group>
          <Group grow align="flex-start"><TextInput type="date" label={t('rec.start_date')} required {...form.getInputProps('start_date')} /><NumberInput label={t('rec.probation_months')} min={0} max={24} {...form.getInputProps('probation_months')} /><TextInput type="date" label={t('hr.contract_end')} {...form.getInputProps('contract_end_on')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('hr.salary')} required min={0} thousandSeparator="," {...form.getInputProps('salary_amount')} /><CurrencySelect required label={t('hr.currency')} value={form.values.salary_currency} onChange={(v) => form.setFieldValue('salary_currency', v)} error={form.errors.salary_currency as string | undefined} />
            <Select label={t('rec.period_label')} allowDeselect={false} data={['monthly', 'annual'].map((x) => ({ value: x, label: t(`rec.period.${x}`) }))} {...form.getInputProps('salary_period')} /></Group>
          <Textarea label={t('rec.terms')} autosize minRows={2} maxLength={10000} {...form.getInputProps('terms')} />
          <Textarea label={t('rec.band_exception')} description={t('rec.band_exception_hint')} autosize minRows={2} maxLength={1000} {...form.getInputProps('band_exception_reason')} />
          <Group justify="flex-end"><Button type="submit" loading={create.isPending}>{t('rec.create_offer')}</Button></Group>
        </Stack></form>
      )}
    </Stack>
  );
}

function AnswerModal({ answer, onClose, onDone }: { answer: { id: string; decision: 'accepted' | 'declined' } | null; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const form = useForm({ initialValues: { responded_on: new Date().toISOString().slice(0, 10) } });
  const save = useMutation({ mutationFn: async (v: typeof form.values) => api.post(`/offers/${answer!.id}/respond`, { decision: answer!.decision, responded_on: v.responded_on }), onSuccess: () => { toastOk(); onDone(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  return (
    <Modal opened={!!answer} onClose={onClose} title={answer ? t(`rec.${answer.decision}`) : ''} centered>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}><Stack gap="sm">
        <TextInput type="date" label={t('rec.responded_on')} required {...form.getInputProps('responded_on')} />
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
      </Stack></form>
    </Modal>
  );
}
