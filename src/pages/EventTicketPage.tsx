import { Alert, Badge, Button, Card, Center, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { REG_COLOR, ticketUrl } from '@/lib/events';
import { fmtRange } from '@/lib/meetings';
import type { PublicEvent } from '@/pages/EventRegisterPage';

interface Ticket { event: PublicEvent; name: string; status: string; ticket: string | null; can_cancel: boolean }

/** A guest's personal ticket: the QR code is read at the entrance. The link is the credential, so nothing else about the person is shown. */
export function EventTicketPage() {
  const { t, i18n } = useTranslation();
  const { ticket = '' } = useParams();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['public-ticket', ticket], retry: false, queryFn: async () => (await api.get<{ data: Ticket }>(`/public/event-ticket/${ticket}`)).data.data });
  const cancel = useMutation({
    mutationFn: async () => (await api.delete<{ data: Ticket }>(`/public/event-ticket/${ticket}`)).data.data,
    onSuccess: () => { setConfirm(false); void q.refetch(); },
    onError: (e) => { setConfirm(false); setError(parseError(e).message); },
  });
  const d = q.data;

  return (
    <Container size="xs" py="xl">
      <Group justify="flex-end" mb="sm"><LanguageSwitcher /></Group>
      {q.isLoading && <Center><Loader /></Center>}
      {q.isError && <Alert color="red" variant="light" title={t('ev.ticket_not_found_title')}>{t('ev.ticket_not_found')}</Alert>}
      {d && (
        <Card withBorder padding="lg">
          <Stack gap="sm" align="center">
            <Text size="xs" c="dimmed" tt="uppercase">{t('ev.ticket')}</Text>
            <Title order={3} ta="center">{d.event.title}</Title>
            <Text size="sm" ta="center">{fmtRange(d.event.starts_at, d.event.ends_at, d.event.timezone, i18n.language)} ({d.event.timezone})</Text>
            {d.event.venue && <Text size="sm">{d.event.venue}</Text>}
            <Text fw={600}>{d.name}</Text>
            <Badge color={REG_COLOR[d.status]} variant="light">{t(`ev.reg.${d.status}`)}</Badge>
            {d.status === 'registered' && d.ticket && (
              <>
                <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}><QRCodeSVG value={ticketUrl(window.location.origin, d.ticket)} size={200} /></div>
                <Text size="xs" c="dimmed" ta="center">{t('ev.ticket_hint')}</Text>
              </>)}
            {d.status === 'waitlisted' && <Alert color="orange" variant="light">{t('ev.pub_waitlisted')}</Alert>}
            {d.event.status === 'cancelled' && <Alert color="red" variant="light">{t('ev.pub_cancelled')}</Alert>}
            {error && <Alert color="red" variant="light">{error}</Alert>}
            {d.can_cancel && <Button variant="subtle" color="red" onClick={() => setConfirm(true)}>{t('ev.cancel_my')}</Button>}
          </Stack>
        </Card>
      )}
      <ConfirmModal opened={confirm} onClose={() => setConfirm(false)} loading={cancel.isPending} title={t('ev.cancel_my')} text={t('ev.cancel_my_text')} onConfirm={() => cancel.mutate()} />
    </Container>
  );
}
