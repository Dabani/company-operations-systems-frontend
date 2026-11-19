import { Alert, Button, Card, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconDoorExit, IconVideo } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { InterventionPanel } from '@/components/InterventionPanel';
import { CollabTabs } from '@/components/CollabTabs';
import { JitsiFrame } from '@/components/JitsiFrame';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { POLL_MS, type JoinData, type Queue } from '@/lib/online';

interface GuestState { title: string; status: string; guest: string | null; enabled: boolean; window_open: boolean; kinds: string[]; me: { can_join: boolean; can_request: boolean }; queue: Queue | null }

/** Public page for an external guest: join the video call and ask for the floor. The personal link is the credential; a guest is never a moderator. */
export function MeetingGuestJoinPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const base = `/public/meeting-online/${token}`;
  const key = ['meeting-online-guest', token];
  const [join, setJoin] = useState<JoinData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: key, retry: false, refetchInterval: POLL_MS, queryFn: async () => (await api.get<{ data: GuestState }>(base)).data.data });
  const act = useMutation({ mutationFn: async (v: { path: string; body?: object }) => (await api.post<{ data: GuestState }>(base + v.path, v.body ?? {})).data.data,
    onSuccess: (s) => qc.setQueryData(key, s), onError: (e) => setError(parseError(e).message) });
  const doJoin = useMutation({ mutationFn: async () => (await api.post<{ data: JoinData }>(`${base}/join`)).data.data, onSuccess: (j) => { setError(null); setJoin(j); }, onError: (e) => setError(parseError(e).message) });
  const leave = () => { setJoin(null); api.post(`${base}/leave`).catch(() => undefined); };
  const s = q.data;

  return (
    <Container size="lg" py="xl">
      <Group justify="flex-end" mb="sm"><LanguageSwitcher /></Group>
      {q.isLoading && <Center><Loader /></Center>}
      {q.isError && <Alert color="red" variant="light" title={t('meet.rsvp_not_found_title')}>{t('meet.rsvp_not_found')}</Alert>}
      {s && (
        <Stack gap="md">
          <Card withBorder padding="lg">
            <Text size="xs" c="dimmed" tt="uppercase">{t('onl.title')}</Text>
            <Title order={3}>{s.title}</Title>
            {s.guest && <Text size="sm">{t('meet.rsvp_hello', { name: s.guest })}</Text>}
            {!s.enabled && <Alert color="gray" variant="light" mt="sm">{t('onl.guest_not_allowed')}</Alert>}
            {s.enabled && !join && (
              <Group mt="sm" justify="space-between" wrap="wrap"><Text size="sm" c="dimmed">{s.me.can_join ? t('onl.open_now') : t('onl.opens_soon')}</Text>
                <Button size="md" leftSection={<IconVideo size={18} />} disabled={!s.me.can_join} loading={doJoin.isPending} onClick={() => doJoin.mutate()}>{t('onl.join')}</Button></Group>
            )}
            {error && <Alert color="red" variant="light" mt="sm">{error}</Alert>}
          </Card>
          {s.enabled && (
            <Group align="flex-start" wrap="wrap" grow preventGrowOverflow={false}>
              {join && (<Stack gap="xs" style={{ flex: '2 1 480px' }}><JitsiFrame join={join} onLeave={leave} />
                <Group justify="flex-end"><Button size="xs" variant="light" color="red" leftSection={<IconDoorExit size={14} />} onClick={leave}>{t('onl.leave')}</Button></Group></Stack>)}
              <div style={{ flex: '1 1 280px' }}>
                <InterventionPanel queue={s.queue} kinds={s.kinds} canRequest={s.me.can_request} canFloor={false} busy={act.isPending}
                  onRequest={(kind, topic) => act.mutate({ path: '/interventions', body: { kind, topic: topic || null } })} onWithdraw={(id) => act.mutate({ path: `/interventions/${id}/withdraw` })} />
              </div>
            </Group>
          )}
          {s.enabled && <CollabTabs base={base} staff={false} />}
        </Stack>
      )}
    </Container>
  );
}
