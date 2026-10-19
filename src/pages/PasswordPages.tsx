import { Alert, Anchor, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCircleCheck } from '@tabler/icons-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, csrf, parseError } from '@/api/client';
import { BrandLogo } from '@/components/BrandLogo';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Center mih="100dvh" p="md">
      <Paper w="100%" maw={420} p="xl" withBorder shadow="sm">
        <Stack gap="md">
          <BrandLogo name={t('app.name')} size={36} />
          <Title order={3}>{title}</Title>
          {children}
          <Anchor component={Link} to="/login" size="sm" ta="center">{t('auth.back_to_login')}</Anchor>
        </Stack>
      </Paper>
    </Center>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm({ initialValues: { email: '' } });

  return (
    <Shell title={t('auth.forgot')}>
      {sent ? <Alert color="green" icon={<IconCircleCheck size={16} />}>{t('auth.link_sent')}</Alert> : (
        <form onSubmit={form.onSubmit(async (v) => { setBusy(true); try { await csrf(); await api.post('/auth/forgot-password', v); setSent(true); } finally { setBusy(false); } })}>
          <Stack gap="sm">
            <TextInput label={t('auth.email')} type="email" required {...form.getInputProps('email')} />
            <Button type="submit" loading={busy}>{t('auth.send_link')}</Button>
          </Stack>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm({ initialValues: { password: '', password_confirmation: '' } });

  const submit = form.onSubmit(async (v) => {
    setBusy(true); setError(null);
    try {
      await csrf();
      await api.post('/auth/reset-password', { ...v, token: params.get('token'), email: params.get('email') });
      setDone(true); setTimeout(() => nav('/login'), 1800);
    } catch (e) { const p = parseError(e); form.setErrors(p.fields); setError(p.fields.email ?? p.message); }
    finally { setBusy(false); }
  });

  return (
    <Shell title={t('auth.reset_title')}>
      {done ? <Alert color="green" icon={<IconCircleCheck size={16} />}>{t('auth.reset_done')}</Alert> : (
        <form onSubmit={submit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput label={t('auth.new_password')} required {...form.getInputProps('password')} />
            <PasswordInput label={t('auth.confirm_password')} required {...form.getInputProps('password_confirmation')} />
            <Text size="xs" c="dimmed">{t('auth.password_hint')}</Text>
            <Button type="submit" loading={busy}>{t('common.save')}</Button>
          </Stack>
        </form>
      )}
    </Shell>
  );
}
