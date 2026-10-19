import { Badge, Button, Group, Modal, SegmentedControl, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCircleCheck, IconPlus, IconUserOff } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { StatusBadge } from '@/components/StatusBadge';
import { fmtDateTime } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface Row {
  id: string; user: { id: string; name: string; email: string }; resource: LV; level: LV; justification: string | null; granted_by: string | null; granted_at: string;
  expires_on: string | null; state: 'active' | 'expired' | 'revoked'; last_reviewed_at: string | null; revoked_at: string | null; revoked_by: string | null; revocation_reason: string | null;
}
const STATE_COLOR = { active: 'green', expired: 'orange', revoked: 'gray' } as const;

export function AccessRegisterPage() {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('access.manage');
  const [state, setState] = useState('active');
  const [reviewDue, setReviewDue] = useState(false);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const resources = useLookup('system_resource'); const levels = useLookup('access_level');
  const users = useQuery({ queryKey: ['user-options'], enabled: manage && can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });

  const form = useForm({
    initialValues: { user_id: null as string | null, resource_id: null as string | null, access_level_id: null as string | null, expires_on: '', description: '' },
    validate: { user_id: (v) => (v ? null : t('access.user')), resource_id: (v) => (v ? null : t('access.resource')), access_level_id: (v) => (v ? null : t('access.level')) },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['access-grants'] });

  const grant = useMutation({
    mutationFn: async (v: typeof form.values) => api.post('/access-grants', { ...v, expires_on: v.expires_on || null }),
    onSuccess: () => { toastOk(); setGranting(false); form.reset(); refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const revoke = useMutation({
    mutationFn: async () => api.post(`/access-grants/${revoking!.id}/revoke`, { reason }),
    onSuccess: () => { toastOk(); setRevoking(null); setReason(''); refresh(); }, onError: toastError,
  });
  const review = useMutation({ mutationFn: async (id: string) => api.post(`/access-grants/${id}/review`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  const columns: Column<Row>[] = [
    { key: 'user', label: t('access.user'), render: (r) => <div><Text size="sm" fw={600}>{r.user.name}</Text><Text size="xs" c="dimmed">{r.user.email}</Text></div> },
    { key: 'resource', label: t('access.resource'), render: (r) => <Badge variant="outline" color={r.resource.color ?? 'gray'}>{r.resource.label}</Badge> },
    { key: 'level', label: t('access.level'), render: (r) => <StatusBadge label={r.level.label} color={r.level.color} /> },
    { key: 'granted_by', label: t('access.granted_by'), visibleFrom: 'md', render: (r) => <div><Text size="sm">{r.granted_by ?? '—'}</Text><Text size="xs" c="dimmed">{fmtDateTime(r.granted_at, i18n.language)}</Text></div> },
    { key: 'expires_on', label: t('access.expires'), sortable: true, visibleFrom: 'lg', render: (r) => r.expires_on ?? '—' },
    { key: 'last_reviewed_at', label: t('access.reviewed'), visibleFrom: 'lg', render: (r) => r.last_reviewed_at ? fmtDateTime(r.last_reviewed_at, i18n.language) : '—' },
    { key: 'state', label: t('access.state'), render: (r) => <div><Badge color={STATE_COLOR[r.state]} variant="light">{t(`access.state.${r.state}`)}</Badge>{r.revoked_at && <Text size="xs" c="dimmed">{r.revocation_reason}</Text>}</div> },
  ];

  return (
    <>
      <PageHeader title={t('access.title')} />
      <DataList<Row> title={t('access.title')} endpoint="/access-grants" queryKey="access-grants" columns={columns} defaultSort={{ key: 'granted_at', direction: 'desc' }}
        extraParams={{ state: state === 'all' ? undefined : state, review_due: reviewDue ? 1 : undefined }}
        filters={[{ key: 'resource_id', label: t('access.resource'), options: resources.options }, { key: 'access_level_id', label: t('access.level'), options: levels.options }]}
        toolbar={<>
          <SegmentedControl value={state} onChange={setState} data={[{ value: 'active', label: t('access.state.active') }, { value: 'expired', label: t('access.state.expired') }, { value: 'revoked', label: t('access.state.revoked') }, { value: 'all', label: t('access.all') }]} />
          <Switch label={t('access.review_due')} checked={reviewDue} onChange={(e) => setReviewDue(e.currentTarget.checked)} />
          {manage && <Button leftSection={<IconPlus size={16} />} onClick={() => setGranting(true)}>{t('access.grant')}</Button>}
        </>}
        rowActions={manage ? (r) => r.state === 'revoked' ? null : <>
          <RowIconButton label={t('access.review')} color="green" onClick={() => review.mutate(r.id)}><IconCircleCheck size={18} /></RowIconButton>
          <RowIconButton label={t('access.revoke')} color="red" onClick={() => { setReason(''); setRevoking(r); }}><IconUserOff size={18} /></RowIconButton></> : undefined} />

      <Modal opened={granting} onClose={() => setGranting(false)} title={t('access.grant')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => grant.mutate(v))}>
          <Stack gap="sm">
            <Select label={t('access.user')} required searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...form.getInputProps('user_id')} />
            <Group grow align="flex-start"><Select label={t('access.resource')} required data={resources.options} {...form.getInputProps('resource_id')} /><Select label={t('access.level')} required data={levels.options} {...form.getInputProps('access_level_id')} /></Group>
            <TextInput type="date" label={t('access.expires')} {...form.getInputProps('expires_on')} />
            <RichTextField label={t('access.justification')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} minHeight={90} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setGranting(false)}>{t('common.cancel')}</Button><Button type="submit" loading={grant.isPending}>{t('access.grant')}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={!!revoking} onClose={() => setRevoking(null)} title={t('access.revoke')} centered>
        <Stack>
          <Text size="sm">{revoking?.user.name} — {revoking?.resource.label} ({revoking?.level.label})</Text>
          <TextInput label={t('access.reason')} required value={reason} maxLength={500} onChange={(e) => setReason(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setRevoking(null)}>{t('common.cancel')}</Button><Button color="red" disabled={!reason.trim()} loading={revoke.isPending} onClick={() => revoke.mutate()}>{t('access.revoke')}</Button></Group>
        </Stack>
      </Modal>
    </>
  );
}
