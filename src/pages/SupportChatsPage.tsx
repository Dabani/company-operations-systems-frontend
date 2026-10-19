import { ActionIcon, Badge, Box, Button, Card, Group, ScrollArea, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconArrowLeft, IconMessages, IconSend } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Bubble, type ChatConv } from '@/components/ChatWidget';
import { PageHeader } from '@/components/PageHeader';
import { realtimeEnabled, useEchoEvent } from '@/lib/echo';
import { timeAgo } from '@/lib/time';
import { toastError } from '@/lib/ui';

interface Row { id: string; status: string; user: string; agent: string | null; preview: string; last_message_at: string }

/** Agent console: answer conversations that asked for a human. */
export function SupportChatsPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const qc = useQueryClient();
  const narrow = useMediaQuery('(max-width: 62em)');
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  const list = useQuery({
    queryKey: ['agent-chats', tab],
    queryFn: async () => (await api.get<{ data: Row[] }>('/chat/conversations', { params: { status: tab === 'closed' ? 'closed' : undefined } })).data.data,
    refetchInterval: realtimeEnabled ? 30_000 : 8_000,
  });
  const thread = useQuery({
    queryKey: ['agent-chat', sel], enabled: !!sel,
    queryFn: async () => (await api.get<{ data: ChatConv }>(`/chat/conversations/${sel}`)).data.data,
    refetchInterval: realtimeEnabled ? 30_000 : 5_000,
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['agent-chats'] }); void qc.invalidateQueries({ queryKey: ['agent-chat'] }); };
  useEchoEvent(me ? `org.${me.organization.id}.agents` : null, '.chat.updated', refresh);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread.data?.messages.length]);

  const send = useMutation({
    mutationFn: async (m: string) => (await api.post<{ data: ChatConv }>(`/chat/conversations/${sel}/messages`, { message: m })).data.data,
    onSuccess: (d) => { qc.setQueryData(['agent-chat', sel], d); refresh(); },
    onError: toastError,
  });
  const close = useMutation({ mutationFn: async () => api.post(`/chat/conversations/${sel}/close`), onSuccess: () => { setSel(null); refresh(); } });

  const submit = () => { const m = text.trim(); if (!m || !sel) return; setText(''); send.mutate(m); };
  const showList = !narrow || !sel;
  const showThread = !narrow || !!sel;

  return (
    <>
      <PageHeader title={t('chat.console')} />
      <Group align="stretch" gap="md" wrap="nowrap" h="calc(100dvh - 190px)" mih={420}>
        {showList && (
          <Card padding="xs" w={narrow ? '100%' : 340} style={{ flexShrink: 0 }}>
            <SegmentedControl fullWidth mb="xs" value={tab} onChange={(v) => { setTab(v as 'active' | 'closed'); setSel(null); }} data={[{ value: 'active', label: t('chat.active') }, { value: 'closed', label: t('chat.closed') }]} />
            <ScrollArea style={{ flex: 1 }}>
              <Stack gap={4}>
                {(list.data ?? []).length === 0 && <Text size="sm" c="dimmed" ta="center" py="lg">{t('chat.no_active')}</Text>}
                {(list.data ?? []).map((r) => (
                  <Box key={r.id} p="xs" onClick={() => setSel(r.id)} style={{ cursor: 'pointer', borderRadius: 8, background: sel === r.id ? 'var(--mantine-color-brand-light)' : undefined }}>
                    <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600} truncate>{r.user}</Text>
                      {r.status === 'waiting_agent' && <Badge size="xs" color="orange">{t('chat.waiting')}</Badge>}</Group>
                    <Text size="xs" c="dimmed" lineClamp={1}>{r.preview}</Text>
                    <Text size="10px" c="dimmed">{timeAgo(r.last_message_at)}</Text>
                  </Box>
                ))}
              </Stack>
            </ScrollArea>
          </Card>
        )}

        {showThread && (
          <Card padding={0} flex={1} style={{ minWidth: 0 }}>
            {!sel || !thread.data ? (
              <Stack align="center" justify="center" h="100%" c="dimmed"><IconMessages size={40} /><Text size="sm">{t('chat.select')}</Text></Stack>
            ) : (
              <Stack gap={0} h="100%">
                <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                  <Group gap="xs">{narrow && <ActionIcon variant="subtle" onClick={() => setSel(null)} aria-label={t('common.back')}><IconArrowLeft size={18} /></ActionIcon>}
                    <Text fw={700}>{thread.data.user}</Text></Group>
                  {thread.data.status !== 'closed' && <Button size="compact-sm" variant="light" color="gray" loading={close.isPending} onClick={() => close.mutate()}>{t('chat.close_conv')}</Button>}
                </Group>
                <ScrollArea style={{ flex: 1 }} type="auto"><Stack gap={8} p="sm">{thread.data.messages.map((m) => <Bubble key={m.id} m={{ ...m, mine: m.sender === 'agent' }} />)}<div ref={bottom} /></Stack></ScrollArea>
                {thread.data.status !== 'closed' && (
                  <Group gap={6} p="sm" wrap="nowrap" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                    <TextInput flex={1} value={text} placeholder={t('chat.reply')} maxLength={2000} onChange={(e) => setText(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
                    <ActionIcon size="lg" onClick={submit} loading={send.isPending} aria-label={t('case.send')}><IconSend size={18} /></ActionIcon>
                  </Group>
                )}
              </Stack>
            )}
          </Card>
        )}
      </Group>
    </>
  );
}
