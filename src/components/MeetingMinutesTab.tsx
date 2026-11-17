import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconFilePlus, IconPencil } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { MINUTES_COLOR } from '@/lib/minutes';
import { toastError, toastOk } from '@/lib/ui';

interface Version { id: string; version_no: number; status: string; correction_reason: string | null; approved_at: string | null; published_at: string | null }
interface Resp { data: Version[]; meta: { exists: boolean; can_create: boolean; can_revise: boolean; is_writer: boolean } }

/** Minutes of one meeting (Guide 6.6): every version the user may read, with the actions the secretary has. */
export function MeetingMinutesTab({ meetingId }: { meetingId: string }) {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const key = ['meeting-minutes', meetingId];
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<Resp>(`/meetings/${meetingId}/minutes`)).data });
  const [revising, setRevising] = useState(false);
  const form = useForm({ initialValues: { reason: '' }, validate: { reason: (v) => (v.trim().length < 3 ? t('min.reason_required') : null) } });

  const create = useMutation({ mutationFn: async () => (await api.post<{ data: { id: string } }>(`/meetings/${meetingId}/minutes`)).data.data,
    onSuccess: (d) => { void qc.invalidateQueries({ queryKey: key }); nav(`/minutes/${d.id}`); }, onError: toastError });
  const revise = useMutation({ mutationFn: async (v: { reason: string }) => (await api.post<{ data: { id: string } }>(`/meetings/${meetingId}/minutes/revise`, v)).data.data,
    onSuccess: (d) => { toastOk(t('min.revision_started')); setRevising(false); form.reset(); void qc.invalidateQueries({ queryKey: key }); nav(`/minutes/${d.id}`); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });

  const rows = q.data?.data ?? [];
  const meta = q.data?.meta;
  if (!meta) return null;
  const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—');
  return (
    <Stack gap="sm">
      {rows.length === 0 && <Alert variant="light" color="gray">{meta.can_create ? t('min.none_yet_can_create') : t('min.none_yet')}</Alert>}
      {rows.length > 0 && (
        <Table verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>{t('min.version')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th>{t('min.published_on')}</Table.Th><Table.Th>{t('min.reason')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {rows.map((v) => (
              <Table.Tr key={v.id}>
                <Table.Td>v{v.version_no}</Table.Td>
                <Table.Td><StatusBadge label={t(`min.status.${v.status}`)} color={MINUTES_COLOR[v.status]} /></Table.Td>
                <Table.Td>{fmt(v.published_at)}</Table.Td>
                <Table.Td><Text size="sm" c="dimmed" lineClamp={2}>{v.correction_reason ?? '—'}</Text></Table.Td>
                <Table.Td ta="right"><Button component={Link} to={`/minutes/${v.id}`} size="compact-sm" variant="light" leftSection={<IconPencil size={14} />}>{t('min.open')}</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Group>
        {meta.can_create && <Button leftSection={<IconFilePlus size={16} />} loading={create.isPending} onClick={() => create.mutate()}>{t('min.start')}</Button>}
        {meta.can_revise && <Button variant="default" onClick={() => setRevising(true)}>{t('min.correct')}</Button>}
      </Group>
      <Modal opened={revising} onClose={() => setRevising(false)} title={t('min.correct')} centered>
        <form onSubmit={form.onSubmit((v) => revise.mutate(v))}>
          <Stack>
            <Text size="sm" c="dimmed">{t('min.correct_help')}</Text>
            <TextInput label={t('min.reason')} required maxLength={1000} {...form.getInputProps('reason')} />
            <Group justify="flex-end"><Button variant="default" onClick={() => setRevising(false)}>{t('common.cancel')}</Button><Button type="submit" loading={revise.isPending}>{t('min.start_correction')}</Button></Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
