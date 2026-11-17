import { ActionIcon, Alert, Badge, Button, Card, Group, Menu, Modal, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconDownload, IconQrcode, IconRefresh, IconUserPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, downloadBlob, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PersonSelect, usePeople } from '@/components/PeoplePicker';
import { fmtDateTime } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';

interface Row { id: string; name: string; is_guest: boolean; walk_in: boolean; roles: string[]; department: string | null; rsvp: string | null; status: string; arrived_at: string | null; method: string | null; note: string | null; acknowledged_at: string | null }
interface Sheet {
  data: Row[];
  meta: {
    timezone: string; meeting_status: string; open: boolean; correction: boolean; is_sheet_viewer: boolean; can_record: boolean; ack_required: boolean; checkin_token: string | null;
    summary: { total: number; attended: number; rate: number | null } & Record<string, number | null>;
    me: { id: string; status: string; acknowledged: boolean } | null;
  };
}

export const ATT_COLOR: Record<string, string> = { expected: 'gray', present: 'green', late: 'orange', online: 'blue', absent: 'red', excused: 'violet' };
const STATUSES = ['present', 'late', 'online', 'absent', 'excused', 'expected'];

/** The attendance sheet (Guide 6.5): the secretary records, the participants check in by QR, corrections after the meeting need a reason. */
export function MeetingAttendanceTab({ meetingId, code }: { meetingId: string; code: string }) {
  const q = useQuery({ queryKey: ['meeting-attendance', meetingId], queryFn: async () => (await api.get<Sheet>(`/meetings/${meetingId}/attendance`)).data });
  return q.data ? <SheetView meetingId={meetingId} code={code} sheet={q.data} /> : null;
}

function SheetView({ meetingId, code, sheet }: { meetingId: string; code: string; sheet: Sheet }) {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const key = ['meeting-attendance', meetingId];
  const [pending, setPending] = useState<{ ids: string[]; status: string } | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [qr, setQr] = useState(false);
  const reason = useForm({ initialValues: { reason: '' } });
  const walk = useForm({ initialValues: { user_id: null as string | null, guest_name: '' } });
  const people = usePeople(walkIn);

  const set = (r: { data: Sheet }) => qc.setQueryData(key, r.data);
  const meta = sheet.meta;
  const rows = sheet.data;
  const link = meta.checkin_token ? `${window.location.origin}/meeting-checkin/${meta.checkin_token}` : null;

  const change = useMutation({
    mutationFn: async (v: { ids: string[]; status: string; reason?: string }) => v.ids.length === 1
      ? api.patch<Sheet>(`/meeting-attendance/${v.ids[0]}`, { status: v.status, reason: v.reason })
      : api.post<Sheet>(`/meetings/${meetingId}/attendance/bulk`, { ids: v.ids, status: v.status, reason: v.reason }),
    onSuccess: (r) => { set(r); setPending(null); reason.reset(); toastOk(); },
    onError: (e) => { reason.setErrors(parseError(e).fields); toastError(e); },
  });
  const ask = (ids: string[], status: string) => { if (meta.correction) { setPending({ ids, status }); } else { change.mutate({ ids, status }); } };
  const generate = useMutation({ mutationFn: async () => api.post<Sheet>(`/meetings/${meetingId}/attendance/generate`), onSuccess: set, onError: toastError });
  const add = useMutation({
    mutationFn: async (v: typeof walk.values & { reason?: string }) => api.post<Sheet>(`/meetings/${meetingId}/attendance/walk-in`, { user_id: v.user_id, guest_name: v.guest_name || undefined, reason: v.reason }),
    onSuccess: (r) => { set(r); setWalkIn(false); walk.reset(); reason.reset(); toastOk(); }, onError: (e) => { walk.setErrors(parseError(e).fields); toastError(e); },
  });
  const rotate = useMutation({ mutationFn: async () => api.post<Sheet>(`/meetings/${meetingId}/checkin-link/rotate`), onSuccess: (r) => { set(r); toastOk(t('meet.link_renewed')); }, onError: toastError });
  const ack = useMutation({ mutationFn: async () => api.post<Sheet>(`/meetings/${meetingId}/attendance/acknowledge`), onSuccess: (r) => { set(r); toastOk(t('meet.ack_done')); }, onError: toastError });

  const expected = rows.filter((r) => r.status === 'expected').map((r) => r.id);
  const exportAs = (format: string) => { downloadBlob(`/meetings/${meetingId}/attendance/export?format=${format}`, `attendance-${code}.${format}`).catch(toastError); };
  const s = meta.summary;

  return (
    <Stack gap="sm">
      {meta.me && meta.ack_required && !meta.me.acknowledged && ['present', 'late', 'online'].includes(meta.me.status) && (
        <Alert variant="light" color="blue" title={t('meet.ack_title')}>
          <Group justify="space-between"><Text size="sm">{t('meet.ack_text')}</Text><Button size="compact-md" leftSection={<IconCheck size={14} />} loading={ack.isPending} onClick={() => ack.mutate()}>{t('meet.ack_button')}</Button></Group>
        </Alert>
      )}
      {!meta.open && <Alert variant="light" color="gray">{t('meet.attendance_not_open')}</Alert>}
      {meta.open && (
        <Group justify="space-between" align="flex-start">
          <Group gap="xs">
            <Badge variant="light" color="green">{t('meet.att_attended', { attended: s.attended, total: s.total })}{s.rate !== null && ` · ${s.rate}%`}</Badge>
            {['present', 'late', 'online', 'absent', 'excused', 'expected'].map((c) => (s[c] ? <Badge key={c} variant="outline" color={ATT_COLOR[c]}>{t(`meet.att.${c}`)}: {s[c]}</Badge> : null))}
          </Group>
          <Group gap="xs">
            {meta.can_record && <Button size="compact-md" variant="light" leftSection={<IconUserPlus size={14} />} onClick={() => setWalkIn(true)}>{t('meet.walk_in')}</Button>}
            {meta.can_record && <Button size="compact-md" variant="light" leftSection={<IconRefresh size={14} />} loading={generate.isPending} onClick={() => generate.mutate()}>{t('meet.refresh_list')}</Button>}
            {meta.can_record && meta.meeting_status === 'in_progress' && link && <Button size="compact-md" variant="light" leftSection={<IconQrcode size={14} />} onClick={() => setQr(true)}>{t('meet.checkin_qr')}</Button>}
            {meta.is_sheet_viewer && can('data.export') && (
              <Menu withinPortal position="bottom-end">
                <Menu.Target><Button size="compact-md" variant="default" leftSection={<IconDownload size={14} />}>{t('meet.export')}</Button></Menu.Target>
                <Menu.Dropdown>{['pdf', 'xlsx', 'csv'].map((f) => <Menu.Item key={f} onClick={() => exportAs(f)}>{f.toUpperCase()}</Menu.Item>)}</Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      )}
      {meta.can_record && meta.open && expected.length > 0 && (
        <Group><Button size="compact-sm" variant="subtle" onClick={() => ask(expected, 'present')}>{t('meet.mark_expected_present', { count: expected.length })}</Button></Group>
      )}
      {meta.correction && meta.can_record && <Text size="xs" c="dimmed">{t('meet.correction_hint')}</Text>}

      <Table verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('meet.department')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th visibleFrom="md">{t('meet.arrived')}</Table.Th><Table.Th visibleFrom="md">{t('meet.confirmed')}</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Group gap={6}><Text size="sm" fw={500}>{r.name}</Text>
                  {r.is_guest && <Badge size="xs" variant="outline">{t('meet.guest')}</Badge>}{r.walk_in && <Badge size="xs" variant="outline" color="orange">{t('meet.walk_in_tag')}</Badge>}
                  {r.roles.map((x) => <Badge key={x} size="xs" variant="light">{t(`meet.role.${x}`)}</Badge>)}</Group>
              </Table.Td>
              <Table.Td visibleFrom="sm">{r.department ?? '—'}</Table.Td>
              <Table.Td>
                {meta.can_record && meta.open
                  ? <Select size="xs" w={140} allowDeselect={false} value={r.status} data={STATUSES.map((c) => ({ value: c, label: t(`meet.att.${c}`) }))} onChange={(v) => { if (v && v !== r.status) ask([r.id], v); }} />
                  : <Badge variant="light" color={ATT_COLOR[r.status]}>{t(`meet.att.${r.status}`)}</Badge>}
              </Table.Td>
              <Table.Td visibleFrom="md"><Text size="xs">{r.arrived_at ? fmtDateTime(r.arrived_at, meta.timezone, i18n.language) : '—'}</Text></Table.Td>
              <Table.Td visibleFrom="md">{r.acknowledged_at ? <ActionIcon variant="transparent" color="green" aria-label={t('meet.confirmed')}><IconCheck size={16} /></ActionIcon> : '—'}</Table.Td>
            </Table.Tr>
          ))}
          {rows.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('meet.no_attendance')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={!!pending} onClose={() => setPending(null)} centered title={t('meet.correction_title')}>
        <form onSubmit={reason.onSubmit((v) => { if (pending) change.mutate({ ...pending, reason: v.reason }); })}><Stack gap="sm">
          <Text size="sm">{t('meet.correction_text', { count: pending?.ids.length ?? 0, status: pending ? t(`meet.att.${pending.status}`) : '' })}</Text>
          <TextInput label={t('meet.correction_reason')} required minLength={3} maxLength={1000} {...reason.getInputProps('reason')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setPending(null)}>{t('common.cancel')}</Button><Button type="submit" loading={change.isPending} disabled={reason.values.reason.trim().length < 3}>{t('common.save')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={walkIn} onClose={() => setWalkIn(false)} centered title={t('meet.walk_in')}>
        <form onSubmit={walk.onSubmit((v) => add.mutate({ ...v, reason: meta.correction ? reason.values.reason : undefined }))}><Stack gap="sm">
          <PersonSelect label={t('meet.member')} people={people} value={walk.values.user_id} onChange={(x) => walk.setFieldValue('user_id', x)} error={walk.errors.user_id as string | undefined} />
          <TextInput label={t('meet.or_guest_name')} maxLength={150} {...walk.getInputProps('guest_name')} disabled={!!walk.values.user_id} />
          {meta.correction && <TextInput label={t('meet.correction_reason')} required {...reason.getInputProps('reason')} />}
          <Group justify="flex-end"><Button variant="default" onClick={() => setWalkIn(false)}>{t('common.cancel')}</Button><Button type="submit" loading={add.isPending} disabled={!walk.values.user_id && !walk.values.guest_name.trim()}>{t('meet.add_to_sheet')}</Button></Group>
        </Stack></form>
      </Modal>
      <Modal opened={qr} onClose={() => setQr(false)} centered title={t('meet.checkin_qr')}>
        {link && (
          <Stack align="center" gap="sm">
            <Card withBorder padding="md" bg="white"><QRCodeSVG value={link} size={240} marginSize={2} /></Card>
            <Text size="xs" c="dimmed" ta="center">{t('meet.checkin_hint')}</Text>
            <TextInput readOnly value={link} w="100%" onFocus={(e) => e.currentTarget.select()} />
            <Group><Button size="compact-md" variant="light" onClick={() => { void navigator.clipboard?.writeText(link).then(() => toastOk(t('meet.link_copied'))); }}>{t('meet.copy_link')}</Button>
              <Button size="compact-md" variant="subtle" color="red" loading={rotate.isPending} onClick={() => rotate.mutate()}>{t('meet.renew_link')}</Button></Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
