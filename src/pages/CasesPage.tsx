import { Anchor, Badge, Button, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { StatusBadge } from '@/components/StatusBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { fmtDateTime } from '@/lib/format';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

export interface LV { id: string; code: string; label: string; color: string | null }
export interface Person { id: string; name: string; has_avatar: boolean }
interface CaseRow { id: string; reference: string; title: string; type: LV; status: LV; priority: LV; requester: Person; assignee: Person | null; created_at: string }

export function CasesPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine'>(can('case.view_all') ? 'all' : 'mine');

  const types = useLookup('case_type'); const statuses = useLookup('case_status'); const priorities = useLookup('case_priority');
  const depts = useQuery({ queryKey: ['dept-options'], enabled: can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });

  const form = useForm({
    initialValues: { title: '', type_id: null as string | null, priority_id: null as string | null, department_id: null as string | null, description: '' },
    validate: { title: (v) => (v.trim() ? null : t('case.subject')), type_id: (v) => (v ? null : t('case.type')) },
  });

  // Opened from the chat widget: /cases?new=1
  useEffect(() => { if (params.get('new')) { setCreating(true); params.delete('new'); setParams(params, { replace: true }); } }, [params, setParams]);
  useEffect(() => {
    if (creating && !form.values.priority_id) { const n = priorities.items.find((p) => p.code === 'normal'); if (n) form.setFieldValue('priority_id', n.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating, priorities.items.length]);

  const create = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post<{ data: { id: string; reference: string } }>('/cases', v)).data.data,
    onSuccess: (c) => { toastOk(t('case.submitted', { ref: c.reference })); setCreating(false); form.reset(); void qc.invalidateQueries({ queryKey: ['cases'] }); nav(`/cases/${c.id}`); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const columns: Column<CaseRow>[] = [
    { key: 'reference', label: t('case.reference'), sortable: true, render: (c) => <Anchor size="sm" fw={600} ff="monospace" onClick={() => nav(`/cases/${c.id}`)}>{c.reference}</Anchor> },
    { key: 'title', label: t('case.subject'), sortable: true, render: (c) => <div><Text size="sm" fw={600} lineClamp={1}>{c.title}</Text><Text size="xs" c="dimmed">{c.requester.name}</Text></div> },
    { key: 'type', label: t('case.type'), visibleFrom: 'md', render: (c) => <Badge variant="outline" color={c.type.color ?? 'gray'}>{c.type.label}</Badge> },
    { key: 'priority', label: t('case.priority'), visibleFrom: 'sm', render: (c) => <StatusBadge label={c.priority.label} color={c.priority.color} /> },
    { key: 'status', label: t('common.status'), render: (c) => <StatusBadge label={c.status.label} color={c.status.color} /> },
    { key: 'assignee', label: t('case.assignee'), visibleFrom: 'lg', render: (c) => c.assignee ? <Group gap={6} wrap="nowrap"><UserAvatar userId={c.assignee.id} hasAvatar={c.assignee.has_avatar} name={c.assignee.name} size={22} /><Text size="xs">{c.assignee.name}</Text></Group> : <Text size="xs" c="dimmed">{t('case.unassigned')}</Text> },
    { key: 'created_at', label: t('common.created_at'), sortable: true, visibleFrom: 'lg', render: (c) => fmtDateTime(c.created_at, i18n.language) },
  ];

  return (
    <>
      <PageHeader title={t('case.title')} />
      <DataList<CaseRow>
        title={t('case.title')} endpoint="/cases" queryKey="cases" columns={columns} defaultSort={{ key: 'created_at', direction: 'desc' }}
        extraParams={scope === 'mine' ? { mine: 1 } : undefined} onRowClick={(c) => nav(`/cases/${c.id}`)}
        filters={[
          { key: 'status_id', label: t('common.status'), options: statuses.options },
          { key: 'type_id', label: t('case.type'), options: types.options },
          { key: 'priority_id', label: t('case.priority'), options: priorities.options },
        ]}
        toolbar={<>
          {can('case.view_all') && <SegmentedControl value={scope} onChange={(v) => setScope(v as 'all' | 'mine')} data={[{ value: 'all', label: t('case.all') }, { value: 'mine', label: t('case.mine') }]} />}
          {can('case.create') && <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>{t('case.new')}</Button>}
        </>}
      />

      <Modal opened={creating} onClose={() => setCreating(false)} title={t('case.new')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('case.subject')} required maxLength={200} {...form.getInputProps('title')} />
            <Group grow align="flex-start">
              <Select label={t('case.type')} required data={types.options} {...form.getInputProps('type_id')} />
              <Select label={t('case.priority')} data={priorities.options} {...form.getInputProps('priority_id')} />
            </Group>
            {can('department.view') && <Select label={t('case.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />}
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} error={form.errors.description as string} minHeight={160} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setCreating(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('case.send')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
