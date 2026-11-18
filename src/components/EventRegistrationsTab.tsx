import { ActionIcon, Alert, Badge, Button, Card, Group, Menu, Modal, SimpleGrid, Stack, MultiSelect, Table, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconDots, IconDownload, IconPlus, IconScan, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AxiosError } from 'axios';
import { api, downloadBlob, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatusBadge } from '@/components/StatusBadge';
import { REG_COLOR } from '@/lib/events';
import { fmtDateTime } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';

export interface Reg { id: string; name: string; email: string | null; phone: string | null; organization: string | null; guest: boolean; status: string; registered_at: string; checked_in_at: string | null; note: string | null }
interface Stats { registered: number; waitlisted: number; cancelled: number; attended: number; no_shows: number; attendance_rate: number | null; capacity: number | null; free_seats: number | null }

interface Props { eventId: string; status: string; timezone: string; allowGuests: boolean; canRegisterPeople: boolean }

/** Organizer view: the list of registrations with check-in (manual or by scanning the ticket), adding people and exporting. */
export function EventRegistrationsTab({ eventId, status, timezone, allowGuests, canRegisterPeople }: Props) {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const key = ['event-registrations', eventId];
  const [ticket, setTicket] = useState('');
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<Reg | null>(null);
  const [undoing, setUndoing] = useState<Reg | null>(null);
  const [undoNote, setUndoNote] = useState('');
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Reg[]; meta: Stats }>(`/events/${eventId}/registrations`)).data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ['event', eventId] }); };
  const canCheckIn = ['open', 'closed', 'in_progress'].includes(status);

  const checkIn = useMutation({ mutationFn: async (id: string) => (await api.post(`/event-registrations/${id}/check-in`, {})).data, onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const cancel = useMutation({ mutationFn: async (id: string) => (await api.delete(`/event-registrations/${id}`)).data, onSuccess: () => { setCancelling(null); toastOk(); refresh(); }, onError: toastError });
  const undo = useMutation({ mutationFn: async (v: { id: string; note: string }) => (await api.delete(`/event-registrations/${v.id}/check-in`, { data: { note: v.note } })).data, onSuccess: () => { setUndoing(null); setUndoNote(''); toastOk(); refresh(); }, onError: toastError });
  const scan = useMutation({
    mutationFn: async (code: string) => (await api.post<{ data: Reg & { already?: boolean } }>(`/events/${eventId}/scan`, { ticket: code })).data.data,
    onSuccess: (r) => { setScanMsg({ ok: !r.already, text: r.already ? t('ev.scan_already', { name: r.name }) : t('ev.scan_ok', { name: r.name }) }); setTicket(''); refresh(); },
    onError: (e) => { setScanMsg({ ok: false, text: (e as AxiosError).response?.status === 404 ? t('ev.scan_unknown') : parseError(e).message }); setTicket(''); },
  });

  const rows = q.data?.data ?? [];
  const s = q.data?.meta;
  const exportIt = (format: 'csv' | 'xlsx') => { downloadBlob(`/events/${eventId}/registrations/export?format=${format}`, `registrations.${format}`).catch(toastError); };

  return (
    <Stack gap="md">
      {s && (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          {[['ev.stat_registered', s.capacity ? `${s.registered} / ${s.capacity}` : s.registered], ['ev.stat_waitlisted', s.waitlisted], ['ev.stat_attended', s.attended], ['ev.stat_rate', s.attendance_rate === null ? '—' : `${s.attendance_rate}%`]].map(([k, v]) => (
            <Card key={String(k)} withBorder padding="sm"><Text size="xs" c="dimmed">{t(String(k))}</Text><Title order={3}>{v}</Title></Card>))}
        </SimpleGrid>
      )}
      {canCheckIn && (
        <Card withBorder padding="sm">
          <Text size="sm" fw={600} mb={4}>{t('ev.scan_title')}</Text>
          <form onSubmit={(e) => { e.preventDefault(); if (ticket.trim()) scan.mutate(ticket.trim()); }}>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <TextInput style={{ flex: 1 }} leftSection={<IconScan size={16} />} placeholder={t('ev.scan_placeholder')} value={ticket} onChange={(e) => setTicket(e.currentTarget.value)} autoFocus />
              <Button type="submit" loading={scan.isPending} disabled={!ticket.trim()}>{t('ev.check_in')}</Button>
            </Group>
          </form>
          <Text size="xs" c="dimmed" mt={4}>{t('ev.scan_help')}</Text>
          {scanMsg && <Alert mt="xs" color={scanMsg.ok ? 'green' : 'orange'} variant="light">{scanMsg.text}</Alert>}
        </Card>
      )}
      <Group justify="space-between">
        <Title order={5}>{t('ev.registrations')}</Title>
        <Group gap="xs">
          {can('data.export') && <Menu><Menu.Target><Button variant="default" leftSection={<IconDownload size={16} />}>{t('common.export')}</Button></Menu.Target>
            <Menu.Dropdown><Menu.Item onClick={() => exportIt('xlsx')}>XLSX</Menu.Item><Menu.Item onClick={() => exportIt('csv')}>CSV</Menu.Item></Menu.Dropdown></Menu>}
          {canRegisterPeople && <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>{t('ev.add_people')}</Button>}
        </Group>
      </Group>
      <Table.ScrollContainer minWidth={560}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('ev.registered_at')}</Table.Th><Table.Th>{t('ev.attendance')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('ev.no_registrations')}</Text></Table.Td></Table.Tr>}
            {rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td><Group gap={6}><Text size="sm" fw={500}>{r.name}</Text>{r.guest && <Badge size="xs" variant="outline">{t('ev.guest')}</Badge>}</Group><Text size="xs" c="dimmed">{[r.email, r.organization].filter(Boolean).join(' · ')}</Text></Table.Td>
                <Table.Td><StatusBadge label={t(`ev.reg.${r.status}`)} color={REG_COLOR[r.status]} /></Table.Td>
                <Table.Td><Text size="xs">{fmtDateTime(r.registered_at, timezone, i18n.language)}</Text></Table.Td>
                <Table.Td>{r.checked_in_at ? <Badge color="green" variant="light">{fmtDateTime(r.checked_in_at, timezone, i18n.language)}</Badge> : r.status === 'registered' && status === 'completed' ? <Badge color="red" variant="light">{t('ev.no_show')}</Badge> : '—'}</Table.Td>
                <Table.Td>
                  <Menu position="bottom-end"><Menu.Target><ActionIcon variant="subtle" aria-label={t('common.actions')}><IconDots size={16} /></ActionIcon></Menu.Target>
                    <Menu.Dropdown>
                      {canCheckIn && r.status === 'registered' && !r.checked_in_at && <Menu.Item onClick={() => checkIn.mutate(r.id)}>{t('ev.check_in')}</Menu.Item>}
                      {r.checked_in_at && ['open', 'closed', 'in_progress'].includes(status) && <Menu.Item onClick={() => setUndoing(r)}>{t('ev.undo_check_in')}</Menu.Item>}
                      {r.status !== 'cancelled' && !r.checked_in_at && !['completed', 'cancelled'].includes(status) && <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setCancelling(r)}>{t('ev.cancel_registration')}</Menu.Item>}
                    </Menu.Dropdown></Menu>
                </Table.Td>
              </Table.Tr>))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <AddPeopleModal opened={adding} onClose={() => setAdding(false)} eventId={eventId} allowGuests={allowGuests} onDone={refresh} />
      <ConfirmModal opened={!!cancelling} onClose={() => setCancelling(null)} loading={cancel.isPending} title={t('ev.cancel_registration')} text={t('ev.cancel_registration_text', { name: cancelling?.name ?? '' })} onConfirm={() => cancelling && cancel.mutate(cancelling.id)} />
      <Modal opened={!!undoing} onClose={() => setUndoing(null)} centered title={t('ev.undo_check_in')}>
        <Stack gap="sm">
          <TextInput label={t('ev.undo_reason')} required minLength={3} maxLength={500} value={undoNote} onChange={(e) => setUndoNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setUndoing(null)}>{t('common.cancel')}</Button>
            <Button loading={undo.isPending} disabled={undoNote.trim().length < 3} onClick={() => undoing && undo.mutate({ id: undoing.id, note: undoNote.trim() })}>{t('common.save')}</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function AddPeopleModal({ opened, onClose, eventId, allowGuests, onDone }: { opened: boolean; onClose: () => void; eventId: string; allowGuests: boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const found = useQuery({ queryKey: ['event-people', debounced], enabled: opened, staleTime: 60_000, queryFn: async () => (await api.get<{ data: { id: string; name: string }[] }>('/events/people', { params: { search: debounced || undefined } })).data.data });
  const known = useState<Record<string, string>>({})[0];
  (found.data ?? []).forEach((p) => { known[p.id] = p.name; });
  const options = [...new Set([...(found.data ?? []).map((p) => p.id), ...users])].map((id) => ({ value: id, label: known[id] ?? id }));
  const [g, setG] = useState({ name: '', email: '', phone: '', organization: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => (await api.post<{ data: { added: number; skipped: string[] } }>(`/events/${eventId}/registrations`, { user_ids: users, guests: g.name && g.email ? [g] : [] })).data.data,
    onSuccess: (r) => { toastOk(t('ev.added_n', { count: r.added })); if (r.skipped.length) setError(t('ev.skipped', { names: r.skipped.join(', ') })); else onClose(); setUsers([]); setG({ name: '', email: '', phone: '', organization: '' }); onDone(); },
    onError: (e) => setError(parseError(e).message),
  });
  return (
    <Modal opened={opened} onClose={onClose} centered title={t('ev.add_people')} size="lg">
      <Stack gap="sm">
        <MultiSelect label={t('ev.colleagues')} data={options} value={users} onChange={setUsers} onSearchChange={setSearch} searchable nothingFoundMessage="—" filter={({ options: o }) => o} />
        {allowGuests && (
          <Card withBorder padding="sm"><Text size="sm" fw={600} mb={4}>{t('ev.guest_one')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label={t('common.name')} value={g.name} onChange={(e) => setG({ ...g, name: e.currentTarget.value })} />
              <TextInput label={t('common.email')} type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.currentTarget.value })} />
              <TextInput label={t('common.phone')} value={g.phone} onChange={(e) => setG({ ...g, phone: e.currentTarget.value })} />
              <TextInput label={t('ev.guest_org')} value={g.organization} onChange={(e) => setG({ ...g, organization: e.currentTarget.value })} />
            </SimpleGrid></Card>)}
        {error && <Alert color="orange" variant="light">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.close')}</Button>
          <Button loading={save.isPending} disabled={users.length === 0 && !(g.name && g.email)} onClick={() => { setError(null); save.mutate(); }}>{t('ev.add')}</Button></Group>
      </Stack>
    </Modal>
  );
}
