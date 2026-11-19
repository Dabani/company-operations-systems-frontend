import { ActionIcon, Alert, Badge, Button, Card, Checkbox, Group, Modal, NumberInput, Progress, Radio, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { CHAT_POLL_MS, choicesOk, pollFormOk, type Poll, type PollsResponse } from '@/lib/collab';
import { toastError } from '@/lib/ui';

interface Props { url: string; voteUrl: (pollId: string) => string; closeUrl?: (pollId: string) => string; agenda?: { id: string; title: string }[]; guestsMayVote?: boolean }

/** Polls of the meeting: hosts create and close them, participants vote, results show as bars once a poll is closed (hosts see the running count). */
export function PollsPanel({ url, voteUrl, closeUrl, agenda = [], guestsMayVote = false }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['meeting-polls', url];
  const [creating, setCreating] = useState(false);
  const q = useQuery({ queryKey: key, refetchInterval: CHAT_POLL_MS, queryFn: async () => (await api.get<PollsResponse>(url)).data });
  const set = (r: PollsResponse) => qc.setQueryData(key, r);
  const close = useMutation({ mutationFn: async (id: string) => (await api.post<PollsResponse>(closeUrl!(id))).data, onSuccess: set, onError: toastError });
  const polls = q.data?.data ?? [];
  return (
    <Stack gap="xs">
      {q.data?.meta.can_create && <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>{t('poll.new')}</Button>}
      {polls.length === 0 && <Text size="xs" c="dimmed">{t('poll.empty')}</Text>}
      {polls.map((p) => <PollCard key={p.id} poll={p} voteUrl={voteUrl(p.id)} onChanged={set} onClose={closeUrl ? () => close.mutate(p.id) : undefined} closing={close.isPending} />)}
      {creating && <CreatePollModal url={url} agenda={agenda} guestsMayVote={guestsMayVote} onClose={() => setCreating(false)} onCreated={(r) => { set(r); setCreating(false); }} />}
    </Stack>
  );
}

function PollCard({ poll: p, voteUrl, onChanged, onClose, closing }: { poll: Poll; voteUrl: string; onChanged: (r: PollsResponse) => void; onClose?: () => void; closing: boolean }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const vote = useMutation({ mutationFn: async () => (await api.post<PollsResponse>(voteUrl, { option_ids: sel })).data, onSuccess: (r) => { setError(null); onChanged(r); }, onError: (e) => setError(parseError(e).message) });
  const showBars = p.options.some((o) => o.votes !== undefined);
  const names = new Map(p.options.map((o) => [o.id, o.label]));
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Text size="sm" fw={600}>{p.question}</Text>
        <Badge size="xs" color={p.status === 'open' ? 'green' : 'gray'}>{t(`poll.status.${p.status}`)}</Badge>
      </Group>
      <Group gap={4} my={4}>
        {p.agenda_item && <Badge size="xs" variant="outline">{p.agenda_item}</Badge>}
        {p.anonymous && <Badge size="xs" variant="light">{t('poll.anonymous')}</Badge>}
        {p.multiple && <Badge size="xs" variant="light">{p.max_choices ? t('poll.up_to', { n: p.max_choices }) : t('poll.multiple')}</Badge>}
      </Group>
      {p.can_vote ? (
        <Stack gap={6}>
          {p.multiple
            ? <Checkbox.Group value={sel} onChange={setSel}><Stack gap={4}>{p.options.map((o) => <Checkbox key={o.id} value={o.id} label={o.label} />)}</Stack></Checkbox.Group>
            : <Radio.Group value={sel[0] ?? null} onChange={(v) => setSel([v])}><Stack gap={4}>{p.options.map((o) => <Radio key={o.id} value={o.id} label={o.label} />)}</Stack></Radio.Group>}
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <Button size="xs" loading={vote.isPending} disabled={!choicesOk(sel.length, p.multiple, p.max_choices, p.options.length)} onClick={() => vote.mutate()}>{t('poll.vote')}</Button>
        </Stack>
      ) : (
        <Stack gap={6}>
          {p.options.map((o) => (
            <div key={o.id}>
              <Group justify="space-between" gap="xs"><Text size="xs" fw={o.leader ? 700 : 400}>{o.label}{p.my_options.includes(o.id) ? ' ✓' : ''}</Text>{showBars && <Text size="xs" c="dimmed">{o.votes} ({o.percent} %)</Text>}</Group>
              {showBars && <Progress size="sm" value={o.percent ?? 0} color={o.leader ? 'green' : 'blue'} />}
            </div>))}
          {p.has_voted && p.status === 'open' && <Text size="xs" c="dimmed">{t('poll.voted')}</Text>}
          {!p.has_voted && p.status === 'open' && !showBars && <Text size="xs" c="dimmed">{t('poll.cannot_vote')}</Text>}
          {!showBars && p.status === 'open' && p.has_voted && <Text size="xs" c="dimmed">{t('poll.results_later')}</Text>}
        </Stack>
      )}
      {p.voters !== null && <Text size="xs" c="dimmed" mt={4}>{t('poll.voters', { n: p.voters })}</Text>}
      {p.voter_names && p.voter_names.length > 0 && <Text size="xs" c="dimmed" mt={2}>{p.voter_names.map((v) => `${v.name}: ${v.options.map((id) => names.get(id)).join(', ')}`).join(' · ')}</Text>}
      {onClose && p.status === 'open' && <Button mt="xs" size="xs" variant="light" color="red" loading={closing} onClick={onClose}>{t('poll.close')}</Button>}
    </Card>
  );
}

function CreatePollModal({ url, agenda, guestsMayVote, onClose, onCreated }: { url: string; agenda: { id: string; title: string }[]; guestsMayVote: boolean; onClose: () => void; onCreated: (r: PollsResponse) => void }) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [max, setMax] = useState<number | string>(0);
  const [anonymous, setAnonymous] = useState(false);
  const [guests, setGuests] = useState(false);
  const [item, setItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => (await api.post<PollsResponse>(url, { question: question.trim(), options: options.map((o) => o.trim()), multiple, max_choices: multiple ? Number(max) || 0 : 0, anonymous, guests_vote: guests, agenda_item_id: item })).data,
    onSuccess: onCreated, onError: (e) => setError(parseError(e).message),
  });
  return (
    <Modal opened onClose={onClose} centered title={t('poll.new')}>
      <Stack gap="sm">
        <TextInput label={t('poll.question')} required maxLength={300} value={question} onChange={(e) => setQuestion(e.currentTarget.value)} />
        {options.map((o, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput style={{ flex: 1 }} label={i === 0 ? t('poll.options') : undefined} placeholder={t('poll.option_n', { n: i + 1 })} maxLength={150} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
            {options.length > 2 && <ActionIcon variant="subtle" color="red" aria-label={t('chat.remove')} onClick={() => setOptions(options.filter((_, j) => j !== i))}><IconX size={14} /></ActionIcon>}
          </Group>))}
        {options.length < 10 && <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={() => setOptions([...options, ''])} style={{ alignSelf: 'flex-start' }}>{t('poll.add_option')}</Button>}
        <Switch label={t('poll.multiple')} checked={multiple} onChange={(e) => setMultiple(e.currentTarget.checked)} />
        {multiple && <NumberInput label={t('poll.max_choices')} description={t('poll.max_choices_help')} min={0} max={options.length} value={max} onChange={setMax} />}
        <Switch label={t('poll.anonymous')} description={t('poll.anonymous_help')} checked={anonymous} onChange={(e) => setAnonymous(e.currentTarget.checked)} />
        {guestsMayVote && <Switch label={t('poll.guests_vote')} checked={guests} onChange={(e) => setGuests(e.currentTarget.checked)} />}
        {agenda.length > 0 && <Select clearable label={t('onl.agenda_item')} value={item} onChange={setItem} data={agenda.map((a) => ({ value: a.id, label: a.title }))} />}
        {error && <Alert color="red" variant="light">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button loading={create.isPending} disabled={!pollFormOk(question, options)} onClick={() => { setError(null); create.mutate(); }}>{t('poll.open')}</Button></Group>
      </Stack>
    </Modal>
  );
}
