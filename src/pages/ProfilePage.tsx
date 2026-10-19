import { Badge, Button, FileButton, Grid, Group, Paper, PasswordInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconUpload, IconUser } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { toastError, toastOk } from '@/lib/ui';
import type { Language } from '@/types';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { me, refresh } = useAuth();
  const [bust, setBust] = useState(0);
  const langs = useQuery({ queryKey: ['languages'], queryFn: async () => (await api.get<{ data: Language[] }>('/languages')).data.data });
  const curLang = langs.data?.find((l) => l.code === me?.language)?.id ?? null;

  const form = useForm({ initialValues: { name: me?.name ?? '', phone: me?.phone ?? '', language_id: curLang } });
  const pw = useForm({ initialValues: { current_password: '', password: '', password_confirmation: '' } });

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.patch('/me', v),
    onSuccess: async () => { toastOk(); await refresh(); const code = langs.data?.find((l) => l.id === form.values.language_id)?.code; if (code) void i18n.changeLanguage(code); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const change = useMutation({
    mutationFn: async (v: typeof pw.values) => api.post('/me/password', v),
    onSuccess: () => { toastOk(); pw.reset(); },
    onError: (e) => { pw.setErrors(parseError(e).fields); toastError(e); },
  });
  const avatar = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append('avatar', f); return api.post('/me/avatar', fd); },
    onSuccess: async () => { toastOk(); setBust(Date.now()); await refresh(); },
    onError: toastError,
  });

  if (!me) return null;

  return (
    <>
      <PageHeader title={t('profile.title')} />
      <Tabs defaultValue="account">
        <Tabs.List mb="md">
          <Tabs.Tab value="account" leftSection={<IconUser size={16} />}>{t('profile.account')}</Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconLock size={16} />}>{t('profile.security')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="account">
          <Paper withBorder p="md">
            <Grid gap="xl">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <Stack align="center" gap="sm">
                  <UserAvatar userId={me.id} hasAvatar={me.has_avatar} name={me.name} size={110} bust={bust} />
                  <FileButton accept="image/png,image/jpeg,image/webp" onChange={(f) => f && avatar.mutate(f)}>
                    {(p) => <Button {...p} size="xs" variant="default" loading={avatar.isPending} leftSection={<IconUpload size={14} />}>{t('profile.upload_photo')}</Button>}
                  </FileButton>
                  <Group gap={4} justify="center">{me.roles.map((r) => <Badge key={r.id} variant="light">{r.name}</Badge>)}</Group>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 8 }}>
                <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
                  <Stack gap="sm">
                    <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
                    <TextInput label={t('common.email')} value={me.email} disabled readOnly />
                    <TextInput label={t('common.phone')} {...form.getInputProps('phone')} />
                    <Select label={t('common.language')} data={(langs.data ?? []).map((l) => ({ value: l.id, label: l.native_name }))} {...form.getInputProps('language_id')} />
                    <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
                  </Stack>
                </form>
              </Grid.Col>
            </Grid>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="security">
          <Paper withBorder p="md" maw={520}>
            <form onSubmit={pw.onSubmit((v) => change.mutate(v))}>
              <Stack gap="sm">
                <PasswordInput label={t('profile.current_password')} required autoComplete="current-password" {...pw.getInputProps('current_password')} />
                <PasswordInput label={t('auth.new_password')} required autoComplete="new-password" {...pw.getInputProps('password')} />
                <PasswordInput label={t('auth.confirm_password')} required autoComplete="new-password" {...pw.getInputProps('password_confirmation')} />
                <Text size="xs" c="dimmed">{t('auth.password_hint')}</Text>
                <Group justify="flex-end"><Button type="submit" loading={change.isPending}>{t('profile.change_password')}</Button></Group>
              </Stack>
            </form>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
