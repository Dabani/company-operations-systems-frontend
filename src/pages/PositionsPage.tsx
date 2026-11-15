import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Tabs, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CurrencySelect } from '@/components/CurrencySelect';
import { PageHeader } from '@/components/PageHeader';
import { RowIconButton } from '@/components/DataList';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Grade { id: string; code: string; name: string; level: number; is_active: boolean; salary_min?: string | null; salary_max?: string | null; currency_code?: string | null }
interface Position { id: string; code: string; title: string; department_id: string | null; department: string | null; grade_id: string | null; grade: string | null; description: string | null; is_active: boolean }
interface Criterion { id: string; from_grade: string; to_grade: string; from_grade_id: string; to_grade_id: string; min_months_in_grade: number; min_rating_level: number | null; notes: string | null }

export function PositionsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('hr.structure.manage');
  const seeSalary = can('hr.salary.view');
  const ratings = useLookup('performance_rating');
  const [posModal, setPosModal] = useState<Position | 'new' | null>(null);
  const [gradeModal, setGradeModal] = useState<Grade | 'new' | null>(null);
  const [critModal, setCritModal] = useState(false);
  const [delCrit, setDelCrit] = useState<Criterion | null>(null);

  const grades = useQuery({ queryKey: ['hr-grades'], queryFn: async () => (await api.get<{ data: Grade[] }>('/hr/grades')).data.data });
  const positions = useQuery({ queryKey: ['hr-positions'], queryFn: async () => (await api.get<{ data: Position[] }>('/hr/positions')).data.data });
  const criteria = useQuery({ queryKey: ['hr-criteria'], queryFn: async () => (await api.get<{ data: Criterion[] }>('/hr/progression-criteria')).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const gradeOpts = (grades.data ?? []).map((g) => ({ value: g.id, label: g.name }));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-grades'] }); void qc.invalidateQueries({ queryKey: ['hr-positions'] }); void qc.invalidateQueries({ queryKey: ['hr-criteria'] }); };

  const posForm = useForm({ initialValues: { title: '', department_id: null as string | null, grade_id: null as string | null, description: '', is_active: true } });
  const gradeForm = useForm({ initialValues: { name: '', level: 1 as number | string, is_active: true, salary_min: '' as number | string, salary_max: '' as number | string, currency_code: '' } });
  const critForm = useForm({ initialValues: { from_grade_id: null as string | null, to_grade_id: null as string | null, min_months_in_grade: 12 as number | string, min_rating_level: null as string | null, notes: '' } });

  const openPos = (p: Position | 'new') => { setPosModal(p); posForm.setValues(p === 'new' ? { title: '', department_id: null, grade_id: null, description: '', is_active: true } : { title: p.title, department_id: p.department_id, grade_id: p.grade_id, description: p.description ?? '', is_active: p.is_active }); };
  const openGrade = (g: Grade | 'new') => { setGradeModal(g); gradeForm.setValues(g === 'new' ? { name: '', level: 1, is_active: true, salary_min: '', salary_max: '', currency_code: '' } : { name: g.name, level: g.level, is_active: g.is_active, salary_min: g.salary_min ?? '', salary_max: g.salary_max ?? '', currency_code: g.currency_code ?? '' }); };

  const savePos = useMutation({ mutationFn: async (v: typeof posForm.values) => posModal === 'new' ? api.post('/hr/positions', v) : api.patch(`/hr/positions/${(posModal as Position).id}`, v),
    onSuccess: () => { toastOk(); setPosModal(null); refresh(); }, onError: (e) => { posForm.setErrors(parseError(e).fields); toastError(e); } });
  const saveGrade = useMutation({
    mutationFn: async (v: typeof gradeForm.values) => {
      const body: Record<string, unknown> = { name: v.name, level: v.level === '' ? undefined : v.level, is_active: v.is_active };
      if (seeSalary) { body.salary_min = v.salary_min === '' ? null : v.salary_min; body.salary_max = v.salary_max === '' ? null : v.salary_max; body.currency_code = v.currency_code || null; }
      return gradeModal === 'new' ? api.post('/hr/grades', body) : api.patch(`/hr/grades/${(gradeModal as Grade).id}`, body);
    },
    onSuccess: () => { toastOk(); setGradeModal(null); refresh(); }, onError: (e) => { gradeForm.setErrors(parseError(e).fields); toastError(e); } });
  const saveCrit = useMutation({ mutationFn: async (v: typeof critForm.values) => api.post('/hr/progression-criteria', { ...v, min_rating_level: v.min_rating_level ? Number(v.min_rating_level) : null }),
    onSuccess: () => { toastOk(); setCritModal(false); critForm.reset(); refresh(); }, onError: (e) => { critForm.setErrors(parseError(e).fields); toastError(e); } });
  const removeCrit = useMutation({ mutationFn: async () => api.delete(`/hr/progression-criteria/${delCrit!.id}`), onSuccess: () => { toastOk(); setDelCrit(null); refresh(); }, onError: toastError });

  const active = (b: boolean) => <Badge color={b ? 'green' : 'gray'} variant="light">{b ? t('common.active') : t('common.inactive')}</Badge>;
  return (
    <>
      <PageHeader title={t('hr.structure_title')} description={t('hr.structure_intro')} />
      <Tabs defaultValue="positions">
        <Tabs.List mb="md"><Tabs.Tab value="positions">{t('hr.positions_tab')}</Tabs.Tab><Tabs.Tab value="grades">{t('hr.grades_tab')}</Tabs.Tab><Tabs.Tab value="criteria">{t('hr.criteria_tab')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="positions">
          {manage && <Group justify="flex-end" mb="sm"><Button leftSection={<IconPlus size={16} />} onClick={() => openPos('new')}>{t('hr.new_position')}</Button></Group>}
          <Table highlightOnHover verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('hr.position')}</Table.Th><Table.Th visibleFrom="sm">{t('employees.department')}</Table.Th><Table.Th visibleFrom="sm">{t('hr.grade')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>{(positions.data ?? []).map((p) => (
              <Table.Tr key={p.id}><Table.Td><Badge variant="outline">{p.code}</Badge></Table.Td><Table.Td><Text size="sm" fw={600}>{p.title}</Text></Table.Td><Table.Td visibleFrom="sm">{p.department ?? '—'}</Table.Td><Table.Td visibleFrom="sm">{p.grade ?? '—'}</Table.Td><Table.Td>{active(p.is_active)}</Table.Td>
                <Table.Td>{manage && <RowIconButton label={t('common.edit')} onClick={() => openPos(p)}><IconEdit size={18} /></RowIconButton>}</Table.Td></Table.Tr>))}</Table.Tbody></Table>
        </Tabs.Panel>

        <Tabs.Panel value="grades">
          {manage && <Group justify="flex-end" mb="sm"><Button leftSection={<IconPlus size={16} />} onClick={() => openGrade('new')}>{t('hr.new_grade')}</Button></Group>}
          <Table highlightOnHover verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>{t('hr.code')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('hr.level')}</Table.Th>{seeSalary && <Table.Th visibleFrom="sm">{t('hr.pay_band')}</Table.Th>}<Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>{(grades.data ?? []).map((g) => (
              <Table.Tr key={g.id}><Table.Td><Badge variant="outline">{g.code}</Badge></Table.Td><Table.Td><Text size="sm" fw={600}>{g.name}</Text></Table.Td><Table.Td>{g.level}</Table.Td>
                {seeSalary && <Table.Td visibleFrom="sm">{g.salary_min != null || g.salary_max != null ? `${Number(g.salary_min ?? 0).toLocaleString()} – ${Number(g.salary_max ?? 0).toLocaleString()} ${g.currency_code ?? ''}` : '—'}</Table.Td>}
                <Table.Td>{active(g.is_active)}</Table.Td><Table.Td>{manage && <RowIconButton label={t('common.edit')} onClick={() => openGrade(g)}><IconEdit size={18} /></RowIconButton>}</Table.Td></Table.Tr>))}</Table.Tbody></Table>
        </Tabs.Panel>

        <Tabs.Panel value="criteria">
          <Text size="sm" c="dimmed" mb="sm">{t('hr.criteria_intro')}</Text>
          {manage && <Group justify="flex-end" mb="sm"><Button leftSection={<IconPlus size={16} />} onClick={() => setCritModal(true)}>{t('hr.new_criterion')}</Button></Group>}
          <Table highlightOnHover verticalSpacing="sm"><Table.Thead><Table.Tr><Table.Th>{t('hr.from_grade')}</Table.Th><Table.Th>{t('hr.to_grade')}</Table.Th><Table.Th>{t('hr.min_months')}</Table.Th><Table.Th>{t('hr.min_rating')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>{(criteria.data ?? []).map((c) => (
              <Table.Tr key={c.id}><Table.Td>{c.from_grade}</Table.Td><Table.Td>{c.to_grade}</Table.Td><Table.Td>{c.min_months_in_grade}</Table.Td><Table.Td>{c.min_rating_level ?? '—'}</Table.Td>
                <Table.Td>{manage && <RowIconButton label={t('common.delete')} color="red" onClick={() => setDelCrit(c)}><IconTrash size={18} /></RowIconButton>}</Table.Td></Table.Tr>))}</Table.Tbody></Table>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={!!posModal} onClose={() => setPosModal(null)} title={posModal === 'new' ? t('hr.new_position') : t('hr.edit_position')} centered>
        <form onSubmit={posForm.onSubmit((v) => savePos.mutate(v))}><Stack gap="sm">
          <TextInput label={t('hr.position')} required {...posForm.getInputProps('title')} />
          <Group grow><Select label={t('employees.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...posForm.getInputProps('department_id')} /><Select label={t('hr.grade')} clearable data={gradeOpts} {...posForm.getInputProps('grade_id')} /></Group>
          <Textarea label={t('common.description')} autosize minRows={2} {...posForm.getInputProps('description')} />
          <Switch label={t('common.active')} {...posForm.getInputProps('is_active', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setPosModal(null)}>{t('common.cancel')}</Button><Button type="submit" loading={savePos.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={!!gradeModal} onClose={() => setGradeModal(null)} title={gradeModal === 'new' ? t('hr.new_grade') : t('hr.edit_grade')} centered>
        <form onSubmit={gradeForm.onSubmit((v) => saveGrade.mutate(v))}><Stack gap="sm">
          <Group grow><TextInput label={t('common.name')} required {...gradeForm.getInputProps('name')} /><NumberInput label={t('hr.level')} description={t('hr.level_note')} min={0} max={99} {...gradeForm.getInputProps('level')} /></Group>
          {seeSalary && <Group grow align="flex-start"><NumberInput label={t('hr.salary_min')} min={0} thousandSeparator="," {...gradeForm.getInputProps('salary_min')} /><NumberInput label={t('hr.salary_max')} min={0} thousandSeparator="," {...gradeForm.getInputProps('salary_max')} />
            <CurrencySelect label={t('hr.currency')} value={gradeForm.values.currency_code} onChange={(v) => gradeForm.setFieldValue('currency_code', v)} error={gradeForm.errors.currency_code as string | undefined} /></Group>}
          <Switch label={t('common.active')} {...gradeForm.getInputProps('is_active', { type: 'checkbox' })} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setGradeModal(null)}>{t('common.cancel')}</Button><Button type="submit" loading={saveGrade.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={critModal} onClose={() => setCritModal(false)} title={t('hr.new_criterion')} centered>
        <form onSubmit={critForm.onSubmit((v) => saveCrit.mutate(v))}><Stack gap="sm">
          <Group grow><Select label={t('hr.from_grade')} required data={gradeOpts} {...critForm.getInputProps('from_grade_id')} /><Select label={t('hr.to_grade')} required data={gradeOpts} {...critForm.getInputProps('to_grade_id')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('hr.min_months')} min={0} max={600} required {...critForm.getInputProps('min_months_in_grade')} />
            <Select label={t('hr.min_rating')} clearable data={ratings.items.map((i) => ({ value: String(i.sort_order), label: `${i.sort_order} — ${i.label}` }))} {...critForm.getInputProps('min_rating_level')} /></Group>
          <Textarea label={t('common.description')} autosize minRows={2} {...critForm.getInputProps('notes')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCritModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={saveCrit.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <ConfirmModal opened={!!delCrit} onClose={() => setDelCrit(null)} onConfirm={() => removeCrit.mutate()} loading={removeCrit.isPending} />
    </>
  );
}
