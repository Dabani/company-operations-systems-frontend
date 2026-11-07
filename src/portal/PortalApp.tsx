import { AppShell, Button, Center, Group, Loader, Select, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { papi, type PortalStatus } from './portalApi';
import { PortalActivatePage, PortalForgotPage, PortalLoginPage, PortalMfaPage } from './PortalAuthPages';
import { PortalProjectPage, PortalProjectsPage } from './PortalProjects';

const PUBLIC = ['/portal/login', '/portal/forgot', '/portal/activate'];

/** The external client portal: its own shell, session and routes, entirely separate from the staff application. */
export function PortalApp() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const isPublic = PUBLIC.includes(pathname);
  const status = useQuery({ queryKey: ['portal-status'], enabled: !isPublic, retry: false, queryFn: async () => (await papi.get<PortalStatus>('/auth/status')).data });

  useEffect(() => {
    if (isPublic) return;
    if (status.isError) nav('/portal/login', { replace: true });
    else if (status.data && status.data.mfa.required && !status.data.mfa.verified && pathname !== '/portal/mfa') nav('/portal/mfa', { replace: true });
  }, [isPublic, status.isError, status.data, pathname, nav]);

  const signOut = async () => { await papi.post('/auth/logout').catch(() => undefined); qc.clear(); nav('/portal/login', { replace: true }); };
  if (!isPublic && !status.data && !status.isError) return <Center h="100dvh"><Loader /></Center>;

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header><Group h="100%" px="md" justify="space-between">
        <Text fw={700}>{status.data?.client.name ?? t('portal.title')}</Text>
        <Group gap="xs">
          <Select size="xs" w={110} value={i18n.language.slice(0, 2)} onChange={(v) => v && void i18n.changeLanguage(v)} data={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }, { value: 'rw', label: 'Kinyarwanda' }, { value: 'sw', label: 'Kiswahili' }]} allowDeselect={false} aria-label={t('portal.language')} />
          {status.data && <Button size="xs" variant="default" onClick={signOut}>{t('portal.sign_out')}</Button>}
        </Group></Group></AppShell.Header>
      <AppShell.Main maw={980} mx="auto">
        <Routes>
          <Route path="/portal/login" element={<PortalLoginPage />} />
          <Route path="/portal/forgot" element={<PortalForgotPage />} />
          <Route path="/portal/activate" element={<PortalActivatePage />} />
          <Route path="/portal/mfa" element={<PortalMfaPage />} />
          <Route path="/portal/projects/:id" element={<PortalProjectPage />} />
          <Route path="/portal" element={<PortalProjectsPage />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
