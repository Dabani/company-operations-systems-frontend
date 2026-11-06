import { Alert, Badge, Button, Card, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Line { id: string; scope: string; role: string | null; user: string | null; task: string | null; hourly_rate: string; effective_from: string; effective_to: string | null }
interface Card1 { id: string; name: string; currency_code: string; lines: Line[] }

export function RateCardsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('rates.manage');
  const scopes = useLookup('rate_scope');
  const roles = useLookup('project_role');
  const [newCard, setNewCard] = useState<{ name: string; currency: string } | null>(null);
  const [line, setLine] = useState<{ card: string; scope: string | null; role: string | null; user: string | null; rate: number | string; from: string } | null>(null);
  const cards = useQuery({ queryKey: ['rate-cards'], queryFn: async () => (await api.get<{ data: Card1[] }>('/rate-cards')).data.data });
  const users = useQuery({ queryKey: ['user-options'], enabled: manage, queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/users', { params: { per_page: 100 } })).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['rate-cards'] });

  const createCard = useMutation({ mutationFn: async () => api.post('/rate-cards', { name: newCard!.name, currency_code: newCard!.currency }), onSuccess: () => { toastOk(); setNewCard(null); refresh(); }, onError: toastError });
  const addLine = useMutation({
    mutationFn: async () => api.post(`/rate-cards/${line!.card}/lines`, { scope_id: line!.scope, project_role_id: line!.role, user_id: line!.user, hourly_rate: line!.rate, effective_from: line!.from }),
    onSuccess: () => { toastOk(); setLine(null); refresh(); }, onError: toastError,
  });
  const endLine = useMutation({ mutationFn: async (v: { card: string; id: string }) => api.patch(`/rate-cards/${v.card}/lines/${v.id}/end`, { effective_to: new Date().toISOString().slice(0, 10) }), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const scopeCode = scopes.items.find((s) => s.id === line?.scope)?.code;

  return (
    <>
      <PageHeader title={t('rates.title')} description={t('rates.intro')} actions={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => setNewCard({ name: '', currency: 'RWF' })}>{t('rates.new_card')}</Button> : undefined} />
      <Alert color="orange" variant="light" mb="md">{t('rates.confidential')}</Alert>
      <Stack>
        {cards.data?.map((c) => (
          <Card key={c.id} withBorder>
            <Group justify="space-between" mb="xs"><Group gap="xs"><Text fw={600}>{c.name}</Text><Badge variant="outline">{c.currency_code}</Badge></Group>
              {manage && <Button size="xs" variant="light" onClick={() => setLine({ card: c.id, scope: null, role: null, user: null, rate: '', from: new Date().toISOString().slice(0, 10) })}>{t('rates.add_line')}</Button>}</Group>
            {c.lines.map((l) => (
              <Group key={l.id} justify="space-between" wrap="nowrap">
                <Text size="sm">{t(`rates.scope.${l.scope}`)}{l.role ? ` · ${roles.items.find((r) => r.code === l.role)?.label ?? l.role}` : ''}{l.user ? ` · ${l.user}` : ''}{l.task ? ` · ${l.task}` : ''}</Text>
                <Group gap="xs"><Text size="sm" fw={600}>{Number(l.hourly_rate).toLocaleString()} {c.currency_code}/h</Text><Text size="xs" c="dimmed">{l.effective_from} → {l.effective_to ?? '∞'}</Text>
                  {manage && !l.effective_to && <Button size="compact-xs" variant="subtle" color="red" onClick={() => endLine.mutate({ card: c.id, id: l.id })}>{t('rates.end_today')}</Button>}</Group>
              </Group>))}
          </Card>))}
        {cards.data?.length === 0 && <Text c="dimmed" ta="center" py="xl">{t('rates.none')}</Text>}
      </Stack>

      <Modal opened={!!newCard} onClose={() => setNewCard(null)} title={t('rates.new_card')} centered>
        {newCard && <Stack><TextInput label={t('common.name')} value={newCard.name} onChange={(e) => setNewCard({ ...newCard, name: e.currentTarget.value })} />
          <TextInput label={t('projects.currency')} maxLength={3} value={newCard.currency} onChange={(e) => setNewCard({ ...newCard, currency: e.currentTarget.value.toUpperCase() })} />
          <Group justify="flex-end"><Button disabled={!newCard.name || newCard.currency.length !== 3} loading={createCard.isPending} onClick={() => createCard.mutate()}>{t('common.save')}</Button></Group></Stack>}
      </Modal>
      <Modal opened={!!line} onClose={() => setLine(null)} title={t('rates.add_line')} centered>
        {line && <Stack>
          <Select label={t('rates.scope_label')} data={scopes.options} value={line.scope} onChange={(v) => setLine({ ...line, scope: v })} />
          {scopeCode === 'role' && <Select label={t('projects.role')} data={roles.options} value={line.role} onChange={(v) => setLine({ ...line, role: v })} />}
          {scopeCode === 'employee' && <Select label={t('common.user')} searchable data={(users.data ?? []).map((u) => ({ value: u.id, label: u.name }))} value={line.user} onChange={(v) => setLine({ ...line, user: v })} />}
          {scopeCode === 'task' && <Text size="xs" c="dimmed">{t('rates.task_scope_note')}</Text>}
          <Group grow><NumberInput label={t('rates.hourly_rate')} thousandSeparator min={0} value={line.rate} onChange={(v) => setLine({ ...line, rate: v })} /><TextInput type="date" label={t('rates.effective_from')} value={line.from} onChange={(e) => setLine({ ...line, from: e.currentTarget.value })} /></Group>
          <Group justify="flex-end"><Button disabled={!line.scope || line.rate === ''} loading={addLine.isPending} onClick={() => addLine.mutate()}>{t('common.save')}</Button></Group>
        </Stack>}
      </Modal>
    </>
  );
}
