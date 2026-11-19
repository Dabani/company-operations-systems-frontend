import { Alert, Badge, Button, Card, Center, Container, Group, Loader, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCalendarPlus, IconCheck, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { RSVP_COLOR, fmtRange, wallToUtc } from '@/lib/meetings';

interface Invite { title: string; status: string; timezone: string; starts_at: string; ends_at: string; where: string | null; organizer: string | null; guest: string | null; response: string; can_respond: boolean }

/** Public page for an external guest: the personal link in the invitation e-mail is the credential. No sign-in, no other data is shown. */
export function MeetingRsvpPage() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [proposing, setProposing] = useState(false);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['meeting-rsvp', token], retry: false, queryFn: async () => (await api.get<{ data: Invite }>(`/public/meeting-rsvp/${token}`)).data.data });
  const send = useMutation({
    mutationFn: async (v: { response: string; note?: string; proposed_starts_at?: string }) => (await api.post<{ data: Invite }>(`/public/meeting-rsvp/${token}`, v)).data.data,
    onSuccess: () => { setError(null); setProposing(false); void q.refetch(); },
    onError: (e) => setError(parseError(e).message),
  });
  const m = q.data;

  return (
    <Container size="xs" py="xl">
      <Group justify="flex-end" mb="sm"><LanguageSwitcher /></Group>
      {q.isLoading && <Center><Loader /></Center>}
      {q.isError && <Alert color="red" variant="light" title={t('meet.rsvp_not_found_title')}>{t('meet.rsvp_not_found')}</Alert>}
      {m && (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase">{t('meet.rsvp_invitation')}</Text>
            <Title order={3}>{m.title}</Title>
            {m.guest && <Text size="sm">{t('meet.rsvp_hello', { name: m.guest })}</Text>}
            <Text size="sm"><b>{t('meet.when')}:</b> {fmtRange(m.starts_at, m.ends_at, m.timezone, i18n.language)} ({m.timezone})</Text>
            {m.where && <Text size="sm"><b>{t('meet.where')}:</b> {m.where}</Text>}
            {m.organizer && <Text size="sm"><b>{t('meet.organizer')}:</b> {m.organizer}</Text>}
            <Group gap="xs"><Text size="sm" fw={600}>{t('meet.your_answer')}</Text><Badge color={RSVP_COLOR[m.response]} variant="light">{t(`meet.rsvp.${m.response}`)}</Badge></Group>
            {m.status === 'cancelled' && <Alert color="red" variant="light">{t('meet.rsvp_cancelled')}</Alert>}
            {m.can_respond ? (
              <Group gap="xs">
                <Button color="green" leftSection={<IconCheck size={16} />} loading={send.isPending} onClick={() => send.mutate({ response: 'accepted' })}>{t('meet.accept')}</Button>
                <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => send.mutate({ response: 'declined' })}>{t('meet.decline')}</Button>
                <Button color="orange" variant="light" onClick={() => setProposing(true)}>{t('meet.propose')}</Button>
              </Group>
            ) : m.status !== 'cancelled' && <Text size="sm" c="dimmed">{t('meet.rsvp_closed')}</Text>}
            {error && <Alert color="red" variant="light">{error}</Alert>}
            {m.status !== 'cancelled' && m.response !== 'declined' && <Button component="a" href={`/meeting-online/${token}`} variant="light">{t('onl.join_online')}</Button>}
            {m.status !== 'cancelled' && <Button component="a" href={`/api/v1/public/meeting-rsvp/${token}/ics`} variant="subtle" leftSection={<IconCalendarPlus size={16} />}>{t('meet.add_to_calendar')}</Button>}
          </Stack>
        </Card>
      )}
      <Modal opened={proposing} onClose={() => setProposing(false)} centered title={t('meet.propose')}>
        <Stack gap="sm">
          <TextInput type="datetime-local" label={t('meet.proposed_start')} description={m ? t('meet.times_in_tz', { tz: m.timezone }) : undefined} value={when} onChange={(e) => setWhen(e.currentTarget.value)} required />
          <TextInput label={t('meet.note')} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setProposing(false)}>{t('common.cancel')}</Button>
            <Button loading={send.isPending} disabled={!when || !m} onClick={() => m && send.mutate({ response: 'proposed', note: note || undefined, proposed_starts_at: wallToUtc(when, m.timezone) })}>{t('meet.send_proposal')}</Button></Group>
        </Stack>
      </Modal>
    </Container>
  );
}
