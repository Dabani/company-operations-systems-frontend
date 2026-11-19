import { Alert, Button, Card, Grid, Group, Stack, Switch, Text } from '@mantine/core';
import { IconDoorExit, IconVideo } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { InterventionPanel } from '@/components/InterventionPanel';
import { CollabTabs } from '@/components/CollabTabs';
import { JitsiFrame } from '@/components/JitsiFrame';
import { POLL_MS, type JoinData, type Queue } from '@/lib/online';
import { toastError } from '@/lib/ui';

interface State {
  org_enabled: boolean; enabled: boolean; allow_guests: boolean; status: string; confidential: boolean; window_open: boolean; domain: string; signed: boolean; kinds: string[];
  me: { can_manage: boolean; is_participant: boolean; can_join: boolean; is_moderator: boolean; can_floor: boolean; can_request: boolean };
  queue: Queue | null; agenda: { id: string; title: string }[];
}

/** Online meeting: switch the video room on, join the call inside the page, and run the queue of interventions. Polls while the room is on. */
export function MeetingOnlineTab({ meetingId }: { meetingId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['meeting-online', meetingId];
  const [join, setJoin] = useState<JoinData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: key, refetchInterval: (query) => (query.state.data?.enabled ? POLL_MS : false), queryFn: async () => (await api.get<{ data: State }>(`/meetings/${meetingId}/online`)).data.data });
  const set = (s: State) => qc.setQueryData(key, s);
  const act = useMutation({ mutationFn: async (v: { path: string; body?: object }) => (await api.post<{ data: State }>(v.path, v.body ?? {})).data.data, onSuccess: set, onError: toastError });
  const enable = (guests: boolean) => act.mutate({ path: `/meetings/${meetingId}/online/enable`, body: { allow_guests: guests } });
  const doJoin = useMutation({
    mutationFn: async () => (await api.post<{ data: JoinData }>(`/meetings/${meetingId}/online/join`)).data.data,
    onSuccess: (j) => { setError(null); setJoin(j); void qc.invalidateQueries({ queryKey: key }); },
    onError: (e) => setError(parseError(e).message),
  });
  const leave = () => { setJoin(null); api.post(`/meetings/${meetingId}/online/leave`).catch(() => undefined); void qc.invalidateQueries({ queryKey: key }); };

  const s = q.data;
  if (!s) return null;
  if (!s.org_enabled && !s.enabled) return <Alert color="gray" variant="light">{t('onl.org_disabled')}</Alert>;
  const closedStatus = !['draft', 'scheduled', 'in_progress'].includes(s.status);

  return (
    <Stack gap="md">
      {s.me.can_manage && !closedStatus && (
        <Card withBorder padding="sm">
          <Group justify="space-between" wrap="wrap">
            <div><Text fw={600} size="sm">{t('onl.room')}</Text><Text size="xs" c="dimmed">{s.enabled ? t('onl.room_on') : t('onl.room_off')}</Text></div>
            <Group>
              {s.enabled && <Switch label={t('onl.allow_guests')} disabled={s.confidential || act.isPending} checked={s.allow_guests} onChange={(e) => enable(e.currentTarget.checked)} />}
              {s.enabled
                ? <Button variant="light" color="red" loading={act.isPending} onClick={() => act.mutate({ path: `/meetings/${meetingId}/online/disable` })}>{t('onl.disable')}</Button>
                : <Button leftSection={<IconVideo size={16} />} loading={act.isPending} onClick={() => enable(false)}>{t('onl.enable')}</Button>}
            </Group>
          </Group>
          {s.enabled && s.confidential && <Text size="xs" c="dimmed" mt={4}>{t('onl.no_guests_confidential')}</Text>}
          {s.enabled && !s.signed && <Alert color="yellow" variant="light" mt="xs">{t('onl.unsigned')}</Alert>}
        </Card>
      )}
      {!s.enabled && !s.me.can_manage && <Alert color="gray" variant="light">{t('onl.not_online')}</Alert>}
      {s.enabled && (
        <>
          {!join && (
            <Card withBorder padding="md">
              <Group justify="space-between" wrap="wrap">
                <div><Text fw={600}>{t('onl.title')}</Text><Text size="sm" c="dimmed">{s.me.can_join ? t('onl.open_now') : closedStatus ? t('onl.over') : t('onl.opens_soon')}</Text></div>
                {s.me.is_participant && <Button size="md" leftSection={<IconVideo size={18} />} disabled={!s.me.can_join} loading={doJoin.isPending} onClick={() => doJoin.mutate()}>{t('onl.join')}</Button>}
              </Group>
              {error && <Alert color="red" variant="light" mt="sm">{error}</Alert>}
            </Card>
          )}
          <Grid gap="md">
            <Grid.Col span={{ base: 12, md: join ? 8 : 12 }}>
              {join && (<Stack gap="xs"><JitsiFrame join={join} onLeave={leave} />
                <Group justify="space-between"><Text size="xs" c="dimmed">{join.moderator ? t('onl.you_moderate') : t('onl.you_participate')}</Text><Button size="xs" variant="light" color="red" leftSection={<IconDoorExit size={14} />} onClick={leave}>{t('onl.leave')}</Button></Group></Stack>)}
            </Grid.Col>
            {s.me.is_participant && (
              <Grid.Col span={{ base: 12, md: join ? 4 : 12 }}>
                <InterventionPanel queue={s.queue} kinds={s.kinds} canRequest={s.me.can_request} canFloor={s.me.can_floor} agenda={s.agenda} busy={act.isPending}
                  onRequest={(kind, topic, item) => act.mutate({ path: `/meetings/${meetingId}/interventions`, body: { kind, topic: topic || null, agenda_item_id: item } })}
                  onWithdraw={(id) => act.mutate({ path: `/meeting-interventions/${id}/withdraw` })} onGrant={(id) => act.mutate({ path: `/meeting-interventions/${id}/grant` })}
                  onFinish={(id) => act.mutate({ path: `/meeting-interventions/${id}/finish` })} onDismiss={(id) => act.mutate({ path: `/meeting-interventions/${id}/dismiss` })} />
              </Grid.Col>
            )}
          </Grid>
          {s.me.is_participant && <CollabTabs base={`/meetings/${meetingId}`} staff agenda={s.agenda} guestsMayVote={s.allow_guests && !s.confidential} />}
        </>
      )}
    </Stack>
  );
}
