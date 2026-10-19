import { Anchor, Box, Button, Checkbox, Group, Paper, PasswordInput, Stack, Text, TextInput, Title, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconShieldCheck, IconArchive, IconServer2 } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = useQuery({
    queryKey: ['public-config'],
    queryFn: async () => (await axios.get<{ data: { app_name: string; has_logo: boolean } }>('/api/v1/public/config')).data.data,
    retry: false,
  });

  const form = useForm({ initialValues: { email: '', password: '', remember: false } });

  const submit = form.onSubmit(async (v) => {
    setBusy(true); setError(null);
    try { await login(v.email, v.password, v.remember); }
    catch (e) { setError(parseError(e).fields.email ?? parseError(e).message); }
    finally { setBusy(false); }
  });

  const name = cfg.data?.app_name ?? t('app.name');

  return (
    <Box mih="100dvh" style={{ display: 'flex', flexWrap: 'wrap' }}>
      <Box visibleFrom="md" p="xl" style={{ flex: '1 1 45%', background: 'linear-gradient(145deg, var(--mantine-color-brand-6), var(--mantine-color-secondary-7))', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Stack gap="xl" maw={460} mx="auto">
          <Title order={1} c="white">{name}</Title>
          <Stack gap="md">
            {[{ i: IconArchive, k: 'menu.admin.audit' }, { i: IconServer2, k: 'menu.admin.roles' }, { i: IconShieldCheck, k: 'menu.admin.access' }].map(({ i: I, k }) => (
              <Group key={k} gap="sm"><I size={22} /><Text c="white">{t(k)}</Text></Group>
            ))}
          </Stack>
        </Stack>
      </Box>

      <Box p="md" style={{ flex: '1 1 400px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Box pos="absolute" top={12} right={12}><LanguageSwitcher /></Box>
        <Paper w="100%" maw={420} p="xl" withBorder shadow="sm">
          <Stack gap="md">
            <BrandLogo name={name} hasLogo={cfg.data?.has_logo} size={40} />
            <div>
              <Title order={3}>{t('auth.welcome')}</Title>
              <Text c="dimmed" size="sm">{t('auth.subtitle')}</Text>
            </div>
            {error && <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>}
            <form onSubmit={submit}>
              <Stack gap="sm">
                <TextInput label={t('auth.email')} type="email" autoComplete="username" required {...form.getInputProps('email')} />
                <PasswordInput label={t('auth.password')} autoComplete="current-password" required {...form.getInputProps('password')} />
                <Group justify="space-between">
                  <Checkbox label={t('auth.remember')} {...form.getInputProps('remember', { type: 'checkbox' })} />
                  <Anchor component={Link} to="/forgot-password" size="sm">{t('auth.forgot')}</Anchor>
                </Group>
                <Button type="submit" loading={busy} fullWidth>{t('auth.sign_in')}</Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
