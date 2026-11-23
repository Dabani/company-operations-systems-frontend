import { Alert, Badge, Button, Group, Modal, NumberInput, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

export interface PayComponent { id: string; code: string; name: string; kind: string; source: string; is_taxable: boolean; is_pensionable: boolean; ledger_account: string | null; is_active: boolean }

/** Pay components. The tax flags have NO default and cannot change after creation: the accountant decides each one. */
export function PayComponentsPanel() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const kinds = useLookup('pay_component_kind');
  const sources = useLookup('pay_component_source');
  const [modal, setModal] = useState(false);
  const form = useForm({ initialValues: { code: '', name: '', kind_id: '', source_id: '', is_taxable: null as string | null, is_pensionable: null as string | null, ledger_account: '', sort_order: 0 as number | string },
    validate: { is_taxable: (v) => (v === null ? t('pay.choose') : null), is_pensionable: (v) => (v === null ? t('pay.choose') : null) } });
  const q = useQuery({ queryKey: ['pay-components'], queryFn: async () => (await api.get<{ data: PayComponent[] }>('/payroll/components')).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['pay-components'] }); void qc.invalidateQueries({ queryKey: ['pay-status'] }); };
  const create = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/payroll/components', { ...v, is_taxable: v.is_taxable === 'yes', is_pensionable: v.is_pensionable === 'yes', ledger_account: v.ledger_account || undefined }),
    onSuccess: () => { toastOk(); setModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const toggle = useMutation({ mutationFn: async (c: PayComponent) => api.patch(`/payroll/components/${c.id}`, { is_active: !c.is_active }), onSuccess: refresh, onError: toastError });
  const yn = [{ value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }];
  return (
    <>
      <Group justify="space-between" mb="sm" align="flex-start"><Text size="sm" c="dimmed" maw={680}>{t('pay.components_hint')}</Text>
        {can('hr.payroll.configure') && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button>}</Group>
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>{t('pay.code')}</Table.Th><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('pay.source')}</Table.Th><Table.Th>{t('pay.taxable')}</Table.Th><Table.Th>{t('pay.pensionable')}</Table.Th><Table.Th>{t('pay.ledger')}</Table.Th><Table.Th>{t('common.active')}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((c) => (
            <Table.Tr key={c.id}><Table.Td><code>{c.code}</code></Table.Td><Table.Td>{c.name}</Table.Td>
              <Table.Td><Badge variant="light" color={c.kind === 'earning' ? 'green' : 'orange'}>{kinds.items.find((k) => k.code === c.kind)?.label ?? c.kind}</Badge></Table.Td>
              <Table.Td>{sources.items.find((k) => k.code === c.source)?.label ?? c.source}</Table.Td>
              <Table.Td>{c.is_taxable ? t('common.yes') : t('common.no')}</Table.Td><Table.Td>{c.is_pensionable ? t('common.yes') : t('common.no')}</Table.Td><Table.Td>{c.ledger_account}</Table.Td>
              <Table.Td><Switch checked={c.is_active} disabled={!can('hr.payroll.configure')} aria-label={c.code} onChange={() => toggle.mutate(c)} /></Table.Td></Table.Tr>))}
          {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={8}><Text size="sm" c="dimmed">{t('pay.none_yet')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
      <Modal opened={modal} onClose={() => setModal(false)} title={t('pay.add_component')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Alert color="orange" variant="light">{t('pay.flags_fixed')}</Alert>
          <Group grow align="flex-start"><TextInput label={t('pay.code')} description="a-z 0-9 _" required maxLength={40} {...form.getInputProps('code')} /><TextInput label={t('common.name')} required maxLength={150} {...form.getInputProps('name')} /></Group>
          <Group grow align="flex-start"><Select label={t('common.type')} required data={kinds.options} {...form.getInputProps('kind_id')} /><Select label={t('pay.source')} required data={sources.options} {...form.getInputProps('source_id')} /></Group>
          <Group grow align="flex-start"><Select label={t('pay.taxable')} required data={yn} {...form.getInputProps('is_taxable')} /><Select label={t('pay.pensionable')} required data={yn} {...form.getInputProps('is_pensionable')} /></Group>
          <Group grow align="flex-start"><TextInput label={t('pay.ledger')} maxLength={40} {...form.getInputProps('ledger_account')} /><NumberInput label={t('pay.order')} min={0} {...form.getInputProps('sort_order')} /></Group>
          <Group justify="flex-end"><Button variant="default" onClick={() => setModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
