import { ActionIcon, Alert, Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { bandsError, VERIFY_COLOR } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Version { id: string; employee_rate: string | null; employer_rate: string | null; base_cap: string | null; valid_from: string; valid_to: string | null; source_citation: string; verification: string; prepared_by: string | null; verified_by: string | null; brackets: { lower: string; upper: string | null; rate: string }[] }
interface Scheme { id: string; code: string; name: string; statutory_type: string; mode: string; calc_order: number; base_kind: string; reduces_taxable_base: boolean; rounding: string; decimals: number; round_each_band: boolean; is_active: boolean; versions: Version[] }
type Band = { lower: number | string; upper: number | string | null; rate: number | string };

/**
 * Statutory schemes and their effective-dated versions. A version is entered with its source, stays "unverified" (shown, never applied) until a DIFFERENT person verifies it,
 * and a verified version is final: it is ended and a new one entered. Nothing is pre-filled.
 */
export function PaySchemesPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const types = useLookup('pay_statutory_type');
  const modes = useLookup('pay_scheme_mode');
  const bases = useLookup('pay_scheme_base');
  const roundings = useLookup('pay_rounding');
  const [schemeModal, setSchemeModal] = useState(false);
  const [verModal, setVerModal] = useState<Scheme | null>(null);
  const [ending, setEnding] = useState<Version | null>(null);
  const [endDate, setEndDate] = useState('');
  const [bands, setBands] = useState<Band[]>([{ lower: 0, upper: null, rate: 0 }]);
  const q = useQuery({ queryKey: ['pay-schemes'], queryFn: async () => (await api.get<{ data: Scheme[] }>('/payroll/schemes')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['pay-schemes'] }); void qc.invalidateQueries({ queryKey: ['pay-status'] }); };
  const sForm = useForm({ initialValues: { code: '', name: '', statutory_type_id: '', mode_id: '', calc_order: 1 as number | string, base_kind_id: '', reduces_taxable_base: null as string | null, rounding_id: '', decimals: 0 as number | string, round_each_band: false },
    validate: { reduces_taxable_base: (v) => (v === null ? t('pay.choose') : null) } });
  const vForm = useForm({ initialValues: { employee_rate: '' as number | string, employer_rate: '' as number | string, base_cap: '' as number | string, valid_from: '', valid_to: '', source_citation: '' } });
  const createScheme = useMutation({
    mutationFn: async (v: typeof sForm.values) => api.post('/payroll/schemes', { ...v, reduces_taxable_base: v.reduces_taxable_base === 'yes' }),
    onSuccess: () => { toastOk(); setSchemeModal(false); sForm.reset(); refresh(); }, onError: (e) => { sForm.setErrors(parseError(e).fields); toastError(e); },
  });
  const isBands = verModal?.mode === 'brackets';
  const bandErr = isBands ? bandsError(bands.map((b) => ({ lower: b.lower, upper: b.upper, rate: b.rate }))) : null;
  const createVersion = useMutation({
    mutationFn: async (v: typeof vForm.values) => api.post(`/payroll/schemes/${verModal!.id}/versions`, {
      employee_rate: isBands || v.employee_rate === '' ? undefined : v.employee_rate, employer_rate: v.employer_rate === '' ? undefined : v.employer_rate, base_cap: v.base_cap === '' ? undefined : v.base_cap,
      valid_from: v.valid_from, valid_to: v.valid_to || undefined, source_citation: v.source_citation, brackets: isBands ? bands.map((b) => ({ lower: b.lower, upper: b.upper === '' ? null : b.upper, rate: b.rate })) : undefined }),
    onSuccess: () => { toastOk(t('pay.version_saved')); setVerModal(null); vForm.reset(); refresh(); }, onError: (e) => { vForm.setErrors(parseError(e).fields); toastError(e); },
  });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/payroll/scheme-versions/${id}/verify`), onSuccess: () => { toastOk(t('pay.verified_ok')); refresh(); }, onError: toastError });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/payroll/scheme-versions/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const end = useMutation({ mutationFn: async () => api.post(`/payroll/scheme-versions/${ending!.id}/end`, { valid_to: endDate }), onSuccess: () => { toastOk(); setEnding(null); refresh(); }, onError: toastError });
  const label = (items: { code: string; label: string }[], code: string) => items.find((i) => i.code === code)?.label ?? code;
  const yn = [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }];
  const setBand = (i: number, patch: Partial<Band>) => setBands(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <>
      <Group justify="space-between" mb="sm" align="flex-start"><Text size="sm" c="dimmed" maw={700}>{t('pay.schemes_hint')}</Text>
        {can('hr.payroll.configure') && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setSchemeModal(true)}>{t('pay.add_scheme')}</Button>}</Group>
      <Stack gap="md">
        {(q.data ?? []).map((s) => (
          <Card key={s.id} withBorder padding="md">
            <Group justify="space-between" mb="xs" align="flex-start">
              <div><Text fw={600}>{s.name} <code>{s.code}</code></Text>
                <Text size="xs" c="dimmed">{label(types.items, s.statutory_type)} · {label(modes.items, s.mode)} · {t('pay.order')} {s.calc_order} · {label(bases.items, s.base_kind)} · {label(roundings.items, s.rounding)} / {s.decimals}{s.reduces_taxable_base ? ` · ${t('pay.reduces_base')}` : ''}</Text></div>
              {can('hr.payroll.configure') && <Button size="compact-xs" variant="light" onClick={() => { setVerModal(s); setBands([{ lower: 0, upper: null, rate: 0 }]); }}>{t('pay.add_version')}</Button>}
            </Group>
            <Table verticalSpacing={4} fz="sm">
              <Table.Tbody>
                {s.versions.map((v) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>{v.valid_from} → {v.valid_to ?? '…'}</Table.Td>
                    <Table.Td>{s.mode === 'brackets' ? <Text size="xs">{v.brackets.map((b) => `${Number(b.lower)}–${b.upper === null ? '…' : Number(b.upper)}: ${Number(b.rate)}%`).join(' | ')}{v.employer_rate ? ` · ${t('pay.employer')} ${Number(v.employer_rate)}%` : ''}</Text>
                      : <Text size="xs">{t('pay.employee')} {v.employee_rate === null ? '—' : `${Number(v.employee_rate)}%`} · {t('pay.employer')} {v.employer_rate === null ? '—' : `${Number(v.employer_rate)}%`}{v.base_cap ? ` · ${t('pay.cap')} ${Number(v.base_cap)}` : ''}</Text>}</Table.Td>
                    <Table.Td><Text size="xs" lineClamp={2}>{v.source_citation}</Text><Text size="xs" c="dimmed">{v.prepared_by}{v.verified_by ? ` → ${v.verified_by}` : ''}</Text></Table.Td>
                    <Table.Td><Badge variant={v.verification === 'verified' ? 'light' : 'filled'} color={VERIFY_COLOR[v.verification]}>{t(`pay.verification.${v.verification}`)}</Badge></Table.Td>
                    <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                      {v.verification !== 'verified' && can('hr.payroll.verify') && <Button size="compact-xs" color="green" variant="light" loading={verify.isPending} onClick={() => verify.mutate(v.id)}>{t('pay.verify')}</Button>}
                      {v.verification === 'verified' && !v.valid_to && can('hr.payroll.configure') && <Button size="compact-xs" variant="subtle" onClick={() => { setEnding(v); setEndDate(''); }}>{t('pay.end')}</Button>}
                      {v.verification !== 'verified' && can('hr.payroll.configure') && <Tooltip label={t('common.delete')}><ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => del.mutate(v.id)}><IconTrash size={14} /></ActionIcon></Tooltip>}
                    </Group></Table.Td>
                  </Table.Tr>))}
                {s.versions.length === 0 && <Table.Tr><Table.Td><Text size="sm" c="dimmed">{t('pay.no_version')}</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Card>))}
        {q.data?.length === 0 && <Text size="sm" c="dimmed">{t('pay.none_yet')}</Text>}
      </Stack>

      <Modal opened={schemeModal} onClose={() => setSchemeModal(false)} title={t('pay.add_scheme')} centered size="lg">
        <form onSubmit={sForm.onSubmit((v) => createScheme.mutate(v))}><Stack gap="sm">
          <Alert color="orange" variant="light">{t('pay.scheme_fixed')}</Alert>
          <Group grow align="flex-start"><TextInput label={t('pay.code')} description="a-z 0-9 _" required maxLength={40} {...sForm.getInputProps('code')} /><TextInput label={t('common.name')} required maxLength={150} {...sForm.getInputProps('name')} /></Group>
          <Group grow align="flex-start"><Select label={t('pay.statutory_type')} required data={types.options} {...sForm.getInputProps('statutory_type_id')} /><Select label={t('pay.mode')} required data={modes.options} {...sForm.getInputProps('mode_id')} /></Group>
          <Group grow align="flex-start"><NumberInput label={t('pay.order')} description={t('pay.order_hint')} required min={0} {...sForm.getInputProps('calc_order')} /><Select label={t('pay.base_kind')} required data={bases.options} {...sForm.getInputProps('base_kind_id')} /></Group>
          <Group grow align="flex-start"><Select label={t('pay.rounding')} required data={roundings.options} {...sForm.getInputProps('rounding_id')} /><NumberInput label={t('pay.decimals')} description={t('pay.decimals_hint')} required min={0} max={2} {...sForm.getInputProps('decimals')} /></Group>
          <Group grow align="flex-start"><Select label={t('pay.reduces_base')} description={t('pay.reduces_base_hint')} required data={yn} {...sForm.getInputProps('reduces_taxable_base')} /><Switch mt={28} label={t('pay.round_each_band')} {...sForm.getInputProps('round_each_band', { type: 'checkbox' })} /></Group>
          <Group justify="flex-end"><Button variant="default" onClick={() => setSchemeModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={createScheme.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={!!verModal} onClose={() => setVerModal(null)} title={`${t('pay.add_version')} — ${verModal?.code ?? ''}`} centered size="lg">
        <form onSubmit={vForm.onSubmit((v) => createVersion.mutate(v))}><Stack gap="sm">
          <Alert color="blue" variant="light">{t('pay.version_unverified_note')}</Alert>
          {!isBands && <Group grow align="flex-start"><NumberInput label={`${t('pay.employee')} %`} min={0} max={100} decimalScale={6} {...vForm.getInputProps('employee_rate')} /><NumberInput label={`${t('pay.employer')} %`} min={0} max={100} decimalScale={6} {...vForm.getInputProps('employer_rate')} /></Group>}
          {isBands && <Stack gap={6}><Text size="sm" fw={500}>{t('pay.bands_title')}</Text>
            {bands.map((b, i) => (
              <Group key={i} gap="xs" align="flex-end" wrap="nowrap">
                <NumberInput label={i === 0 ? t('pay.from') : undefined} min={0} value={b.lower} onChange={(n) => setBand(i, { lower: n })} thousandSeparator=" " />
                <NumberInput label={i === 0 ? t('pay.up_to') : undefined} placeholder="∞" min={0} value={b.upper ?? ''} onChange={(n) => setBand(i, { upper: n === '' ? null : n })} thousandSeparator=" " />
                <NumberInput label={i === 0 ? '%' : undefined} min={0} max={100} decimalScale={6} value={b.rate} onChange={(n) => setBand(i, { rate: n })} />
                <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} disabled={bands.length === 1} onClick={() => setBands(bands.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon>
              </Group>))}
            <Group><Button size="compact-xs" variant="light" onClick={() => setBands([...bands.map((b, i) => (i === bands.length - 1 && (b.upper === null || b.upper === '') ? { ...b, upper: Number(b.lower) + 1 } : b)), { lower: Number(bands[bands.length - 1]?.upper ?? 0) || 0, upper: null, rate: 0 }])}>{t('pay.add_band')}</Button>
              {bandErr && <Text size="xs" c="red">{t(`pay.band_error.${bandErr}`)}</Text>}</Group></Stack>}
          <Group grow align="flex-start">{isBands && <NumberInput label={`${t('pay.employer')} %`} min={0} max={100} decimalScale={6} {...vForm.getInputProps('employer_rate')} />}<NumberInput label={t('pay.cap')} description={t('pay.cap_hint')} min={0} thousandSeparator=" " {...vForm.getInputProps('base_cap')} /></Group>
          <Group grow align="flex-start"><TextInput type="date" label={t('leave.valid_from')} required {...vForm.getInputProps('valid_from')} /><TextInput type="date" label={t('leave.valid_to')} {...vForm.getInputProps('valid_to')} /></Group>
          <TextInput label={t('leave.source')} description={t('pay.source_hint')} required maxLength={500} {...vForm.getInputProps('source_citation')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setVerModal(null)}>{t('common.cancel')}</Button><Button type="submit" disabled={!!bandErr} loading={createVersion.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={!!ending} onClose={() => setEnding(null)} title={t('pay.end')} centered size="sm">
        <Stack gap="sm"><Text size="sm" c="dimmed">{t('pay.end_hint')}</Text><TextInput type="date" label={t('leave.valid_to')} required value={endDate} onChange={(e) => setEndDate(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setEnding(null)}>{t('common.cancel')}</Button><Button disabled={!endDate} loading={end.isPending} onClick={() => end.mutate()}>{t('common.save')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
