import { ActionIcon, Alert, Badge, Button, Card, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconCheck, IconHandStop, IconPlayerPlay, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KIND_COLOR, myPlace, type Queue, type QueueItem } from '@/lib/online';

interface Props {
  queue: Queue | null; kinds: string[]; canRequest: boolean; canFloor: boolean; agenda?: { id: string; title: string }[]; busy?: boolean;
  onRequest: (kind: string, topic: string, agendaItemId: string | null) => void; onWithdraw: (id: string) => void;
  onGrant?: (id: string) => void; onFinish?: (id: string) => void; onDismiss?: (id: string) => void;
}

/** The intervention queue: participants ask for the floor, everybody sees who is speaking and who is next, the chair gives the floor. */
export function InterventionPanel({ queue, kinds, canRequest, canFloor, agenda = [], busy, onRequest, onWithdraw, onGrant, onFinish, onDismiss }: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<string>('speak');
  const [topic, setTopic] = useState('');
  const [item, setItem] = useState<string | null>(null);
  const mine = myPlace(queue);
  const row = (x: QueueItem, speaking = false) => (
    <Group key={x.id} gap="xs" wrap="nowrap" align="flex-start">
      <Text size="sm" w={20} c="dimmed">{speaking ? '▶' : x.position}</Text>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6}><Text size="sm" fw={x.mine ? 700 : 500}>{x.name}</Text><Badge size="xs" variant="light" color={KIND_COLOR[x.kind]}>{t(`onl.kind.${x.kind}`)}</Badge>{x.is_guest && <Badge size="xs" variant="outline">{t('meet.guest')}</Badge>}</Group>
        {(x.topic || x.agenda_item) && <Text size="xs" c="dimmed" lineClamp={2}>{[x.agenda_item, x.topic].filter(Boolean).join(' — ')}</Text>}
      </div>
      {canFloor && !speaking && onGrant && <ActionIcon variant="light" color="green" aria-label={t('onl.grant')} title={t('onl.grant')} disabled={!!queue?.speaking || busy} onClick={() => onGrant(x.id)}><IconPlayerPlay size={14} /></ActionIcon>}
      {canFloor && !speaking && onDismiss && <ActionIcon variant="subtle" color="red" aria-label={t('onl.dismiss')} title={t('onl.dismiss')} disabled={busy} onClick={() => onDismiss(x.id)}><IconX size={14} /></ActionIcon>}
      {canFloor && speaking && onFinish && <ActionIcon variant="light" color="green" aria-label={t('onl.finish')} title={t('onl.finish')} disabled={busy} onClick={() => onFinish(x.id)}><IconCheck size={14} /></ActionIcon>}
      {!canFloor && x.mine && !speaking && <Button size="compact-xs" variant="subtle" color="red" onClick={() => onWithdraw(x.id)}>{t('onl.withdraw')}</Button>}
    </Group>
  );
  return (
    <Card withBorder padding="sm">
      <Title order={5} mb="xs">{t('onl.queue')}</Title>
      <Stack gap="xs">
        {mine?.kind === 'speaking' && <Alert color="green" variant="light">{t('onl.your_turn')}</Alert>}
        {mine?.kind === 'waiting' && <Alert color="blue" variant="light">{t('onl.your_place', { n: mine.position })}</Alert>}
        {queue?.speaking ? (<div><Text size="xs" c="dimmed" tt="uppercase">{t('onl.speaking')}</Text>{row(queue.speaking, true)}</div>) : <Text size="xs" c="dimmed">{t('onl.nobody_speaking')}</Text>}
        <div><Text size="xs" c="dimmed" tt="uppercase" mb={4}>{t('onl.waiting')} ({queue?.waiting.length ?? 0})</Text>
          <Stack gap={6}>{(queue?.waiting ?? []).map((x) => row(x))}{(queue?.waiting.length ?? 0) === 0 && <Text size="xs" c="dimmed">{t('onl.queue_empty')}</Text>}</Stack></div>
        {canRequest && (
          <Stack gap={6}>
            <Select size="xs" label={t('onl.kind_label')} allowDeselect={false} value={kind} onChange={(v) => setKind(v ?? 'speak')} data={kinds.map((k) => ({ value: k, label: t(`onl.kind.${k}`) }))} />
            {agenda.length > 0 && <Select size="xs" clearable label={t('onl.agenda_item')} value={item} onChange={setItem} data={agenda.map((a) => ({ value: a.id, label: a.title }))} />}
            <TextInput size="xs" label={t('onl.topic')} maxLength={200} value={topic} onChange={(e) => setTopic(e.currentTarget.value)} />
            <Button size="xs" leftSection={<IconHandStop size={14} />} loading={busy} onClick={() => { onRequest(kind, topic, item); setTopic(''); }}>{t('onl.request')}</Button>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
