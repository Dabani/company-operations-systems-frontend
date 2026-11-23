import { ActionIcon, Alert, Button, Checkbox, Group, Modal, NumberInput, Select, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { COMPONENT_SOURCES, SCHEME_SOURCES } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { PayComponent } from '@/components/payroll/PayComponentsPanel';

interface Col { header: string; source: string; scheme_id: string; component_id: string; constant: string; format: string; decimals: number | string; width: number | string; align: string; pad_char: string; truncate: boolean }
const blankCol = (): Col => ({ header: '', source: '', scheme_id: '', component_id: '', constant: '', format: 'text', decimals: '', width: '', align: '', pad_char: '', truncate: false });

/**
 * Define an export layout. Nothing about a bank or statutory format is built in: the accountant defines the columns, records WHO AGREED the layout, and a second person verifies it
 * before a file can be generated. A preview with invented rows is available once it is saved.
 */
export function ExportProfileModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const kinds = useLookup('pay_export_kind');
  const layouts = useLookup('pay_export_layout');
  const [f, setF] = useState({ code: '', name: '', kind_id: '', layout_id: '', delimiter: ';', quote_char: '"', line_ending: 'LF', encoding: 'UTF-8', decimal_separator: '.', date_format: 'Y-m-d', include_header: true, header_template: '', trailer_template: '', file_extension: 'csv', filename_template: 'payroll-{run_code}', agreed_with: '' });
  const [cols, setCols] = useState<Col[]>([blankCol()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = useQuery({ queryKey: ['pay-export-fields'], enabled: opened, queryFn: async () => (await api.get<{ data: Record<string, { sources: string[]; run_statuses: string[] }> }>('/payroll/export/fields')).data.data });
  const schemes = useQuery({ queryKey: ['pay-schemes'], enabled: opened, queryFn: async () => (await api.get<{ data: { id: string; code: string; name: string }[] }>('/payroll/schemes')).data.data });
  const comps = useQuery({ queryKey: ['pay-components'], enabled: opened, queryFn: async () => (await api.get<{ data: PayComponent[] }>('/payroll/components')).data.data });
  const kind = kinds.items.find((k) => k.id === f.kind_id)?.code ?? '';
  const layout = layouts.items.find((k) => k.id === f.layout_id)?.code ?? '';
  const sources = fields.data?.[kind]?.sources ?? [];
  const save = useMutation({
    mutationFn: async () => api.post('/payroll/export-profiles', { ...f, delimiter: layout === 'delimited' ? f.delimiter : undefined, quote_char: f.quote_char || undefined, header_template: f.header_template || undefined, trailer_template: f.trailer_template || undefined,
      columns: cols.map((c) => ({ header: c.header, source: c.source, scheme_id: c.scheme_id || undefined, component_id: c.component_id || undefined, constant: c.source === 'constant' ? c.constant : undefined, format: c.format,
        decimals: c.decimals === '' ? undefined : c.decimals, width: c.width === '' ? undefined : c.width, align: c.align || undefined, pad_char: c.pad_char || undefined, truncate: c.truncate })) }),
    onSuccess: () => { toastOk(t('pay.layout_saved')); void qc.invalidateQueries({ queryKey: ['pay-profiles'] }); onClose(); },
    onError: (e) => { setErrors(parseError(e).fields); toastError(e); },
  });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const setCol = (i: number, patch: Partial<Col>) => setCols(cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const err = (k: string) => errors[k];
  return (
    <Modal opened={opened} onClose={onClose} title={t('pay.add_layout')} centered size="xl">
      <Stack gap="sm">
        <Alert color="blue" variant="light">{t('pay.layout_note')}</Alert>
        <Group grow align="flex-start"><TextInput label={t('pay.code')} description="a-z 0-9 _" required maxLength={40} value={f.code} onChange={(e) => set({ code: e.currentTarget.value })} error={err('code')} /><TextInput label={t('common.name')} required maxLength={150} value={f.name} onChange={(e) => set({ name: e.currentTarget.value })} error={err('name')} /></Group>
        <Group grow align="flex-start"><Select label={t('pay.export_kind')} required data={kinds.options} value={f.kind_id} onChange={(v) => { set({ kind_id: v ?? '' }); setCols([blankCol()]); }} error={err('kind_id')} /><Select label={t('pay.layout_type')} required data={layouts.options} value={f.layout_id} onChange={(v) => set({ layout_id: v ?? '' })} error={err('layout_id')} /></Group>
        <TextInput label={t('pay.agreed_with')} description={t('pay.agreed_hint')} required maxLength={255} value={f.agreed_with} onChange={(e) => set({ agreed_with: e.currentTarget.value })} error={err('agreed_with')} />
        <Group grow align="flex-start">
          {layout === 'delimited' && <TextInput label={t('pay.delimiter')} maxLength={4} value={f.delimiter} onChange={(e) => set({ delimiter: e.currentTarget.value })} error={err('delimiter')} />}
          <TextInput label={t('pay.quote')} maxLength={1} value={f.quote_char} onChange={(e) => set({ quote_char: e.currentTarget.value })} />
          <Select label={t('pay.line_ending')} data={['LF', 'CRLF']} allowDeselect={false} value={f.line_ending} onChange={(v) => set({ line_ending: v ?? 'LF' })} />
          <Select label={t('pay.encoding')} data={['UTF-8', 'ISO-8859-1']} allowDeselect={false} value={f.encoding} onChange={(v) => set({ encoding: v ?? 'UTF-8' })} />
          <Select label={t('pay.decimal_sep')} data={[{ value: '.', label: '.' }, { value: ',', label: ',' }]} allowDeselect={false} value={f.decimal_separator} onChange={(v) => set({ decimal_separator: v ?? '.' })} />
        </Group>
        <Group grow align="flex-start"><TextInput label={t('pay.date_format')} description="Y-m-d, d/m/Y, Ymd" value={f.date_format} onChange={(e) => set({ date_format: e.currentTarget.value })} error={err('date_format')} /><TextInput label={t('pay.file_ext')} value={f.file_extension} onChange={(e) => set({ file_extension: e.currentTarget.value })} /><TextInput label={t('pay.file_name')} description="{run_code} {period_to} {kind}" value={f.filename_template} onChange={(e) => set({ filename_template: e.currentTarget.value })} error={err('filename_template')} /></Group>
        {layout === 'delimited' && <Switch label={t('pay.include_header')} checked={f.include_header} onChange={(e) => set({ include_header: e.currentTarget.checked })} />}
        <Group grow align="flex-start"><Textarea label={t('pay.header_tpl')} description="{run_code} {period_from} {period_to} {paid_on} {currency} {count} {total} {generated_on}" autosize minRows={1} value={f.header_template} onChange={(e) => set({ header_template: e.currentTarget.value })} />
          <Textarea label={t('pay.trailer_tpl')} autosize minRows={1} value={f.trailer_template} onChange={(e) => set({ trailer_template: e.currentTarget.value })} error={err('layout')} /></Group>

        <Text fw={600} size="sm" mt="xs">{t('pay.columns')}</Text>
        {cols.map((c, i) => (
          <Group key={i} gap="xs" align="flex-end" wrap="wrap">
            <TextInput w={130} label={i === 0 ? t('pay.col_header') : undefined} value={c.header} onChange={(e) => setCol(i, { header: e.currentTarget.value })} />
            <Select w={190} searchable label={i === 0 ? t('pay.col_source') : undefined} data={sources} value={c.source} onChange={(v) => setCol(i, { source: v ?? '' })} error={err(`columns.${i}.source`)} />
            {SCHEME_SOURCES.includes(c.source) && <Select w={150} label={i === 0 ? t('pay.scheme') : undefined} data={(schemes.data ?? []).map((s) => ({ value: s.id, label: s.code }))} value={c.scheme_id} onChange={(v) => setCol(i, { scheme_id: v ?? '' })} />}
            {COMPONENT_SOURCES.includes(c.source) && <Select w={150} label={i === 0 ? t('pay.component') : undefined} data={(comps.data ?? []).map((x) => ({ value: x.id, label: x.code }))} value={c.component_id} onChange={(v) => setCol(i, { component_id: v ?? '' })} />}
            {c.source === 'constant' && <TextInput w={120} label={i === 0 ? t('pay.constant') : undefined} value={c.constant} onChange={(e) => setCol(i, { constant: e.currentTarget.value })} />}
            <Select w={130} label={i === 0 ? t('pay.col_format') : undefined} allowDeselect={false} data={['text', 'amount', 'integer_minor', 'integer', 'date']} value={c.format} onChange={(v) => setCol(i, { format: v ?? 'text' })} />
            <NumberInput w={80} label={i === 0 ? t('pay.decimals') : undefined} min={0} max={4} value={c.decimals} onChange={(n) => setCol(i, { decimals: n })} />
            {layout === 'fixed_width' && <><NumberInput w={80} label={i === 0 ? t('pay.width') : undefined} min={1} value={c.width} onChange={(n) => setCol(i, { width: n })} error={err(`columns.${i}.width`)} />
              <Select w={90} label={i === 0 ? t('pay.align') : undefined} clearable data={['left', 'right']} value={c.align || null} onChange={(v) => setCol(i, { align: v ?? '' })} />
              <TextInput w={60} label={i === 0 ? t('pay.pad') : undefined} maxLength={1} value={c.pad_char} onChange={(e) => setCol(i, { pad_char: e.currentTarget.value })} />
              <Checkbox mb={8} label={t('pay.truncate')} checked={c.truncate} onChange={(e) => setCol(i, { truncate: e.currentTarget.checked })} /></>}
            <ActionIcon variant="subtle" color="red" mb={4} aria-label={t('common.delete')} disabled={cols.length === 1} onClick={() => setCols(cols.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon>
          </Group>))}
        <Group><Button size="compact-xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setCols([...cols, blankCol()])}>{t('pay.add_column')}</Button></Group>
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={save.isPending} disabled={!f.code || !f.name || !f.kind_id || !f.layout_id || !f.agreed_with.trim() || cols.some((c) => !c.header || !c.source)} onClick={() => save.mutate()}>{t('common.save')}</Button></Group>
      </Stack>
    </Modal>
  );
}
