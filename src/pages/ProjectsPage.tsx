import { Badge, Button, Group, Modal, NumberInput, Select, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { CurrencySelect } from '@/components/CurrencySelect';
import { RichTextField } from '@/components/RichTextField';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Row { id: string; code: string; name: string; status: string; status_id: string; owner: string | null; client: string | null; start_date: string | null; end_date: string | null }
interface MyTask { id: string; key: string; project_id: string; project: string; title: string; status: string; priority: string; due_date: string | null; overdue: boolean }
const PROJECT_COLOR: Record<string, string> = { planning: 'gray', active: 'green', on_hold: 'orange', completed: 'blue', cancelled: 'gray' };
const PRIORITY_COLOR: Record<string, string> = { low: 'gray', normal: 'blue', high: 'orange', urgent: 'red' };
const blank = { code: '', name: '', description: '', client_id: null as string | null, start_date: '', end_date: '', budget_amount: '' as number | string, currency_code: '' };

export function ProjectsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const statuses = useLookup('project_status');
  const [open, setOpen] = useState(false);
  const form = useForm({ initialValues: blank });
  const clients = useQuery({ queryKey: ['client-options'], enabled: can('client.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/clients', { params: { per_page: 100 } })).data.data });
  const mine = useQuery({ queryKey: ['my-tasks'], queryFn: async () => (await api.get<{ data: MyTask[] }>('/my-tasks')).data.data });

  const create = useMutation({
    mutationFn: async (v: typeof blank) => (await api.post<{ data: { id: string } }>('/projects', { ...v, budget_amount: v.budget_amount === '' ? null : v.budget_amount })).data.data,
    onSuccess: (p) => { toastOk(); setOpen(false); void qc.invalidateQueries({ queryKey: ['projects'] }); nav(`/projects/${p.id}`); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const columns: Column<Row>[] = [
    { key: 'code', label: t('common.code'), sortable: true, render: (r) => <Badge variant="outline">{r.code}</Badge> },
    { key: 'name', label: t('common.name'), sortable: true, render: (r) => <div><Text size="sm" fw={600}>{r.name}</Text><Text size="xs" c="dimmed">{r.client ?? ''}</Text></div> },
    { key: 'status', label: t('common.status'), render: (r) => <Badge color={PROJECT_COLOR[r.status]} variant="light">{statuses.byId(r.status_id)?.label ?? r.status}</Badge> },
    { key: 'owner', label: t('projects.owner'), visibleFrom: 'md', render: (r) => r.owner ?? '—' },
    { key: 'end_date', label: t('projects.end_date'), sortable: true, visibleFrom: 'md', render: (r) => r.end_date ?? '—' },
  ];

  return (
    <>
      <PageHeader title={t('projects.title')} />
      <Tabs defaultValue="projects">
        <Tabs.List mb="md"><Tabs.Tab value="projects">{t('projects.title')}</Tabs.Tab><Tabs.Tab value="mine">{t('projects.my_tasks')}{mine.data?.length ? ` (${mine.data.length})` : ''}</Tabs.Tab></Tabs.List>
        <Tabs.Panel value="projects">
          <DataList<Row> title={t('projects.title')} endpoint="/projects" queryKey="projects" columns={columns} defaultSort={{ key: 'name', direction: 'asc' }}
            filters={[{ key: 'status_id', label: t('common.status'), options: statuses.options }]} onRowClick={(r) => nav(`/projects/${r.id}`)}
            toolbar={can('project.create') ? <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>{t('projects.new')}</Button> : undefined} />
        </Tabs.Panel>
        <Tabs.Panel value="mine">
          {mine.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('projects.no_tasks')}</Text>}
          <Table.ScrollContainer minWidth={520}><Table withTableBorder highlightOnHover><Table.Tbody>
            {mine.data?.map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td><Text component={Link} to={`/projects/${x.project_id}?task=${x.id}`} size="sm" fw={600}>{x.key} · {x.title}</Text><Text size="xs" c="dimmed">{x.project}</Text></Table.Td>
                <Table.Td><Badge variant="light">{t(`projects.s.${x.status}`)}</Badge></Table.Td>
                <Table.Td><Badge color={PRIORITY_COLOR[x.priority]} variant="dot">{t(`projects.p.${x.priority}`)}</Badge></Table.Td>
                <Table.Td><Text size="xs" c={x.overdue ? 'red' : 'dimmed'}>{x.due_date ?? '—'}</Text></Table.Td>
              </Table.Tr>))}
          </Table.Tbody></Table></Table.ScrollContainer>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={open} onClose={() => setOpen(false)} title={t('projects.new')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}><Stack gap="sm">
          <Group grow><TextInput label={t('common.name')} required {...form.getInputProps('name')} /></Group>
          <RichTextField label={t('common.description')} minHeight={100} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} />
          {can('client.view') && <Select label={t('projects.client')} clearable searchable data={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))} {...form.getInputProps('client_id')} />}
          <Group grow><TextInput type="date" label={t('projects.start_date')} {...form.getInputProps('start_date')} /><TextInput type="date" label={t('projects.end_date')} {...form.getInputProps('end_date')} /></Group>
          <Group grow><NumberInput label={t('projects.budget')} thousandSeparator min={0} {...form.getInputProps('budget_amount')} /><CurrencySelect label={t('projects.currency')} {...form.getInputProps('currency_code')} /></Group>
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
    </>
  );
}
