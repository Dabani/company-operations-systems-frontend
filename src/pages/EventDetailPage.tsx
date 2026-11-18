import { Alert, Anchor, Badge, Button, Card, Center, CopyButton, Group, Loader, Menu, Modal, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconCopy, IconPencil, IconTicket } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EventExpensesTab } from '@/components/EventExpensesTab';
import { EventFormModal, type EventForEdit } from '@/components/EventFormModal';
import { EventRegistrationsTab } from '@/components/EventRegistrationsTab';
import { PageHeader } from '@/components/PageHeader';
import { SafeHtml } from '@/components/SafeHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { EVENT_COLOR, REG_COLOR, cancelNoteOk, fmtMoney, ticketUrl } from '@/lib/events';
import { fmtRange } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';

interface Detail extends EventForEdit {
  code: string; type: string | null; project: { id: string; code: string } | null; cancel_reason: string | null;
  stats: { registered: number; capacity: number | null; free_seats: number | null; waitlisted?: number; attended?: number };
  public_url: string | null; history: { status: string; by: string | null; note: string | null; at: string }[];
  me: { manages: boolean; registration: { id: string; status: string; ticket: string | null; checked_in: boolean } | null; can_register: boolean; can_cancel_registration: boolean; moves: string[]; can_edit: boolean };
}

export function EventDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [move, setMove] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const key = ['event', id];
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Detail }>(`/events/${id}`)).data.data });
  const set = (d: Detail) => qc.setQueryData(key, d);
  const status = useMutation({ mutationFn: async (v: { to: string; note: string }) => (await api.post<{ data: Detail }>(`/events/${id}/status`, { to: v.to, note: v.note || null })).data.data,
    onSuccess: (d) => { set(d); setMove(null); setNote(''); toastOk(); }, onError: toastError });
  const register = useMutation({ mutationFn: async () => (await api.post<{ data: Detail }>(`/events/${id}/register`, {})).data.data, onSuccess: (d) => { set(d); toastOk(t('ev.registered_ok')); }, onError: toastError });
  const leave = useMutation({ mutationFn: async () => (await api.delete<{ data: Detail }>(`/events/${id}/register`)).data.data, onSuccess: (d) => { set(d); setLeaving(false); toastOk(); }, onError: toastError });
  const rotate = useMutation({ mutationFn: async () => (await api.post<{ data: Detail }>(`/events/${id}/link/rotate`, {})).data.data, onSuccess: (d) => { set(d); setRotating(false); toastOk(); }, onError: toastError });

  if (q.isLoading) return <Center h={200}><Loader /></Center>;
  if (q.isError || !q.data) return <Alert color="red" variant="light">{t('common.error')}</Alert>;
  const e = q.data;
  const reg = e.me.registration;
  const active = reg && reg.status !== 'cancelled';
  const spent = e.budget_amount !== null || e.me.manages;

  return (
    <>
      <PageHeader title={e.title} description={`${e.code} · ${e.type ? t(`ev.type.${e.type}`, { defaultValue: e.type }) : ''}`}
        actions={<>
          <StatusBadge label={t(`ev.status.${e.status}`)} color={EVENT_COLOR[e.status]} />
          {e.me.can_edit && <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>{t('common.edit')}</Button>}
          {e.me.moves.length > 0 && <Menu position="bottom-end"><Menu.Target><Button>{t('ev.change_status')}</Button></Menu.Target>
            <Menu.Dropdown>{e.me.moves.map((m) => <Menu.Item key={m} color={m === 'cancelled' ? 'red' : undefined} onClick={() => { setMove(m); setNote(''); }}>{t(`ev.to.${m}`)}</Menu.Item>)}</Menu.Dropdown></Menu>}
        </>} />
      {e.status === 'cancelled' && <Alert color="red" variant="light" mb="md" title={t('ev.cancelled_title')}>{e.cancel_reason}</Alert>}
      <Tabs defaultValue="overview" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview">{t('ev.tab_overview')}</Tabs.Tab>
          {e.me.manages && <Tabs.Tab value="registrations">{t('ev.registrations')}</Tabs.Tab>}
          {e.me.manages && spent && <Tabs.Tab value="expenses">{t('ev.expenses')}</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Stack gap="md">
            <Card withBorder padding="md">
              <Stack gap={6}>
                <Text size="sm"><b>{t('meet.when')}:</b> {fmtRange(e.starts_at, e.ends_at, e.timezone, i18n.language)} ({e.timezone})</Text>
                {e.venue && <Text size="sm"><b>{t('ev.venue')}:</b> {e.venue}</Text>}
                {e.online_url && <Text size="sm"><b>{t('ev.online_url')}:</b> <Anchor href={e.online_url} target="_blank" rel="noopener noreferrer">{e.online_url}</Anchor></Text>}
                <Text size="sm"><b>{t('ev.organizer')}:</b> {e.organizer.name}</Text>
                <Text size="sm"><b>{t('ev.seats')}:</b> {e.stats.capacity ? t('ev.seats_of', { registered: e.stats.registered, capacity: e.stats.capacity }) : t('ev.seats_count', { count: e.stats.registered })}
                  {e.stats.free_seats !== null && e.stats.free_seats !== undefined && ` · ${t('ev.seats_free', { count: e.stats.free_seats })}`}</Text>
                {e.budget_amount !== null && e.me.manages && <Text size="sm"><b>{t('ev.budget')}:</b> {fmtMoney(e.budget_amount, e.currency_code, i18n.language)}</Text>}
              </Stack>
              {e.description && <div style={{ marginTop: 12 }}><SafeHtml html={e.description} /></div>}
            </Card>
            <Card withBorder padding="md">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={6} style={{ flex: 1, minWidth: 220 }}>
                  <Title order={5}>{t('ev.my_registration')}</Title>
                  {active ? <Group gap="xs"><Badge color={REG_COLOR[reg!.status]} variant="light">{t(`ev.reg.${reg!.status}`)}</Badge>{reg!.checked_in && <Badge color="green" leftSection={<IconCheck size={12} />}>{t('ev.attended')}</Badge>}</Group>
                    : <Text size="sm" c="dimmed">{e.me.can_register ? t('ev.not_registered') : t('ev.registration_closed')}</Text>}
                  <Group gap="xs">
                    {e.me.can_register && <Button leftSection={<IconTicket size={16} />} loading={register.isPending} onClick={() => register.mutate()}>{t('ev.register')}</Button>}
                    {e.me.can_cancel_registration && <Button variant="light" color="red" onClick={() => setLeaving(true)}>{t('ev.cancel_my')}</Button>}
                  </Group>
                </Stack>
                {active && reg!.status === 'registered' && reg!.ticket && (
                  <Stack gap={4} align="center">
                    <div style={{ background: '#fff', padding: 8, borderRadius: 8 }}><QRCodeSVG value={ticketUrl(window.location.origin, reg!.ticket)} size={132} /></div>
                    <Text size="xs" c="dimmed">{t('ev.ticket_hint')}</Text>
                  </Stack>)}
              </Group>
            </Card>
            {e.me.manages && e.public_url && (
              <Card withBorder padding="md">
                <Title order={5} mb={4}>{t('ev.public_link')}</Title>
                <Text size="xs" c="dimmed" mb="xs">{t('ev.public_link_help')}</Text>
                <Group gap="xs" wrap="nowrap"><TextInput readOnly style={{ flex: 1 }} value={e.public_url} onFocus={(ev) => ev.currentTarget.select()} />
                  <CopyButton value={e.public_url}>{({ copied, copy }) => <Button variant="default" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>{copied ? t('ev.copied') : t('ev.copy')}</Button>}</CopyButton>
                  <Button variant="light" color="orange" onClick={() => setRotating(true)}>{t('ev.rotate')}</Button></Group>
              </Card>)}
            {e.history.length > 0 && (
              <Card withBorder padding="md"><Title order={5} mb="xs">{t('ev.history')}</Title>
                <Stack gap={4}>{e.history.map((h, i) => <Text size="xs" key={i}>{new Date(h.at).toLocaleString(i18n.language)} — {h.by ?? '—'}: {t(`ev.status.${h.status}`)}{h.note ? ` (${h.note})` : ''}</Text>)}</Stack></Card>)}
          </Stack>
        </Tabs.Panel>
        {e.me.manages && <Tabs.Panel value="registrations"><EventRegistrationsTab eventId={e.id} status={e.status} timezone={e.timezone} allowGuests={e.allow_guests} canRegisterPeople={!['completed', 'cancelled'].includes(e.status)} /></Tabs.Panel>}
        {e.me.manages && spent && <Tabs.Panel value="expenses"><EventExpensesTab eventId={e.id} currency={e.currency_code} canAdd={e.status !== 'cancelled'} /></Tabs.Panel>}
      </Tabs>
      <EventFormModal opened={editing} onClose={() => setEditing(false)} event={{ ...e, project_id: e.project?.id ?? null }} onSaved={() => { void qc.invalidateQueries({ queryKey: key }); }} />
      <Modal opened={!!move} onClose={() => setMove(null)} centered title={move ? t(`ev.to.${move}`) : ''}>
        <Stack gap="sm">
          <TextInput label={move === 'cancelled' ? t('ev.cancel_reason') : t('meet.note')} required={move === 'cancelled'} maxLength={1000} value={note} onChange={(x) => setNote(x.currentTarget.value)} />
          {move === 'cancelled' && <Alert color="orange" variant="light">{t('ev.cancel_warning')}</Alert>}
          <Group justify="flex-end"><Button variant="default" onClick={() => setMove(null)}>{t('common.cancel')}</Button>
            <Button color={move === 'cancelled' ? 'red' : undefined} loading={status.isPending} disabled={!move || !cancelNoteOk(move, note)} onClick={() => move && status.mutate({ to: move, note: note.trim() })}>{t('common.confirm')}</Button></Group>
        </Stack>
      </Modal>
      <ConfirmModal opened={leaving} onClose={() => setLeaving(false)} loading={leave.isPending} title={t('ev.cancel_my')} text={t('ev.cancel_my_text')} onConfirm={() => leave.mutate()} />
      <ConfirmModal opened={rotating} onClose={() => setRotating(false)} loading={rotate.isPending} title={t('ev.rotate')} text={t('ev.rotate_text')} onConfirm={() => rotate.mutate()} />
    </>
  );
}
