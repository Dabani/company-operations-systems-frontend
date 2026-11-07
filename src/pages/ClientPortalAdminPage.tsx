import { Badge, Button, Card, Group, Stack, Switch, Table, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';

interface Contact { id: string; name: string; email: string | null; identity: { id: string; status: 'invited' | 'active' | 'inactive'; mfa: boolean; last_login_at: string | null } | null }
interface ClientRow { id: string; code: string; name: string; portal_enabled: boolean; portal_invoices: boolean; portal_uploads: boolean; contacts: Contact[] }
const COLOR = { invited: 'orange', active: 'green', inactive: 'gray' } as const;

export function ClientPortalAdminPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['portal-admin'], queryFn: async () => (await api.get<{ data: ClientRow[] }>('/portal-admin/clients')).data.data });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['portal-admin'] });
  const run = useMutation({ mutationFn: async (v: { method: 'post' | 'put'; path: string; body?: unknown }) => api.request({ method: v.method, url: v.path, data: v.body }),
    onSuccess: (r) => { toastOk((r.data as { sent?: boolean } | undefined)?.sent === false ? t('cportal.mail_failed') : undefined); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('cportal.title')} description={t('cportal.intro')} />
      <Stack>
        {q.data?.map((c) => (
          <Card key={c.id} withBorder>
            <Group justify="space-between" mb="xs" wrap="wrap"><Text fw={600}>{c.name} <Badge variant="outline" size="sm">{c.code}</Badge></Text>
              <Group gap="md">
                <Switch label={t('cportal.enabled')} checked={c.portal_enabled} onChange={(e) => run.mutate({ method: 'put', path: `/clients/${c.id}/portal`, body: { portal_enabled: e.currentTarget.checked } })} />
                <Switch label={t('cportal.invoices')} checked={c.portal_invoices} disabled={!c.portal_enabled} onChange={(e) => run.mutate({ method: 'put', path: `/clients/${c.id}/portal`, body: { portal_invoices: e.currentTarget.checked } })} />
                <Switch label={t('cportal.uploads')} checked={c.portal_uploads} disabled={!c.portal_enabled} onChange={(e) => run.mutate({ method: 'put', path: `/clients/${c.id}/portal`, body: { portal_uploads: e.currentTarget.checked } })} />
              </Group></Group>
            <Table.ScrollContainer minWidth={520}><Table verticalSpacing="xs"><Table.Tbody>
              {c.contacts.map((ct) => (
                <Table.Tr key={ct.id}>
                  <Table.Td><Text size="sm">{ct.name}</Text><Text size="xs" c="dimmed">{ct.email ?? t('cportal.no_email')}</Text></Table.Td>
                  <Table.Td>{ct.identity ? <Group gap={4}><Badge color={COLOR[ct.identity.status]} variant="light">{t(`cportal.s.${ct.identity.status}`)}</Badge>{ct.identity.mfa && <Badge variant="outline" size="sm">2FA</Badge>}</Group> : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                  <Table.Td><Group gap={4} justify="flex-end" wrap="nowrap">
                    {ct.email && c.portal_enabled && ct.identity?.status !== 'active' && ct.identity?.status !== 'inactive' && <Button size="compact-xs" onClick={() => run.mutate({ method: 'post', path: `/clients/${c.id}/contacts/${ct.id}/invite` })}>{ct.identity ? t('cportal.resend') : t('cportal.invite')}</Button>}
                    {ct.identity?.status === 'active' && ct.identity.mfa && <Button size="compact-xs" variant="subtle" onClick={() => run.mutate({ method: 'post', path: `/client-identities/${ct.identity!.id}/reset-mfa` })}>{t('cportal.reset_mfa')}</Button>}
                    {ct.identity && ct.identity.status !== 'invited' && <Button size="compact-xs" variant="subtle" color={ct.identity.status === 'active' ? 'red' : 'green'} onClick={() => run.mutate({ method: 'put', path: `/client-identities/${ct.identity!.id}/active`, body: { active: ct.identity!.status !== 'active' } })}>{ct.identity.status === 'active' ? t('cportal.deactivate') : t('cportal.reactivate')}</Button>}
                  </Group></Table.Td>
                </Table.Tr>))}
            </Table.Tbody></Table></Table.ScrollContainer>
            {c.contacts.length === 0 && <Text size="sm" c="dimmed">{t('cportal.no_contacts')}</Text>}
          </Card>))}
      </Stack>
    </>
  );
}
