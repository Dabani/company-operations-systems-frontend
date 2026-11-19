import { ActionIcon, Badge, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { IconSend, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { CHAT_MAX, CHAT_POLL_MS, messageOk, shouldStick, type ChatResponse } from '@/lib/collab';
import { toastError } from '@/lib/ui';

/** Meeting chat. Polls the server every few seconds; `url` serves GET (messages) and POST (send); `removeUrl` (hosts only) deletes one message's text. */
export function ChatPanel({ url, removeUrl, height = 360 }: { url: string; removeUrl?: (id: string) => string; height?: number }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const key = ['meeting-chat', url];
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const q = useQuery({ queryKey: key, refetchInterval: CHAT_POLL_MS, queryFn: async () => (await api.get<ChatResponse>(url)).data });
  const send = useMutation({
    mutationFn: async () => (await api.post<ChatResponse>(url, { body: text.trim() })).data,
    onSuccess: (r) => { qc.setQueryData(key, r); setText(''); setError(null); stick.current = true; },
    onError: (e) => setError(parseError(e).message),
  });
  const remove = useMutation({ mutationFn: async (id: string) => { await api.delete(removeUrl!(id)); }, onSuccess: () => qc.invalidateQueries({ queryKey: key }), onError: toastError });
  const messages = q.data?.data ?? [];
  useEffect(() => { if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages.length]);

  return (
    <Stack gap="xs">
      <div ref={box} style={{ height, overflowY: 'auto', padding: 4 }} onScroll={(e) => { const el = e.currentTarget; stick.current = shouldStick(el.scrollTop, el.clientHeight, el.scrollHeight); }}>
        {messages.length === 0 && <Text size="xs" c="dimmed">{t('chat.empty')}</Text>}
        <Stack gap={6}>
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
              <Group gap={6} justify={m.mine ? 'flex-end' : 'flex-start'}>
                <Text size="xs" fw={600}>{m.mine ? t('chat.you') : m.name}</Text>
                {m.host && <Badge size="xs" variant="light">{t('chat.host')}</Badge>}
                {m.is_guest && <Badge size="xs" variant="outline">{t('meet.guest')}</Badge>}
                <Text size="xs" c="dimmed">{new Date(m.at).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}</Text>
                {removeUrl && q.data?.meta.can_remove && !m.removed && <ActionIcon size="xs" variant="subtle" color="red" aria-label={t('chat.remove')} title={t('chat.remove')} onClick={() => remove.mutate(m.id)}><IconTrash size={12} /></ActionIcon>}
              </Group>
              {m.removed ? <Text size="sm" c="dimmed" fs="italic">{t('chat.removed')}</Text> : <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</Text>}
            </div>
          ))}
        </Stack>
      </div>
      {q.data?.meta.can_post ? (
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Textarea style={{ flex: 1 }} size="xs" autosize minRows={1} maxRows={4} maxLength={CHAT_MAX} placeholder={t('chat.placeholder')} value={text} error={error} onChange={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && messageOk(text)) { e.preventDefault(); send.mutate(); } }} />
          <Button size="xs" leftSection={<IconSend size={14} />} loading={send.isPending} disabled={!messageOk(text)} onClick={() => send.mutate()}>{t('chat.send')}</Button>
        </Group>
      ) : <Text size="xs" c="dimmed">{t('chat.read_only')}</Text>}
    </Stack>
  );
}
