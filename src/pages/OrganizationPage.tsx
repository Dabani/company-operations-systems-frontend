import { Button, FileButton, Grid, Group, Paper, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { BrandLogo } from '@/components/BrandLogo';
import { PageHeader } from '@/components/PageHeader';
import { RichTextField } from '@/components/RichTextField';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Language, Organization } from '@/types';

export function OrganizationPage() {
  const { t } = useTranslation();
  const { can, refresh } = useAuth();
  const qc = useQueryClient();
  const edit = can('organization.update');
  const [logoBust, setLogoBust] = useState(0);
  const tz = useLookup('timezone'); const cur = useLookup('currency'); const df = useLookup('date_format');
  const langs = useQuery({ queryKey: ['languages'], queryFn: async () => (await api.get<{ data: Language[] }>('/languages')).data.data });
  const org = useQuery({ queryKey: ['organization'], queryFn: async () => (await api.get<{ data: Organization }>('/organizations/current')).data.data });

  const form = useForm({ initialValues: { name: '', legal_name: '', email: '', phone: '', website: '', address: '', default_language_id: '', timezone_id: '', currency_id: '', date_format_id: '' } });

  useEffect(() => {
    const o = org.data; if (!o) return;
    form.setValues({ name: o.name, legal_name: o.legal_name ?? '', email: o.email ?? '', phone: o.phone ?? '', website: o.website ?? '', address: o.address ?? '',
      default_language_id: o.default_language_id, timezone_id: o.timezone_id, currency_id: o.currency_id, date_format_id: o.date_format_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.data]);

  const save = useMutation({
    mutationFn: async (v: typeof form.values) => api.patch('/organizations/current', v),
    onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['organization'] }); void refresh(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const logo = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append('logo', f); return api.post('/organizations/current/logo', fd); },
    onSuccess: () => { toastOk(); setLogoBust(Date.now()); void qc.invalidateQueries({ queryKey: ['organization'] }); void refresh(); },
    onError: toastError,
  });

  return (
    <>
      <PageHeader title={t('org.title')} />
      <Paper withBorder p="md">
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="md">
            <Group>
              <BrandLogo key={logoBust} name={org.data?.name ?? ''} hasLogo={org.data?.has_logo} size={64} hideName />
              {edit && <FileButton accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(f) => f && logo.mutate(f)}>
                {(p) => <Button {...p} variant="default" loading={logo.isPending} leftSection={<IconUpload size={16} />}>{t('org.upload_logo')}</Button>}
              </FileButton>}
            </Group>
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}><TextInput label={t('org.name')} required disabled={!edit} {...form.getInputProps('name')} /></Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}><TextInput label={t('org.legal_name')} disabled={!edit} {...form.getInputProps('legal_name')} /></Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}><TextInput label={t('common.email')} type="email" disabled={!edit} {...form.getInputProps('email')} /></Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}><TextInput label={t('common.phone')} disabled={!edit} {...form.getInputProps('phone')} /></Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}><TextInput label={t('org.website')} disabled={!edit} {...form.getInputProps('website')} /></Grid.Col>
              <Grid.Col span={12}><RichTextField label={t('org.address')} value={form.values.address} onChange={(v) => form.setFieldValue('address', v)} minHeight={90} /></Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><Select label={t('org.default_language')} disabled={!edit} data={(langs.data ?? []).map((l) => ({ value: l.id, label: l.native_name }))} {...form.getInputProps('default_language_id')} /></Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><Select label={t('org.timezone')} disabled={!edit} data={tz.options} {...form.getInputProps('timezone_id')} /></Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><Select label={t('org.currency')} disabled={!edit} data={cur.options} {...form.getInputProps('currency_id')} /></Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><Select label={t('org.date_format')} disabled={!edit} data={df.options} {...form.getInputProps('date_format_id')} /></Grid.Col>
            </Grid>
            {edit && <Group justify="flex-end"><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>}
          </Stack>
        </form>
      </Paper>
    </>
  );
}
