import { ActionIcon, Anchor, Box, Group, Indicator, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications as toast } from '@mantine/notifications';
import { IconBell, IconBellOff, IconChecks } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { realtimeEnabled, useEchoEvent } from '@/lib/echo';
import { timeAgo } from '@/lib/time';

interface Item { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }

/** Live notifications: websocket push when Reverb is configured, otherwise polling. */
export function NotificationBell() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<{ data: Item[]; unread: number }>('/notifications')).data,
    refetchInterval: realtimeEnabled ? 60_000 : 20_000,
  });

  useEchoEvent<{ title: string; body: string | null }>(me ? `users.${me.id}` : null, '.notification.created', (n) => {
    toast.show({ title: n.title, message: n.body ?? '', color: 'brand', autoClose: 6000 });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  });

  const read = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = q.data?.unread ?? 0;
  const items = q.data?.data ?? [];

  return (
    <Popover opened={open} onChange={setOpen} width={340} position="bottom-end" shadow="md">
      <Popover.Target>
        <Indicator label={unread > 9 ? '9+' : unread} disabled={unread === 0} color="red" size={16} offset={4}>
          <ActionIcon variant="subtle" size="lg" aria-label={t('notif.title')} onClick={() => setOpen((o) => !o)}><IconBell size={20} /></ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" p="sm" pb={6}>
          <Text fw={600} size="sm">{t('notif.title')}</Text>
          {unread > 0 && <Anchor size="xs" component="button" onClick={() => readAll.mutate()}><Group gap={4}><IconChecks size={14} />{t('notif.mark_all')}</Group></Anchor>}
        </Group>
        <ScrollArea.Autosize mah={380}>
          {items.length === 0 ? (
            <Stack align="center" gap={4} py="lg" c="dimmed"><IconBellOff size={28} /><Text size="sm">{t('notif.empty')}</Text></Stack>
          ) : items.map((n) => (
            <UnstyledButton key={n.id} w="100%" px="sm" py="xs"
              style={{ borderTop: '1px solid var(--mantine-color-default-border)', background: n.read ? undefined : 'var(--mantine-color-brand-light)' }}
              onClick={() => { if (!n.read) read.mutate(n.id); setOpen(false); if (n.link) nav(n.link); }}>
              <Box>
                <Text size="sm" fw={n.read ? 500 : 700} lineClamp={1}>{n.title}</Text>
                {n.body && <Text size="xs" c="dimmed" lineClamp={2}>{n.body}</Text>}
                <Text size="10px" c="dimmed" mt={2}>{timeAgo(n.created_at)}</Text>
              </Box>
            </UnstyledButton>
          ))}
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
