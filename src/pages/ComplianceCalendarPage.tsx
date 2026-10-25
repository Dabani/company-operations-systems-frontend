import { ActionIcon, Badge, Button, Card, Drawer, Group, Modal, Select, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconEdit, IconExternalLink, IconHistory, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { LV, Paginated } from '@/types';

interface Ob {
  id: string; code: string; title: string; description: string | null; is_active: boolean; frequency: LV; responsible_role_id: string | null; responsible_role: string | null;
  responsible_user_id: string | null; responsible_user: string | null; legal_reference_id: string | null; legal_reference: string | null; link_route: string | null;
  next_due_on: string; last_completed_on: string | null; days_until: number; state: 'overdue' | 'due_soon' | 'ok' | 'inactive';
}
interface Done { id: number; due_on: string; completed_on: string; by: string | null; notes: string | null; automatic: boolean; late: boolean }
const COLOR = { overdue: 'red', due_soon: 'orange', ok: 'green', inactive: 'gray' } as const;
const empty = { code: '', title: '', description: '', frequency_id: null as string | null, responsible_role_id: null as string | null, responsible_user_id: null as string | null, legal_reference_id: null as string | null, link_route: '', next_due_on: '', is_active: true };

export function ComplianceCalendarPage() {
  const { t } = useTranslation();
  const { can, me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const manage = can('compliance.manage');
  const [editing, setEditing] = useState<Ob | 'new' | null>(null);
  const [completing, setCompleting] = useState<Ob | null>(null);
  const [history, setHistory] = useState<Ob | null>(null);
  const [notes, setNotes] = useState('');
  const [doneOn, setDoneOn] = useState('');
  const freqs = useLookup('obligation_frequency');

  const q = useQuery({ queryKey: ['obligations'], queryFn: async () => (await api.get<{ data: Ob[] }>('/obligations')).data.data });
  const roles = useQuery({ queryKey: ['roles-options'], enabled: manage && can('role.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/roles', { params: { per_page: 100 } })).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: manage && can('user.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100, sort: 'name' } })).data.data });
  const refs = useQuery({ queryKey: ['legal-refs'], enabled: manage, queryFn: async () => (await api.get<{ data: { id: string; code: string; title: string }[] }>('/legal-references')).data.data });
  const hist = useQuery({ queryKey: ['obligation-history', history?.id], enabled: !!history, queryFn: async () => (await api.get<{ data: Done[] }>(`/obligations/${history!.id}/completions`)).data.data });

  const form = useForm({ initialValues: empty, validate: { code: (v) => (v.trim() ? null : t('common.code')), title: (v) => (v.trim() ? null : t('case.subject')), frequency_id: (v) => (v ? null : t('cal.frequency')), next_due_on: (v) => (v ? null : t('cal.due')) } });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['obligations'] }); void qc.invalidateQueries({ queryKey: ['obligation-history'] }); };

  const open = (o: Ob | 'new') => {
    setEditing(o);
    form.setValues(o === 'new' ? empty : { code: o.code, title: o.title, description: o.description ?? '', frequency_id: o.frequency.id, responsible_role_id: o.responsible_role_id, responsible_user_id: o.responsible_user_id,
      legal_reference_id: o.legal_reference_id, link_route: o.link_route ?? '', next_due_on: o.next_due_on, is_active: o.is_active });
  };
  const save = useMutation({
    mutationFn: async (v: typeof empty) => { const b = { ...v, link_route: v.link_route || null }; return editing === 'new' ? api.post('/obligations', b) : api.patch(`/obligations/${(editing as Ob).id}`, b); },
    onSuccess: () => { toastOk(); setEditing(null); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const complete = useMutation({
    mutationFn: async () => api.post(`/obligations/${completing!.id}/complete`, { notes, completed_on: doneOn || undefined }),
    onSuccess: () => { toastOk(); setCompleting(null); setNotes(''); setDoneOn(''); refresh(); }, onError: toastError,
  });

  const rows = q.data ?? [];
  const when = (o: Ob) => o.days_until < 0 ? t('cal.days_overdue', { n: -o.days_until }) : o.days_until === 0 ? t('cal.state.due_soon') : t('cal.days_until', { n: o.days_until });

  return (
    <>
      <PageHeader title={t('cal.title')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('cal.new')}</Button> : undefined} />
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {rows.map((o) => (
          <Card key={o.id} padding="md" style={{ borderLeft: `4px solid var(--mantine-color-${COLOR[o.state]}-6)`, opacity: o.is_active ? 1 : 0.6 }}>
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}><Text fw={700} lineClamp={2}>{o.title}</Text><Text size="xs" c="dimmed">{o.frequency.label}{o.legal_reference ? ` · ${o.legal_reference}` : ''}</Text></div>
                <Badge color={COLOR[o.state]} variant="light">{t(`cal.state.${o.state}`)}</Badge>
              </Group>
              <Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('cal.due')}</Text><Text size="sm" fw={600}>{o.next_due_on}</Text><Text size="xs" c={o.state === 'overdue' ? 'red' : 'dimmed'}>{when(o)}</Text></div>
                <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{t('cal.last')}</Text><Text size="sm">{o.last_completed_on ?? '—'}</Text></div></Group>
              <Text size="xs" c="dimmed">{t('cal.responsible')}: {[o.responsible_user, o.responsible_role].filter(Boolean).join(' / ') || '—'}</Text>
              <Group gap={6}>
                {o.link_route && <Button size="compact-sm" variant="light" leftSection={<IconExternalLink size={14} />} onClick={() => nav(o.link_route!)}>{t('cal.go')}</Button>}
                {(manage || o.responsible_user_id === me?.id) && o.is_active && <Button size="compact-sm" color="green" leftSection={<IconCheck size={14} />} onClick={() => { setNotes(''); setDoneOn(''); setCompleting(o); }}>{t('cal.complete')}</Button>}
                <Tooltip label={t('cal.history')}><ActionIcon variant="subtle" onClick={() => setHistory(o)} aria-label={t('cal.history')}><IconHistory size={18} /></ActionIcon></Tooltip>
                {manage && <Tooltip label={t('common.edit')}><ActionIcon variant="subtle" onClick={() => open(o)} aria-label={t('common.edit')}><IconEdit size={18} /></ActionIcon></Tooltip>}
              </Group>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Drawer opened={!!history} onClose={() => setHistory(null)} position="right" size="md" title={history?.title}>
        <Stack gap="sm">
          {history?.description && <SafeHtml html={history.description} />}
          {(hist.data ?? []).map((c) => (
            <Group key={c.id} justify="space-between" wrap="nowrap" align="flex-start">
              <div><Text size="sm" fw={600}>{c.completed_on} {c.late && <Badge size="xs" color="orange">{t('cal.late')}</Badge>}</Text><Text size="xs" c="dimmed">{t('cal.due')}: {c.due_on}{c.notes ? ` · ${c.notes}` : ''}</Text></div>
              <Text size="xs" c="dimmed" ta="right">{c.automatic ? t('cal.auto') : c.by}</Text>
            </Group>))}
        </Stack>
      </Drawer>

      <Modal opened={!!completing} onClose={() => setCompleting(null)} title={completing?.title} centered>
        <Stack>
          <TextInput type="date" label={t('cal.completed_on')} max={new Date().toISOString().slice(0, 10)} value={doneOn} onChange={(e) => setDoneOn(e.currentTarget.value)} />
          <TextInput label={t('cal.notes')} maxLength={1000} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setCompleting(null)}>{t('common.cancel')}</Button><Button color="green" loading={complete.isPending} onClick={() => complete.mutate()}>{t('cal.complete')}</Button></Group>
        </Stack>
      </Modal>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('cal.new') : t('cal.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow align="flex-start"><TextInput label={t('common.code')} required {...form.getInputProps('code')} /><Select label={t('cal.frequency')} required data={freqs.options} {...form.getInputProps('frequency_id')} /></Group>
            <TextInput label={t('case.subject')} required {...form.getInputProps('title')} />
            <Group grow align="flex-start"><TextInput type="date" label={t('cal.due')} required {...form.getInputProps('next_due_on')} /><TextInput label={t('cal.route')} placeholder="/archive/inventory" {...form.getInputProps('link_route')} /></Group>
            <Group grow align="flex-start">
              {can('role.view') && <Select label={t('cal.role')} clearable data={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))} {...form.getInputProps('responsible_role_id')} />}
              {can('user.view') && <Select label={t('cal.person')} clearable searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} {...form.getInputProps('responsible_user_id')} />}
            </Group>
            <Select label={t('ret.legal')} clearable searchable data={(refs.data ?? []).map((l) => ({ value: l.id, label: `${l.code} — ${l.title}` }))} {...form.getInputProps('legal_reference_id')} />
            <RichTextField label={t('common.description')} value={form.values.description} onChange={(v) => form.setFieldValue('description', v)} minHeight={80} />
            <Switch label={t('common.active')} {...form.getInputProps('is_active', { type: 'checkbox' })} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
