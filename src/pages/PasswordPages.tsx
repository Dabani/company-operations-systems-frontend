import { Alert, Anchor, Button, Center, Loader, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, csrf, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordChecklist } from '@/components/PasswordChecklist';
import { checkPassword, passwordAcceptable } from '@/lib/passwordRules';

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

/** Activation / reset links are public pages. If someone else is signed in on this browser (typically the administrator
 *  who just sent the invitation) they must sign out first - otherwise the link would silently act on the wrong session. */
function SignedInNotice() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  return (
    <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
      <Stack gap="xs">
        <Text size="sm">{t('auth.signed_in_as', { name: me.name })}</Text>
        <Button size="xs" variant="light" color="orange" loading={busy}
          onClick={async () => { setBusy(true); try { await api.post('/auth/logout'); } finally { window.location.reload(); } }}>{t('auth.signout_continue')}</Button>
      </Stack>
    </Alert>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const email = params.get('email') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm({ initialValues: { password: '', password_confirmation: '' } });
  const checks = checkPassword(form.values.password, form.values.password_confirmation, email);

  const submit = form.onSubmit(async (v) => {
    setBusy(true); setError(null);
    try {
      await csrf();
      await api.post('/auth/reset-password', { ...v, token: params.get('token'), email });
      setDone(true); setTimeout(() => nav('/login'), 1800);
    } catch (e) { const p = parseError(e); form.setErrors(p.fields); setError(p.fields.email ?? p.message); }
    finally { setBusy(false); }
  });

  return (
    <Shell title={t('auth.reset_title')}>
      <SignedInNotice />
      {done ? <Alert color="green" icon={<IconCircleCheck size={16} />}>{t('auth.reset_done')}</Alert> : !me && (
        <form onSubmit={submit}>
          <Stack gap="sm">
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput label={t('auth.new_password')} required autoComplete="new-password" {...form.getInputProps('password')} />
            <PasswordInput label={t('auth.confirm_password')} required autoComplete="new-password" {...form.getInputProps('password_confirmation')} />
            <PasswordChecklist checks={checks} />
            <Button type="submit" loading={busy} disabled={!passwordAcceptable(checks)}>{t('common.save')}</Button>
          </Stack>
        </form>
      )}
    </Shell>
  );
}

type Check = { state: 'checking' } | { state: 'valid'; name: string } | { state: 'bad'; reason: string; message: string };

/** Landing page of the invitation e-mail: the person chooses a password, which activates the account and signs them in. */
export function ActivatePage() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [check, setCheck] = useState<Check>({ state: 'checking' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm({ initialValues: { password: '', password_confirmation: '' } });
  const checks = checkPassword(form.values.password, form.values.password_confirmation, email);

  useEffect(() => {
    if (me) return;
    if (!token || !email) { setCheck({ state: 'bad', reason: 'invalid', message: t('auth.invitation_invalid') }); return; }
    api.get('/auth/activation', { params: { token, email } })
      .then((r) => setCheck({ state: 'valid', name: r.data.name }))
      .catch((e) => { const r = e?.response?.data; setCheck({ state: 'bad', reason: r?.reason ?? 'invalid', message: r?.message ?? t('auth.invitation_invalid') }); });
  }, [token, email, me, t]);

  const submit = form.onSubmit(async (v) => {
    setBusy(true); setError(null);
    try {
      await csrf();
      await api.post('/auth/activate', { ...v, token, email });
      window.location.assign('/dashboard');           // full load: the new session is picked up cleanly
    } catch (e) { const p = parseError(e); form.setErrors(p.fields); setError(p.fields.email ?? (p.fields.password ? null : p.message)); setBusy(false); }
  });

  return (
    <Shell title={t('auth.activate_title')}>
      <SignedInNotice />
      {!me && check.state === 'checking' && <Center py="md"><Loader size="sm" /></Center>}
      {!me && check.state === 'bad' && (
        <Alert color={check.reason === 'used' ? 'blue' : 'red'} icon={<IconAlertTriangle size={16} />}>
          <Text size="sm" fw={600}>{check.message}</Text>
          {check.reason === 'expired' && <Text size="sm" mt={4}>{t('auth.invitation_expired_help')}</Text>}
          {check.reason === 'used' && <Anchor component={Link} to="/login" size="sm">{t('auth.back_to_login')}</Anchor>}
        </Alert>
      )}
      {!me && check.state === 'valid' && (
        <form onSubmit={submit}>
          <Stack gap="sm">
            <Text size="sm">{t('auth.activate_hello', { name: check.name })} {t('auth.activate_intro')}</Text>
            <TextInput label={t('auth.email')} value={email} readOnly variant="filled" />
            {error && <Alert color="red">{error}</Alert>}
            <PasswordInput label={t('auth.new_password')} required autoComplete="new-password" {...form.getInputProps('password')} />
            <PasswordInput label={t('auth.confirm_password')} required autoComplete="new-password" {...form.getInputProps('password_confirmation')} />
            <PasswordChecklist checks={checks} />
            <Button type="submit" loading={busy} disabled={!passwordAcceptable(checks)}>{t('auth.activate_btn')}</Button>
          </Stack>
        </form>
      )}
    </Shell>
  );
}
