import { Alert, Anchor, Badge, Button, Group, Modal, Paper, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCircleCheck, IconEdit, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV } from '@/types';

interface Ref { id: string; code: string; title: string; citation: string | null; jurisdiction: string | null; topic: string | null; url: string | null; notes: string | null; status: LV; verified_by: string | null; verified_at: string | null }
const empty = { code: '', title: '', citation: '', jurisdiction: '', topic: '', url: '', notes: '', status_id: null as string | null };

export function LegalReferencesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('compliance.manage');
  const [editing, setEditing] = useState<Ref | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const statuses = useLookup('legal_status');
  const q = useQuery({ queryKey: ['legal-refs'], queryFn: async () => (await api.get<{ data: Ref[] }>('/legal-references')).data.data });
  const form = useForm({ initialValues: empty, validate: { code: (v) => (v.trim() ? null : t('leg.code')), title: (v) => (v.trim() ? null : t('case.subject')) } });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['legal-refs'] });

  const open = (x: Ref | 'new') => { setEditing(x); form.setValues(x === 'new' ? empty : { code: x.code, title: x.title, citation: x.citation ?? '', jurisdiction: x.jurisdiction ?? '', topic: x.topic ?? '', url: x.url ?? '', notes: x.notes ?? '', status_id: x.status.id }); };
  const save = useMutation({
    mutationFn: async (v: typeof empty) => { const body = { ...v, url: v.url || null }; return editing === 'new' ? api.post('/legal-references', body) : api.patch(`/legal-references/${(editing as Ref).id}`, body); },
    onSuccess: () => { toastOk(); setEditing(null); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/legal-references/${id}/verify`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  const rows = (q.data ?? []).filter((x) => !search || `${x.code} ${x.title} ${x.topic ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const hasUnverified = (q.data ?? []).some((x) => x.status.code === 'unreviewed');

  return (
    <>
      <PageHeader title={t('leg.title')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('leg.new')}</Button> : undefined} />
      <Stack gap="md">
        {hasUnverified && <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">{t('leg.unverified_note')}</Alert>}
        <TextInput placeholder={t('common.search_placeholder')} value={search} onChange={(e) => setSearch(e.currentTarget.value)} maw={360} />
        <Paper withBorder>
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm" striped="odd">
              <Table.Thead><Table.Tr><Table.Th>{t('leg.code')}</Table.Th><Table.Th>{t('case.subject')}</Table.Th><Table.Th>{t('leg.topic')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>{rows.map((x) => (
                <Table.Tr key={x.id}>
                  <Table.Td><Badge variant="outline" ff="monospace">{x.code}</Badge></Table.Td>
                  <Table.Td><Text size="sm" fw={600}>{x.title}</Text>{x.citation && <Text size="xs" c="dimmed" lineClamp={2}>{x.citation}</Text>}{x.notes && <Text size="xs" c="dimmed" lineClamp={2}>{x.notes}</Text>}{x.url && <Anchor size="xs" href={x.url} target="_blank" rel="noopener noreferrer">{x.url}</Anchor>}</Table.Td>
                  <Table.Td><Text size="sm">{x.topic ?? '—'}</Text><Text size="xs" c="dimmed">{x.jurisdiction}</Text></Table.Td>
                  <Table.Td><StatusBadge label={x.status.label} color={x.status.color} />{x.verified_by && <Text size="xs" c="dimmed">{x.verified_by} · {x.verified_at ? fmtDateTime(x.verified_at, i18n.language) : ''}</Text>}</Table.Td>
                  <Table.Td>{manage && <Group gap={4} wrap="nowrap">
                    {x.status.code !== 'verified' && <Button size="compact-xs" variant="light" color="green" leftSection={<IconCircleCheck size={14} />} loading={verify.isPending} onClick={() => verify.mutate(x.id)}>{t('leg.verify')}</Button>}
                    <Button size="compact-xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => open(x)}>{t('common.edit')}</Button></Group>}</Table.Td>
                </Table.Tr>))}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {rows.length === 0 && <Text c="dimmed" size="sm" ta="center" py="xl">{t('common.no_data')}</Text>}
        </Paper>
      </Stack>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('leg.new') : t('common.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start"><TextInput label={t('leg.code')} required {...form.getInputProps('code')} /><Select label={t('common.status')} data={statuses.options} clearable {...form.getInputProps('status_id')} /></Group>
            <TextInput label={t('case.subject')} required {...form.getInputProps('title')} />
            <TextInput label={t('leg.citation')} {...form.getInputProps('citation')} />
            <Group grow align="flex-start"><TextInput label={t('leg.jurisdiction')} {...form.getInputProps('jurisdiction')} /><TextInput label={t('leg.topic')} {...form.getInputProps('topic')} /></Group>
            <TextInput label={t('leg.url')} {...form.getInputProps('url')} />
            <TextInput label={t('leg.notes')} {...form.getInputProps('notes')} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
