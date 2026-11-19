import { ActionIcon, Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CurrencySelect } from '@/components/CurrencySelect';
import { RichTextField } from '@/components/RichTextField';
import { fmtCents, lineCents, totalCents } from '@/lib/procurement';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

interface Line { description: string; quantity: number | string; unit: string; unit_price: number | string }
export interface ReqForEdit {
  id: string; title: string; purpose: string | null; procurement_type_id: string; department_id: string | null; project: { id: string } | null; preferred_supplier: { id: string } | null; preferred_supplier_reason: string | null;
  needed_by: string; delivery_location: string; currency_code: string; exception_reason: string | null; lines: { description: string; quantity: string; unit: string | null; unit_price: string }[];
}
const newLine = (): Line => ({ description: '', quantity: 1, unit: '', unit_price: '' });
const blank = { title: '', purpose: '', procurement_type_id: null as string | null, department_id: null as string | null, project_id: null as string | null, preferred_supplier_id: null as string | null, preferred_supplier_reason: '',
  needed_by: '', delivery_location: '', currency_code: '', exception_reason: '', lines: [newLine()] };

export function PurchaseRequisitionFormModal({ opened, onClose, requisition, onSaved }: { opened: boolean; onClose: () => void; requisition?: ReqForEdit | null; onSaved: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const types = useLookup('procurement_type', opened);
  const form = useForm({ initialValues: blank });
  const depts = useQuery({ queryKey: ['dept-options'], enabled: opened && can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const projects = useQuery({ queryKey: ['project-options'], enabled: opened && can('project.view'), queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/projects', { params: { per_page: 100 } })).data.data });
  const suppliers = useQuery({ queryKey: ['supplier-options'], enabled: opened, queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string; status: string }>>('/suppliers', { params: { per_page: 100 } })).data.data.filter((s) => s.status === 'approved') });

  useEffect(() => {
    if (!opened) return;
    form.setValues(requisition ? { title: requisition.title, purpose: requisition.purpose ?? '', procurement_type_id: requisition.procurement_type_id, department_id: requisition.department_id, project_id: requisition.project?.id ?? null,
      preferred_supplier_id: requisition.preferred_supplier?.id ?? null, preferred_supplier_reason: requisition.preferred_supplier_reason ?? '', needed_by: requisition.needed_by, delivery_location: requisition.delivery_location,
      currency_code: requisition.currency_code, exception_reason: requisition.exception_reason ?? '', lines: requisition.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit: l.unit ?? '', unit_price: Number(l.unit_price) })) } : blank);
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, requisition?.id]);

  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const body = { title: v.title, purpose: v.purpose || null, procurement_type_id: v.procurement_type_id, department_id: v.department_id, project_id: v.project_id, preferred_supplier_id: v.preferred_supplier_id,
        preferred_supplier_reason: v.preferred_supplier_id ? v.preferred_supplier_reason || null : null, needed_by: v.needed_by, delivery_location: v.delivery_location, currency_code: v.currency_code.toUpperCase(),
        exception_reason: v.exception_reason || null, lines: v.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unit: l.unit || null, unit_price: Number(l.unit_price || 0) })) };
      return (await (requisition ? api.patch<{ data: { id: string } }>(`/purchase-requisitions/${requisition.id}`, body) : api.post<{ data: { id: string } }>('/purchase-requisitions', body))).data.data;
    },
    onSuccess: (r) => { toastOk(); onSaved(r.id); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const lines = form.values.lines;

  return (
    <Modal opened={opened} onClose={onClose} size="xl" centered title={requisition ? t('req.edit') : t('req.new')}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <TextInput label={t('req.title_field')} required maxLength={200} {...form.getInputProps('title')} />
          <RichTextField label={t('req.purpose')} value={form.values.purpose} onChange={(v) => form.setFieldValue('purpose', v)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label={t('common.type')} required data={types.options} {...form.getInputProps('procurement_type_id')} />
            <Select label={t('req.cost_centre')} required searchable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
            <Select label={t('ev.project')} clearable searchable data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} {...form.getInputProps('project_id')} />
            <TextInput type="date" label={t('req.needed_by')} required {...form.getInputProps('needed_by')} />
            <TextInput label={t('req.delivery')} required maxLength={300} {...form.getInputProps('delivery_location')} />
            <CurrencySelect label={t('ev.currency')} value={form.values.currency_code} onChange={(c) => form.setFieldValue('currency_code', c)} error={form.errors.currency_code as string | undefined} required />
            <Select label={t('req.preferred_supplier')} description={t('req.preferred_help')} clearable searchable data={(suppliers.data ?? []).map((s) => ({ value: s.id, label: `${s.code} ${s.name}` }))} {...form.getInputProps('preferred_supplier_id')} />
            {form.values.preferred_supplier_id && <TextInput label={t('req.preferred_reason')} required maxLength={1000} {...form.getInputProps('preferred_supplier_reason')} />}
          </SimpleGrid>
          <Text fw={600} size="sm">{t('req.lines')}</Text>
          {lines.map((l, i) => (
            <SimpleGrid key={i} cols={{ base: 2, sm: 12 }} spacing="xs" style={{ alignItems: 'flex-end' }}>
              <TextInput style={{ gridColumn: 'span 2' }} className="req-line-desc" label={i === 0 ? t('req.line_description') : undefined} aria-label={t('req.line_description')} maxLength={500} {...form.getInputProps(`lines.${i}.description`)} />
              <NumberInput label={i === 0 ? t('req.quantity') : undefined} aria-label={t('req.quantity')} min={0.001} decimalScale={3} {...form.getInputProps(`lines.${i}.quantity`)} />
              <TextInput label={i === 0 ? t('req.unit') : undefined} aria-label={t('req.unit')} maxLength={30} {...form.getInputProps(`lines.${i}.unit`)} />
              <NumberInput label={i === 0 ? t('req.unit_price') : undefined} aria-label={t('req.unit_price')} min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps(`lines.${i}.unit_price`)} />
              <Group gap={4} wrap="nowrap" justify="space-between"><Text size="sm" fw={500}>{fmtCents(lineCents(l.quantity, l.unit_price), form.values.currency_code || null, i18n.language)}</Text>
                <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} disabled={lines.length === 1} onClick={() => form.removeListItem('lines', i)}><IconTrash size={16} /></ActionIcon></Group>
            </SimpleGrid>))}
          {typeof form.errors.lines === 'string' && <Text size="xs" c="red">{form.errors.lines}</Text>}
          <Group justify="space-between"><Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => form.insertListItem('lines', newLine())}>{t('req.add_line')}</Button>
            <Text fw={700}>{t('req.total')}: {fmtCents(totalCents(lines.map((l) => ({ quantity: l.quantity, unit_price: l.unit_price }))), form.values.currency_code || null, i18n.language)}</Text></Group>
          <Textarea label={t('req.exception')} description={t('req.exception_help')} autosize minRows={2} maxLength={1000} {...form.getInputProps('exception_reason')} />
          {requisition && <Alert color="blue" variant="light">{t('req.edit_notice')}</Alert>}
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}
