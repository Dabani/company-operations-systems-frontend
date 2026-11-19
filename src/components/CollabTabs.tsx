import { Card, Tabs } from '@mantine/core';
import { IconChartBar, IconMessage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '@/components/ChatPanel';
import { PollsPanel } from '@/components/PollsPanel';

/** Chat and polls side by side as two tabs. `base` is the meeting's API root (staff) or the guest's public root. */
export function CollabTabs({ base, staff, agenda, guestsMayVote }: { base: string; staff: boolean; agenda?: { id: string; title: string }[]; guestsMayVote?: boolean }) {
  const { t } = useTranslation();
  return (
    <Card withBorder padding="sm">
      <Tabs defaultValue="chat" keepMounted={false}>
        <Tabs.List mb="xs">
          <Tabs.Tab value="chat" leftSection={<IconMessage size={14} />}>{t('chat.title')}</Tabs.Tab>
          <Tabs.Tab value="polls" leftSection={<IconChartBar size={14} />}>{t('poll.title')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="chat"><ChatPanel url={`${base}/chat`} removeUrl={staff ? (id) => `/meeting-chat/${id}` : undefined} /></Tabs.Panel>
        <Tabs.Panel value="polls">
          <PollsPanel url={`${base}/polls`} voteUrl={(id) => (staff ? `/meeting-polls/${id}/vote` : `${base}/polls/${id}/vote`)} closeUrl={staff ? (id) => `/meeting-polls/${id}/close` : undefined} agenda={agenda} guestsMayVote={staff && guestsMayVote} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}
