import { Alert, Badge, Button, Group, Modal, NumberInput, Stack, Switch, Table, Text, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';

interface Rate { id: string; name: string; rate_percent: string; valid_from: string; valid_to: string | null; is_default: boolean; source_citation: string | null; verification: string }

export function TaxRatesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState<{ name: string; rate_percent: number | string; valid_from: string; source_citation: string; is_default: boolean } | null>(null);
  const q = useQuery({ queryKey: ['tax-rates'], queryFn: async () => (await api.get<{ data: Rate[] }>('/tax-rates')).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['tax-rates'] });
  const create = useMutation({ mutationFn: async () => api.post('/tax-rates', open), onSuccess: () => { toastOk(); setOpen(null); refresh(); }, onError: toastError });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/tax-rates/${id}/verify`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('tax.title')} description={t('tax.intro')} actions={can('billing.configure') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen({ name: '', rate_percent: '', valid_from: new Date().toISOString().slice(0, 10), source_citation: '', is_default: true })}>{t('tax.new')}</Button> : undefined} />
      <Alert color="orange" variant="light" mb="md">{t('tax.legal_note')}</Alert>
      <Table.ScrollContainer minWidth={560}><Table withTableBorder striped><Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th>%</Table.Th><Table.Th>{t('tax.valid')}</Table.Th><Table.Th>{t('rules.source')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>{q.data?.map((r) => (
          <Table.Tr key={r.id}><Table.Td>{r.name} {r.is_default && <Badge size="xs" variant="light">{t('tax.default')}</Badge>}</Table.Td><Table.Td>{Number(r.rate_percent)}</Table.Td><Table.Td>{r.valid_from} → {r.valid_to ?? '∞'}</Table.Td><Table.Td><Text size="xs">{r.source_citation}</Text></Table.Td>
            <Table.Td>{r.verification === 'verified' ? <Badge color="green" variant="light">{t('rules.verification.verified')}</Badge> : can('rules.signoff') ? <Button size="compact-xs" onClick={() => verify.mutate(r.id)}>{t('rules.verify')}</Button> : <Badge color="red" variant="light">{t('rules.verification.unverified')}</Badge>}</Table.Td></Table.Tr>))}</Table.Tbody></Table></Table.ScrollContainer>
      {q.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('tax.none')}</Text>}
      <Modal opened={!!open} onClose={() => setOpen(null)} title={t('tax.new')} centered>
        {open && <Stack><TextInput label={t('common.name')} value={open.name} onChange={(e) => setOpen({ ...open, name: e.currentTarget.value })} />
          <Group grow><NumberInput label="%" min={0} max={100} decimalScale={4} value={open.rate_percent} onChange={(v) => setOpen({ ...open, rate_percent: v })} /><TextInput type="date" label={t('rates.effective_from')} value={open.valid_from} onChange={(e) => setOpen({ ...open, valid_from: e.currentTarget.value })} /></Group>
          <TextInput label={t('tax.source')} description={t('tax.source_note')} value={open.source_citation} onChange={(e) => setOpen({ ...open, source_citation: e.currentTarget.value })} />
          <Switch label={t('tax.default')} checked={open.is_default} onChange={(e) => setOpen({ ...open, is_default: e.currentTarget.checked })} />
          <Group justify="flex-end"><Button disabled={!open.name || open.rate_percent === '' || !open.source_citation} loading={create.isPending} onClick={() => create.mutate()}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
    </>
  );
}
