import { Alert, Anchor, Button, Card, Code, CopyButton, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { parseError } from '@/api/client';
import { ORG_KEY, papi, pcsrf, type PortalStatus } from './portalApi';

const orgDefault = (sp: URLSearchParams) => sp.get('org') ?? localStorage.getItem(ORG_KEY) ?? '';
const next = (mfa: string) => (mfa === 'none' ? '/portal' : '/portal/mfa');

export function PortalLoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ initialValues: { organization: orgDefault(sp), email: '', password: '' } });
  const login = useMutation({
    mutationFn: async (v: typeof form.values) => { await pcsrf(); return (await papi.post<{ mfa: string }>('/auth/login', v)).data; },
    onSuccess: (r) => { localStorage.setItem(ORG_KEY, form.values.organization); void qc.invalidateQueries({ queryKey: ['portal-status'] }); nav(next(r.mfa)); },
    onError: (e) => setError(parseError(e).message),
  });
  return (
    <Card withBorder maw={420} mx="auto" mt="xl" p="lg">
      <Title order={3} mb="md">{t('portal.sign_in')}</Title>
      <form onSubmit={form.onSubmit((v) => { setError(null); login.mutate(v); })}>
        <Stack gap="sm">
          {error && <Alert color="red" variant="light">{error}</Alert>}
          <TextInput label={t('portal.organization')} description={t('portal.organization_note')} required {...form.getInputProps('organization')} />
          <TextInput label={t('common.email')} type="email" autoComplete="username" required {...form.getInputProps('email')} />
          <PasswordInput label={t('portal.password')} autoComplete="current-password" required {...form.getInputProps('password')} />
          <Button type="submit" loading={login.isPending}>{t('portal.sign_in')}</Button>
          <Anchor component={Link} to="/portal/forgot" size="sm">{t('portal.forgot')}</Anchor>
        </Stack>
      </form>
    </Card>
  );
}

export function PortalForgotPage() {
  const { t } = useTranslation();
  const [sp] = useSearchParams();
  const [done, setDone] = useState<string | null>(null);
  const form = useForm({ initialValues: { organization: orgDefault(sp), email: '' } });
  const send = useMutation({ mutationFn: async (v: typeof form.values) => { await pcsrf(); return (await papi.post<{ message: string }>('/auth/forgot', v)).data.message; }, onSuccess: setDone });
  return (
    <Card withBorder maw={420} mx="auto" mt="xl" p="lg">
      <Title order={3} mb="md">{t('portal.forgot')}</Title>
      {done ? <Alert color="green" variant="light">{done}</Alert> : (
        <form onSubmit={form.onSubmit((v) => send.mutate(v))}><Stack gap="sm">
          <TextInput label={t('portal.organization')} required {...form.getInputProps('organization')} />
          <TextInput label={t('common.email')} type="email" required {...form.getInputProps('email')} />
          <Button type="submit" loading={send.isPending}>{t('portal.send_link')}</Button>
        </Stack></form>)}
      <Anchor component={Link} to="/portal/login" size="sm" mt="md" display="block">{t('portal.back_to_sign_in')}</Anchor>
    </Card>
  );
}

/** Opens from the e-mailed invitation or password-reset link. */
export function PortalActivatePage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const token = sp.get('token') ?? '';
  const email = sp.get('email') ?? '';
  const org = sp.get('org') ?? '';
  const [error, setError] = useState<string | null>(null);
  const check = useQuery({ queryKey: ['portal-activation', token], retry: false,
    queryFn: async () => (await papi.get<{ valid: boolean; kind: string }>('/auth/activation', { params: { organization: org, email, token } })).data });
  const form = useForm({ initialValues: { password: '', password_confirmation: '' } });
  const activate = useMutation({
    mutationFn: async (v: typeof form.values) => { await pcsrf(); return (await papi.post<{ mfa: string }>('/auth/activate', { ...v, organization: org, email, token })).data; },
    onSuccess: (r) => { localStorage.setItem(ORG_KEY, org); nav(next(r.mfa), { replace: true }); },
    onError: (e) => { const p = parseError(e); form.setErrors(p.fields); setError(p.fields.email ?? p.message); },
  });
  if (check.isError) return <Alert color="red" variant="light" maw={460} mx="auto" mt="xl">{parseError(check.error).message}<br /><Anchor component={Link} to="/portal/login">{t('portal.back_to_sign_in')}</Anchor></Alert>;
  if (!check.data) return null;
  return (
    <Card withBorder maw={420} mx="auto" mt="xl" p="lg">
      <Title order={3} mb="xs">{check.data.kind === 'reset' ? t('portal.choose_new_password') : t('portal.welcome')}</Title>
      <Text size="sm" c="dimmed" mb="md">{email}</Text>
      <form onSubmit={form.onSubmit((v) => { setError(null); activate.mutate(v); })}><Stack gap="sm">
        {error && <Alert color="red" variant="light">{error}</Alert>}
        <PasswordInput label={t('portal.password')} description={t('portal.password_rules')} autoComplete="new-password" required {...form.getInputProps('password')} />
        <PasswordInput label={t('portal.password_confirm')} autoComplete="new-password" required {...form.getInputProps('password_confirmation')} />
        <Button type="submit" loading={activate.isPending}>{t('portal.set_password')}</Button>
      </Stack></form>
    </Card>
  );
}

/** Two-factor: first-time set-up (secret + recovery codes) or code entry. */
export function PortalMfaPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['portal-status'], queryFn: async () => (await papi.get<PortalStatus>('/auth/status')).data });
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = () => { void qc.invalidateQueries({ queryKey: ['portal-status'] }); nav('/portal', { replace: true }); };

  const begin = useMutation({ mutationFn: async () => (await papi.post<{ secret: string; uri: string }>('/auth/mfa/setup')).data, onSuccess: setSetup, onError: (e) => setError(parseError(e).message) });
  const confirm = useMutation({ mutationFn: async () => (await papi.post<{ recovery_codes: string[] }>('/auth/mfa/confirm', { code })).data.recovery_codes, onSuccess: setCodes, onError: (e) => setError(parseError(e).fields.code ?? parseError(e).message) });
  const verify = useMutation({ mutationFn: async () => papi.post('/auth/mfa/verify', { code }), onSuccess: done, onError: (e) => setError(parseError(e).fields.code ?? parseError(e).message) });
  useEffect(() => { if (status.data && !status.data.mfa.enabled && !setup && !begin.isPending && !begin.isError) begin.mutate(); }, [status.data]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!status.data) return null;
  const s = status.data;

  if (codes) return (
    <Card withBorder maw={460} mx="auto" mt="xl" p="lg"><Stack>
      <Title order={3}>{t('portal.recovery_title')}</Title>
      <Alert color="orange" variant="light">{t('portal.recovery_note')}</Alert>
      <Code block>{codes.join('\n')}</Code>
      <Group><CopyButton value={codes.join('\n')}>{({ copied, copy }) => <Button variant="light" onClick={copy}>{copied ? t('portal.copied') : t('portal.copy')}</Button>}</CopyButton>
        <Button onClick={done}>{t('portal.continue')}</Button></Group>
    </Stack></Card>);

  if (!s.mfa.enabled) return (
    <Card withBorder maw={460} mx="auto" mt="xl" p="lg"><Stack gap="sm">
      <Title order={3}>{t('portal.mfa_setup_title')}</Title>
      <Text size="sm">{t('portal.mfa_setup_help')}</Text>
      {error && <Alert color="red" variant="light">{error}</Alert>}
      {setup && <>
        <Text size="sm" fw={600}>{t('portal.setup_key')}</Text>
        <Code block style={{ letterSpacing: 2 }}>{setup.secret.match(/.{1,4}/g)?.join(' ')}</Code>
        <Anchor href={setup.uri} size="sm">{t('portal.open_in_app')}</Anchor>
        <TextInput label={t('portal.code')} inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.currentTarget.value)} />
        <Button disabled={code.replace(/\s/g, '').length < 6} loading={confirm.isPending} onClick={() => { setError(null); confirm.mutate(); }}>{t('portal.confirm')}</Button></>}
    </Stack></Card>);

  return (
    <Card withBorder maw={420} mx="auto" mt="xl" p="lg"><Stack gap="sm">
      <Title order={3}>{t('portal.mfa_verify_title')}</Title>
      <Text size="sm" c="dimmed">{t('portal.mfa_verify_help')}</Text>
      {error && <Alert color="red" variant="light">{error}</Alert>}
      <TextInput label={t('portal.code')} autoFocus autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && verify.mutate()} />
      <Button loading={verify.isPending} disabled={code.trim().length < 6} onClick={() => { setError(null); verify.mutate(); }}>{t('portal.confirm')}</Button>
    </Stack></Card>);
}
