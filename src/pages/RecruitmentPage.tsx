import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { ApplicantDrawer, OFFER_COLOR, STAGE_COLOR } from '@/components/ApplicantDrawer';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PageHeader } from '@/components/PageHeader';
import { RowIconButton } from '@/components/DataList';
import { toastError, toastOk } from '@/lib/ui';

interface Vac { id: string; code: string; title: string; status: string; opened_on: string; closes_on: string | null; requisition_code: string | null; headcount: number | null; applicants: number; hired: number }
interface App { id: string; code: string; name: string; email: string; stage: string; vacancy: string | null; applied_on: string; retention_until: string | null; anonymized: boolean }
interface OfferRow { id: string; code: string; applicant_id: string; applicant: string; status: string; position: string | null; start_date: string; valid_until: string | null; salary_amount?: string; salary_currency?: string }
interface Setting { key: string; value: number; default: number; min: number; max: number }
interface Tpl { id: string; title: string; offset_days: number; sort_order: number; is_active: boolean }

export function RecruitmentPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string | null>('vacancies');
  const [open, setOpen] = useState<string | null>(null);
  const [vacFilter, setVacFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<Vac | null>(null);
  const [closing, setClosing] = useState<Vac | null>(null);
  const form = useForm({ initialValues: { first_name: '', last_name: '', email: '', phone: '', source: '', notes: '', consent: false } });

  const vacancies = useQuery({ queryKey: ['hr-vacancies'], queryFn: async () => (await api.get<{ data: Vac[] }>('/vacancies')).data.data });
  const applicants = useQuery({ queryKey: ['hr-applicants', vacFilter, stageFilter, search, tab], enabled: tab === 'applicants' || tab === 'retention',
    queryFn: async () => (await api.get<{ data: App[] }>('/applicants', { params: { vacancy_id: vacFilter ?? undefined, stage: stageFilter ?? undefined, q: search || undefined, retention_due: tab === 'retention' ? 1 : undefined } })).data.data });
  const offers = useQuery({ queryKey: ['hr-offers'], enabled: tab === 'offers', queryFn: async () => (await api.get<{ data: OfferRow[] }>('/offers')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-vacancies'] }); void qc.invalidateQueries({ queryKey: ['hr-applicants'] }); };

  const add = useMutation({ mutationFn: async (v: typeof form.values) => api.post(`/vacancies/${adding!.id}/applicants`, v), onSuccess: () => { toastOk(); setAdding(null); form.reset(); refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const close = useMutation({ mutationFn: async () => api.post(`/vacancies/${closing!.id}/close`), onSuccess: () => { toastOk(); setClosing(null); refresh(); }, onError: toastError });

  const appTable = (rows: App[] | undefined) => (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('rec.vacancy')}</Table.Th><Table.Th>{t('rec.stage_label')}</Table.Th><Table.Th visibleFrom="md">{t('rec.retention_until')}</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
        {(rows ?? []).map((a) => (
          <Table.Tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(a.id)}>
            <Table.Td><Badge variant="outline">{a.code}</Badge></Table.Td><Table.Td><Text size="sm" fw={600}>{a.name}</Text><Text size="xs" c="dimmed">{a.anonymized ? '' : a.email}</Text></Table.Td>
            <Table.Td visibleFrom="sm">{a.vacancy}</Table.Td><Table.Td><Badge color={STAGE_COLOR[a.stage]} variant="light">{t(`rec.stage.${a.stage}`)}</Badge></Table.Td><Table.Td visibleFrom="md">{a.retention_until ?? '—'}</Table.Td>
          </Table.Tr>
        ))}
        {rows?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('rec.no_applicants')}</Text></Table.Td></Table.Tr>}
      </Table.Tbody>
    </Table>
  );
  const stages = ['applied', 'screened', 'interview', 'assessment', 'offer', 'hired', 'rejected'].map((s) => ({ value: s, label: t(`rec.stage.${s}`) }));

  return (
    <>
      <PageHeader title={t('rec.recruitment_title')} description={t('rec.recruitment_intro')} />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md"><Tabs.Tab value="vacancies">{t('rec.tab_vacancies')}</Tabs.Tab><Tabs.Tab value="applicants">{t('rec.tab_applicants')}</Tabs.Tab><Tabs.Tab value="offers">{t('rec.tab_offers')}</Tabs.Tab>
          <Tabs.Tab value="retention">{t('rec.tab_retention')}</Tabs.Tab><Tabs.Tab value="settings">{t('rec.tab_settings')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="vacancies">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('rec.job_title')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('rec.applicants_count')}</Table.Th><Table.Th>{t('rec.hired_of')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(vacancies.data ?? []).map((v) => (
                <Table.Tr key={v.id}>
                  <Table.Td><Badge variant="outline">{v.code}</Badge></Table.Td><Table.Td><Text size="sm" fw={600}>{v.title}</Text><Text size="xs" c="dimmed">{v.requisition_code} · {v.opened_on}</Text></Table.Td>
                  <Table.Td><Badge color={v.status === 'open' ? 'green' : 'gray'} variant="light">{t(`rec.vac_status.${v.status}`)}</Badge></Table.Td><Table.Td>{v.applicants}</Table.Td><Table.Td>{v.hired} / {v.headcount}</Table.Td>
                  <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                    <Button size="compact-xs" variant="subtle" onClick={() => { setVacFilter(v.id); setTab('applicants'); }}>{t('rec.tab_applicants')}</Button>
                    {v.status === 'open' && <Button size="compact-xs" variant="subtle" leftSection={<IconUserPlus size={14} />} onClick={() => setAdding(v)}>{t('rec.add_applicant')}</Button>}
                    {v.status === 'open' && <Button size="compact-xs" variant="subtle" color="red" onClick={() => setClosing(v)}>{t('hr.close_cycle')}</Button>}
                  </Group></Table.Td>
                </Table.Tr>
              ))}
              {vacancies.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('rec.no_vacancies')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="applicants">
          <Group mb="md" align="flex-end">
            <Select label={t('rec.vacancy')} clearable data={(vacancies.data ?? []).map((v) => ({ value: v.id, label: `${v.code} ${v.title}` }))} value={vacFilter} onChange={setVacFilter} />
            <Select label={t('rec.stage_label')} clearable data={stages} value={stageFilter} onChange={setStageFilter} />
            <TextInput label={t('common.search')} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
          </Group>
          {appTable(applicants.data)}
        </Tabs.Panel>

        <Tabs.Panel value="offers">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('rec.applicant')}</Table.Th><Table.Th>{t('hr.position')}</Table.Th><Table.Th>{t('rec.start_date')}</Table.Th><Table.Th>{t('common.status')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(offers.data ?? []).map((o) => (
                <Table.Tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(o.applicant_id)}>
                  <Table.Td><Badge variant="outline">{o.code}</Badge></Table.Td><Table.Td>{o.applicant}</Table.Td><Table.Td>{o.position ?? '—'}{o.salary_amount != null ? ` · ${Number(o.salary_amount).toLocaleString()} ${o.salary_currency}` : ''}</Table.Td>
                  <Table.Td>{o.start_date}</Table.Td><Table.Td><Badge color={OFFER_COLOR[o.status]} variant="light">{t(`rec.ostatus.${o.status}`)}</Badge></Table.Td>
                </Table.Tr>
              ))}
              {offers.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('rec.no_offers_list')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="retention">
          <Text size="sm" c="dimmed" mb="md">{t('rec.retention_intro')}</Text>
          {appTable(applicants.data)}
        </Tabs.Panel>

        <Tabs.Panel value="settings"><SettingsTab /></Tabs.Panel>
      </Tabs>

      <ApplicantDrawer id={open} onClose={() => setOpen(null)} />
      <Modal opened={!!adding} onClose={() => setAdding(null)} title={`${t('rec.add_applicant')} — ${adding?.title ?? ''}`} centered size="lg">
        <form onSubmit={form.onSubmit((v) => add.mutate(v))}><Stack gap="sm">
          <Group grow align="flex-start"><TextInput label={t('rec.first_name')} required {...form.getInputProps('first_name')} /><TextInput label={t('rec.last_name')} required {...form.getInputProps('last_name')} /></Group>
          <Group grow align="flex-start"><TextInput type="email" label={t('rec.email')} required {...form.getInputProps('email')} /><TextInput label={t('rec.phone')} {...form.getInputProps('phone')} /></Group>
          <TextInput label={t('rec.source')} {...form.getInputProps('source')} />
          <Textarea label={t('rec.notes')} autosize minRows={2} {...form.getInputProps('notes')} />
          <Switch label={t('rec.consent_label')} {...form.getInputProps('consent', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setAdding(null)}>{t('common.cancel')}</Button><Button type="submit" loading={add.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!closing} onClose={() => setClosing(null)} onConfirm={() => close.mutate()} loading={close.isPending} title={t('hr.close_cycle')} text={t('rec.close_vacancy_confirm')} />
    </>
  );
}

/** Retention and offer validity settings, plus the onboarding checklist template. */
function SettingsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['hr-settings'], queryFn: async () => (await api.get<{ data: Setting[] }>('/hr/settings')).data.data });
  const tpl = useQuery({ queryKey: ['hr-template'], queryFn: async () => (await api.get<{ data: Tpl[] }>('/hr/onboarding-template')).data.data });
  const [vals, setVals] = useState<Record<string, number | string>>({});
  const [title, setTitle] = useState('');
  const [offset, setOffset] = useState<number | string>(0);
  const [del, setDel] = useState<Tpl | null>(null);
  const reloadTpl = () => qc.invalidateQueries({ queryKey: ['hr-template'] });
  const save = useMutation({ mutationFn: async () => api.put('/hr/settings', Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)]))), onSuccess: () => { toastOk(); setVals({}); void qc.invalidateQueries({ queryKey: ['hr-settings'] }); }, onError: toastError });
  const add = useMutation({ mutationFn: async () => api.post('/hr/onboarding-template', { title, offset_days: Number(offset) }), onSuccess: () => { toastOk(); setTitle(''); setOffset(0); void reloadTpl(); }, onError: toastError });
  const toggle = useMutation({ mutationFn: async (x: Tpl) => api.patch(`/hr/onboarding-template/${x.id}`, { is_active: !x.is_active }), onSuccess: () => reloadTpl(), onError: toastError });
  const remove = useMutation({ mutationFn: async () => api.delete(`/hr/onboarding-template/${del!.id}`), onSuccess: () => { toastOk(); setDel(null); void reloadTpl(); }, onError: toastError });

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text fw={600}>{t('rec.settings_title')}</Text>
        <Group align="flex-end">
          {(settings.data ?? []).map((s) => (
            <NumberInput key={s.key} label={t(`rec.setting.${s.key}`)} description={t('rec.setting_range', { min: s.min, max: s.max, def: s.default })} min={s.min} max={s.max} w={260} value={vals[s.key] ?? s.value} onChange={(v) => setVals({ ...vals, [s.key]: v })} />
          ))}
          <Button disabled={!Object.keys(vals).length} loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        </Group>
      </Stack>
      <Stack gap="sm">
        <Text fw={600}>{t('rec.template_title')}</Text><Text size="sm" c="dimmed">{t('rec.template_intro')}</Text>
        <Table verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>{t('rec.task')}</Table.Th><Table.Th>{t('rec.offset_days')}</Table.Th><Table.Th>{t('common.active')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(tpl.data ?? []).map((x) => (
              <Table.Tr key={x.id}><Table.Td>{x.title}</Table.Td><Table.Td>{x.offset_days}</Table.Td><Table.Td><Switch checked={x.is_active} onChange={() => toggle.mutate(x)} aria-label={t('common.active')} /></Table.Td>
                <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => setDel(x)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group align="flex-end"><TextInput label={t('rec.task')} value={title} onChange={(e) => setTitle(e.currentTarget.value)} style={{ flex: 1 }} /><NumberInput label={t('rec.offset_days')} min={-30} max={365} w={140} value={offset} onChange={setOffset} />
          <Button leftSection={<IconPlus size={16} />} disabled={!title.trim()} loading={add.isPending} onClick={() => add.mutate()}>{t('rec.add_task')}</Button></Group>
      </Stack>
      <ConfirmModal opened={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} />
    </Stack>
  );
}
