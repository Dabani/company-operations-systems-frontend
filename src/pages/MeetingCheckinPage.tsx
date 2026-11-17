import { Alert, Badge, Button, Card, Center, Container, Group, Loader, Stack, Switch, Text, Title } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { ATT_COLOR } from '@/components/MeetingAttendanceTab';
import { fmtRange } from '@/lib/meetings';

interface Preview { id: string; code: string; title: string; timezone: string; starts_at: string; ends_at: string; status: string; can_check_in: boolean; my_status: string | null }

/** Opened from the QR code or link the secretary shows. The participant is signed in; the server knows who they are. */
export function MeetingCheckinPage() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['meeting-checkin', token], retry: false, queryFn: async () => (await api.get<{ data: Preview }>(`/meeting-checkin/${token}`)).data.data });
  const go = useMutation({
    mutationFn: async () => (await api.post<{ data: { status: string } }>(`/meeting-checkin/${token}`, { online })).data.data,
    onSuccess: () => { setError(null); void q.refetch(); }, onError: (e) => setError(parseError(e).message),
  });
  const m = q.data;
  const done = m && ['present', 'late', 'online'].includes(m.my_status ?? '');

  return (
    <Container size="xs" py="xl">
      {q.isLoading && <Center><Loader /></Center>}
      {q.isError && <Alert color="red" variant="light" title={t('meet.checkin_invalid_title')}>{t('meet.checkin_invalid')}</Alert>}
      {m && (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase">{m.code}</Text>
            <Title order={3}>{m.title}</Title>
            <Text size="sm">{fmtRange(m.starts_at, m.ends_at, m.timezone, i18n.language)}</Text>
            {done ? (
              <Alert color="green" variant="light" icon={<IconCheck size={18} />} title={t('meet.checked_in')}><Badge color={ATT_COLOR[m.my_status!]} variant="light">{t(`meet.att.${m.my_status}`)}</Badge></Alert>
            ) : m.can_check_in ? (
              <>
                <Switch label={t('meet.joining_online')} checked={online} onChange={(e) => setOnline(e.currentTarget.checked)} />
                <Button size="lg" loading={go.isPending} onClick={() => go.mutate()}>{t('meet.check_me_in')}</Button>
              </>
            ) : <Alert color="gray" variant="light">{t('meet.checkin_not_open')}</Alert>}
            {error && <Alert color="red" variant="light">{error}</Alert>}
            <Group justify="flex-end"><Button component={Link} to={`/meetings/${m.id}`} variant="subtle">{t('meet.open_meeting')}</Button></Group>
          </Stack>
        </Card>
      )}
    </Container>
  );
}
