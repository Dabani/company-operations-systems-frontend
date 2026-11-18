import { Alert, Button, Card, Center, Container, Group, Loader, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { api, parseError } from '@/api/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SafeHtml } from '@/components/SafeHtml';
import { fmtRange } from '@/lib/meetings';

export interface PublicEvent { title: string; description: string | null; type: string | null; status: string; timezone: string; starts_at: string; ends_at: string; venue: string | null; online_url: string | null; free_seats: number | null; waitlist_enabled: boolean; can_register: boolean }

/** Public sign-up page for people without an account: the link given by the organizer is the credential. Shows only the event's public facts. */
export function EventRegisterPage() {
  const { t, i18n } = useTranslation();
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['public-event', token], retry: false, queryFn: async () => (await api.get<{ data: PublicEvent }>(`/public/event/${token}`)).data.data });
  const form = useForm({ initialValues: { name: '', email: '', phone: '', organization: '' } });
  const send = useMutation({
    mutationFn: async (v: typeof form.values) => (await api.post<{ data: { ticket: string | null; status: string } }>(`/public/event/${token}/register`, { name: v.name, email: v.email, phone: v.phone || null, organization: v.organization || null })).data.data,
    onError: (e) => form.setErrors(parseError(e).fields),
  });
  const e = q.data;
  const full = e && e.free_seats === 0;

  return (
    <Container size="xs" py="xl">
      <Group justify="flex-end" mb="sm"><LanguageSwitcher /></Group>
      {q.isLoading && <Center><Loader /></Center>}
      {q.isError && <Alert color="red" variant="light" title={t('ev.pub_not_found_title')}>{t('ev.pub_not_found')}</Alert>}
      {e && (
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase">{t('ev.pub_event')}</Text>
            <Title order={3}>{e.title}</Title>
            <Text size="sm"><b>{t('meet.when')}:</b> {fmtRange(e.starts_at, e.ends_at, e.timezone, i18n.language)} ({e.timezone})</Text>
            {e.venue && <Text size="sm"><b>{t('ev.venue')}:</b> {e.venue}</Text>}
            {e.description && <SafeHtml html={e.description} />}
            {e.status === 'cancelled' && <Alert color="red" variant="light">{t('ev.pub_cancelled')}</Alert>}
            {send.data ? (
              <Alert color="green" variant="light" title={send.data.status === 'waitlisted' ? t('ev.pub_waitlisted_title') : t('ev.pub_done_title')}>
                {send.data.status === 'waitlisted' ? t('ev.pub_waitlisted') : t('ev.pub_done')}
                {send.data.ticket && <div style={{ marginTop: 8 }}><Button component="a" href={`/event-ticket/${send.data.ticket}`} size="xs">{t('ev.pub_open_ticket')}</Button></div>}
              </Alert>
            ) : e.can_register ? (
              <form onSubmit={form.onSubmit((v) => send.mutate(v))}>
                <Stack gap="xs">
                  {full && <Alert color="orange" variant="light">{e.waitlist_enabled ? t('ev.pub_full_waitlist') : t('ev.pub_full')}</Alert>}
                  <TextInput label={t('common.name')} required maxLength={150} {...form.getInputProps('name')} />
                  <TextInput label={t('common.email')} type="email" required maxLength={190} {...form.getInputProps('email')} />
                  <TextInput label={t('common.phone')} maxLength={40} {...form.getInputProps('phone')} />
                  <TextInput label={t('ev.guest_org')} maxLength={150} {...form.getInputProps('organization')} />
                  <Button type="submit" loading={send.isPending}>{full && e.waitlist_enabled ? t('ev.pub_join_waitlist') : t('ev.register')}</Button>
                </Stack>
              </form>
            ) : e.status !== 'cancelled' && <Text size="sm" c="dimmed">{t('ev.registration_closed')}</Text>}
          </Stack>
        </Card>
      )}
    </Container>
  );
}
