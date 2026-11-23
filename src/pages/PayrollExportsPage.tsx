import { ActionIcon, Alert, Badge, Button, Code, Group, Modal, ScrollArea, Select, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { IconEye, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ExportProfileModal } from '@/components/payroll/ExportProfileModal';
import { PageHeader } from '@/components/PageHeader';
import { VERIFY_COLOR } from '@/lib/payroll';
import { toastError, toastOk } from '@/lib/ui';
import type { RunRow } from '@/pages/PayrollRunsPage';

interface Profile { id: string; code: string; name: string; kind: string; layout: string; agreed_with: string; verification: string; is_active: boolean; prepared_by: string | null; verified_by: string | null; columns: { header: string; source: string }[] }
interface Acc { account_key: string; account_code: string; label: string | null }

/** Export layouts (agreed with the bank / RRA / RSSB / the accountant, verified by a second person) and the journal accounts. Nothing is pre-filled. */
export function PayrollExportsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newCode, setNewCode] = useState('');
  const cfg = can('hr.payroll.export.configure');
  const profiles = useQuery({ queryKey: ['pay-profiles'], queryFn: async () => (await api.get<{ data: Profile[] }>('/payroll/export-profiles')).data.data });
  const accounts = useQuery({ queryKey: ['pay-accounts'], queryFn: async () => (await api.get<{ data: Acc[] }>('/payroll/journal-accounts')).data.data });
  const runs = useQuery({ queryKey: ['pay-runs', 'all'], queryFn: async () => (await api.get<{ data: RunRow[] }>('/payroll/runs')).data.data });
  const needed = useQuery({ queryKey: ['pay-accounts-needed', runId], enabled: !!runId, queryFn: async () => (await api.get<{ data: { key: string; account_code: string | null }[] }>(`/payroll/runs/${runId}/journal-accounts`)).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['pay-profiles'] }); };
  const verify = useMutation({ mutationFn: async (id: string) => api.post(`/payroll/export-profiles/${id}/verify`), onSuccess: () => { toastOk(t('pay.verified_ok')); refresh(); }, onError: toastError });
  const active = useMutation({ mutationFn: async (p: Profile) => api.patch(`/payroll/export-profiles/${p.id}/active`, { is_active: !p.is_active }), onSuccess: refresh, onError: toastError });
  const del = useMutation({ mutationFn: async (id: string) => api.delete(`/payroll/export-profiles/${id}`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const show = useMutation({ mutationFn: async (p: Profile) => ({ name: p.name, text: (await api.get<{ data: { text: string } }>(`/payroll/export-profiles/${p.id}/preview`)).data.data.text }), onSuccess: setPreview, onError: toastError });
  const save = useMutation({
    mutationFn: async (rows: { account_key: string; account_code: string }[]) => api.put('/payroll/journal-accounts', { accounts: rows }),
    onSuccess: () => { toastOk(); setDraft({}); setNewKey(''); setNewCode(''); void qc.invalidateQueries({ queryKey: ['pay-accounts'] }); void qc.invalidateQueries({ queryKey: ['pay-accounts-needed'] }); }, onError: toastError,
  });
  const mapped = new Map((accounts.data ?? []).map((a) => [a.account_key, a.account_code]));
  const rowsToSave = [...Object.entries(draft).filter(([, v]) => v.trim() !== '').map(([k, v]) => ({ account_key: k, account_code: v.trim() })), ...(newKey && newCode ? [{ account_key: newKey.trim(), account_code: newCode.trim() }] : [])];
  return (
    <>
      <PageHeader title={t('pay.exports_title')} description={t('pay.exports_intro')} actions={<Button variant="default" component={Link} to="/payroll/runs">{t('pay.runs_title')}</Button>} />
      <Tabs defaultValue="layouts">
        <Tabs.List mb="md"><Tabs.Tab value="layouts">{t('pay.tab_layouts')}</Tabs.Tab><Tabs.Tab value="accounts">{t('pay.tab_accounts')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="layouts">
          <Group justify="space-between" mb="sm" align="flex-start"><Text size="sm" c="dimmed" maw={700}>{t('pay.layouts_hint')}</Text>
            {cfg && <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModal(true)}>{t('common.add')}</Button>}</Group>
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th>{t('common.type')}</Table.Th><Table.Th>{t('pay.agreed_with')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(profiles.data ?? []).map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text fw={500}>{p.name}</Text><Text size="xs" c="dimmed"><code>{p.code}</code> · {p.columns.length} {t('pay.columns').toLowerCase()}</Text></Table.Td>
                  <Table.Td>{t(`pay.exportkind.${p.kind}`)} · {t(`pay.layouttype.${p.layout}`)}</Table.Td>
                  <Table.Td><Text size="xs" lineClamp={2}>{p.agreed_with}</Text><Text size="xs" c="dimmed">{p.prepared_by}{p.verified_by ? ` → ${p.verified_by}` : ''}</Text></Table.Td>
                  <Table.Td><Badge variant={p.verification === 'verified' ? 'light' : 'filled'} color={VERIFY_COLOR[p.verification]}>{t(`pay.verification.${p.verification}`)}</Badge>{!p.is_active && <Badge ml={4} color="gray">{t('common.inactive')}</Badge>}</Table.Td>
                  <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                    <ActionIcon variant="subtle" aria-label={t('pay.preview')} onClick={() => show.mutate(p)}><IconEye size={16} /></ActionIcon>
                    {p.verification !== 'verified' && can('hr.payroll.verify') && <Button size="compact-xs" color="green" variant="light" onClick={() => verify.mutate(p.id)}>{t('pay.verify')}</Button>}
                    {p.verification === 'verified' && cfg && <Button size="compact-xs" variant="subtle" onClick={() => active.mutate(p)}>{p.is_active ? t('pay.switch_off') : t('pay.switch_on')}</Button>}
                    {p.verification !== 'verified' && cfg && <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => del.mutate(p.id)}><IconTrash size={14} /></ActionIcon>}
                  </Group></Table.Td>
                </Table.Tr>))}
              {profiles.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('pay.none_yet')}</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Tabs.Panel>

        <Tabs.Panel value="accounts">
          <Alert variant="light" color="blue" mb="sm">{t('pay.accounts_hint')}</Alert>
          <Select mb="sm" w={360} clearable searchable label={t('pay.accounts_for_run')} value={runId} onChange={setRunId} data={(runs.data ?? []).map((r) => ({ value: r.id, label: `${r.code} · ${r.period_from} → ${r.period_to}` }))} />
          <Table verticalSpacing="xs"><Table.Thead><Table.Tr><Table.Th>{t('pay.account_key')}</Table.Th><Table.Th>{t('pay.account_code')}</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {(runId ? (needed.data ?? []).map((n) => n.key) : [...mapped.keys()]).map((k) => (
                <Table.Tr key={k}><Table.Td><code>{k}</code></Table.Td>
                  <Table.Td><TextInput w={180} size="xs" disabled={!cfg} placeholder={mapped.get(k) ? undefined : t('pay.unmapped')} value={draft[k] ?? mapped.get(k) ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.currentTarget.value })} error={runId && !mapped.get(k) && !draft[k] ? t('pay.unmapped') : undefined} /></Table.Td></Table.Tr>))}
              {cfg && <Table.Tr><Table.Td><TextInput size="xs" placeholder="component.basic / net_pay / scheme.pen.employee_liability" value={newKey} onChange={(e) => setNewKey(e.currentTarget.value)} /></Table.Td><Table.Td><TextInput w={180} size="xs" value={newCode} onChange={(e) => setNewCode(e.currentTarget.value)} /></Table.Td></Table.Tr>}
            </Table.Tbody></Table>
          {cfg && <Group mt="sm"><Button loading={save.isPending} disabled={rowsToSave.length === 0} onClick={() => save.mutate(rowsToSave)}>{t('common.save')}</Button></Group>}
        </Tabs.Panel>
      </Tabs>
      {cfg && <ExportProfileModal opened={modal} onClose={() => setModal(false)} />}
      <Modal opened={!!preview} onClose={() => setPreview(null)} title={`${t('pay.preview')} — ${preview?.name ?? ''}`} size="xl" centered>
        <Alert color="orange" variant="light" mb="sm">{t('pay.preview_note')}</Alert>
        <ScrollArea><Code block>{preview?.text}</Code></ScrollArea>
      </Modal>
    </>
  );
}
