import { Affix, ActionIcon, Box, Button, Group, Paper, ScrollArea, Stack, Text, TextInput, Transition } from '@mantine/core';
import { IconHeadset, IconRobot, IconSend, IconUserHeart, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { realtimeEnabled, useEchoEvent } from '@/lib/echo';
import { toastError } from '@/lib/ui';

export interface ChatMsg { id: number; sender: 'user' | 'agent' | 'bot'; name: string | null; body: string; mine: boolean; created_at: string }
export interface ChatConv { id: string; status: 'bot' | 'waiting_agent' | 'with_agent' | 'closed'; agent: string | null; user: string; suggestion: string | null; messages: ChatMsg[] }

export function Bubble({ m }: { m: ChatMsg }) {
  const mine = m.mine;
  const Icon = m.sender === 'bot' ? IconRobot : IconUserHeart;
  return (
    <Group justify={mine ? 'flex-end' : 'flex-start'} align="flex-end" gap={6} wrap="nowrap">
      {!mine && <Icon size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />}
      <Box maw="82%" px="sm" py={6} style={{
        borderRadius: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13,
        background: mine ? 'var(--mantine-color-brand-6)' : 'var(--mantine-color-default-hover)', color: mine ? '#fff' : undefined,
      }}>{m.body}</Box>
    </Group>
  );
}

/** Floating support chat: starts with the bot, can hand over to a human agent, can turn into a case. */
export function ChatWidget() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ['chat'], enabled: open,
    queryFn: async () => (await api.get<{ data: ChatConv }>('/chat/conversation')).data.data,
    refetchInterval: open ? (realtimeEnabled ? 30_000 : 4_000) : false,
  });
  const conv = q.data;

  useEchoEvent(conv?.id ? `chat.${conv.id}` : null, '.chat.updated', () => void qc.invalidateQueries({ queryKey: ['chat'] }));
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [conv?.messages.length, open]);

  const send = useMutation({
    mutationFn: async (message: string) => (await api.post<{ data: ChatConv }>('/chat/conversation/messages', { message })).data.data,
    onSuccess: (d) => qc.setQueryData(['chat'], d),
    onError: toastError,
  });
  const escalate = useMutation({
    mutationFn: async () => (await api.post<{ data: ChatConv }>('/chat/conversation/escalate')).data.data,
    onSuccess: (d) => qc.setQueryData(['chat'], d),
    onError: toastError,
  });
  const end = useMutation({
    mutationFn: async () => api.post('/chat/conversation/close'),
    onSuccess: () => { qc.removeQueries({ queryKey: ['chat'] }); setOpen(false); },
  });

  const submit = () => { const m = text.trim(); if (!m || send.isPending) return; setText(''); send.mutate(m); };

  const subtitle = !conv ? '' : conv.status === 'waiting_agent' ? t('chat.waiting') : conv.status === 'with_agent' ? t('chat.with_agent', { name: conv.agent ?? '' }) : t('chat.assistant');

  return (
    <Affix position={{ bottom: 'calc(16px + env(safe-area-inset-bottom))', right: 16 }} zIndex={300} className="no-print">
      <Transition transition="slide-up" mounted={open}>
        {(styles) => (
          <Paper style={styles} shadow="xl" withBorder radius="lg" w={{ base: 'calc(100vw - 32px)', sm: 380 }} mb="sm" display="flex"
            h={{ base: 'min(70dvh, 520px)', sm: 520 }} bg="var(--mantine-color-body)" >
            <Stack gap={0} w="100%" h="100%">
              <Group justify="space-between" p="sm" style={{ background: 'linear-gradient(135deg, var(--mantine-color-brand-6), var(--mantine-color-secondary-6))', color: '#fff', borderRadius: '16px 16px 0 0' }}>
                <Group gap="xs"><IconHeadset size={22} /><div><Text fw={700} size="sm" c="white" lh={1.2}>{t('chat.title')}</Text><Text size="xs" c="white" opacity={0.85}>{subtitle}</Text></div></Group>
                <ActionIcon variant="transparent" c="white" onClick={() => setOpen(false)} aria-label={t('common.close')}><IconX size={18} /></ActionIcon>
              </Group>

              <ScrollArea style={{ flex: 1 }} p="sm" type="auto">
                <Stack gap={8} p="sm">
                  {conv?.messages.map((m) => <Bubble key={m.id} m={m} />)}
                  <div ref={bottom} />
                </Stack>
              </ScrollArea>

              <Stack gap={6} p="sm" pt={4} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Group gap={6}>
                  {conv?.status === 'bot' && <Button size="compact-xs" variant="light" leftSection={<IconUserHeart size={14} />} loading={escalate.isPending} onClick={() => escalate.mutate()}>{t('chat.talk_agent')}</Button>}
                  <Button size="compact-xs" variant={conv?.suggestion ? 'filled' : 'light'} color="secondary" onClick={() => { setOpen(false); nav('/cases?new=1'); }}>{t('chat.create_case')}</Button>
                  <Button size="compact-xs" variant="subtle" color="gray" ml="auto" onClick={() => end.mutate()}>{t('chat.end')}</Button>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <TextInput flex={1} value={text} placeholder={t('chat.placeholder')} maxLength={2000} onChange={(e) => setText(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
                  <ActionIcon size="lg" onClick={submit} loading={send.isPending} aria-label={t('case.send')}><IconSend size={18} /></ActionIcon>
                </Group>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Transition>
      <Group justify="flex-end">
        <ActionIcon size={56} radius="xl" variant="gradient" gradient={{ from: 'brand.6', to: 'secondary.6', deg: 135 }} onClick={() => setOpen((o) => !o)} aria-label={t('chat.title')} style={{ boxShadow: 'var(--mantine-shadow-lg)' }}>
          {open ? <IconX size={26} /> : <IconHeadset size={28} />}
        </ActionIcon>
      </Group>
    </Affix>
  );
}

