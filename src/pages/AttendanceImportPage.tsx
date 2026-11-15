import { Alert, Badge, Button, Card, FileButton, Group, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconCircleCheck, IconCopy, IconEdit, IconFileSpreadsheet, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RowIconButton } from '@/components/DataList';
import { ImportProfileEditor, type Profile } from '@/components/ImportProfileEditor';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Inspect { type: string; sheets: string[]; sheet: string | null; header_row: number; row_count: number; columns: { index: number; letter: string; label: string }[]; sample: string[][] }
interface Result {
  dry_run: boolean; import_id: string | null; file_type: string; sheet: string | null; profile: string | null; columns: Record<string, string>; rows_total: number; rows_imported: number; rows_skipped: number; rows_rejected: number;
  errors: string | null; unknown_ids: string[]; sample: { line: number; employee: string; employee_number: string; ref: string; at: string; direction: string; new: boolean }[];
}
interface Employee { id: string; full_name: string }

export function AttendanceImportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<Inspect | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});

  const profiles = useQuery({ queryKey: ['att-profiles'], queryFn: async () => (await api.get<{ data: Profile[] }>('/attendance/import-profiles')).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<Employee>>('/employees', { params: { per_page: 100 } })).data.data });
  const chosen = profiles.data?.find((p) => p.id === profileId) ?? null;

  const form = (f: File, extra: Record<string, string | null | undefined> = {}) => { const fd = new FormData(); fd.append('file', f); for (const [k, v] of Object.entries(extra)) if (v) fd.append(k, v); return fd; };
  const inspect = useMutation({ mutationFn: async (p: { f: File; sheet?: string | null }) => (await api.post<{ data: Inspect }>('/attendance/import/inspect', form(p.f, { sheet: p.sheet }))).data.data,
    onSuccess: (d) => { setInfo(d); setSheet(d.sheet); }, onError: (e) => { setInfo(null); toastError(e); } });
  const run = useMutation({ mutationFn: async (commit: boolean) => (await api.post<{ data: Result }>(commit ? '/attendance/import' : '/attendance/import/preview', form(file!, { profile_id: profileId, sheet }))).data.data,
    onSuccess: (d, commit) => { if (commit) { setDone(d); setPreview(null); toastOk(t('att.imported_ok', { count: d.rows_imported })); void qc.invalidateQueries({ queryKey: ['att-imports'] }); } else { setPreview(d); setDone(null); } }, onError: toastError });
  const saveCodes = useMutation({
    mutationFn: async () => api.post('/attendance/device-codes', { codes: Object.entries(mapping).filter(([, e]) => e).map(([code, employee_id]) => ({ code, employee_id })) }),
    onSuccess: () => { toastOk(t('att.codes_saved')); setMapping({}); void qc.invalidateQueries({ queryKey: ['att-codes'] }); run.mutate(false); }, onError: toastError });

  const pick = (f: File | null) => { setFile(f); setPreview(null); setDone(null); setMapping({}); if (f) inspect.mutate({ f }); else setInfo(null); };
  const cols = info?.columns.map((c) => c.label) ?? [];

  return (
    <>
      <PageHeader title={t('att.import_title')} description={t('att.import_intro')} />
      <Tabs defaultValue="import" keepMounted={false}>
        <Tabs.List mb="md"><Tabs.Tab value="import">{t('att.tab_import')}</Tabs.Tab><Tabs.Tab value="profiles">{t('att.tab_profiles')}</Tabs.Tab><Tabs.Tab value="codes">{t('att.tab_codes')}</Tabs.Tab><Tabs.Tab value="history">{t('att.tab_history')}</Tabs.Tab></Tabs.List>

        <Tabs.Panel value="import"><Stack gap="lg">
          <Card withBorder padding="md"><Stack gap="sm">
            <Title order={5}>{t('att.step1')}</Title>
            <Group>
              <FileButton onChange={pick} accept=".xlsx,.xlsm,.xls,.ods,.csv,.txt,.tsv,.html,.htm">{(props) => <Button {...props} leftSection={<IconUpload size={16} />} loading={inspect.isPending}>{t('att.choose_file')}</Button>}</FileButton>
              <Text size="sm" c="dimmed">{t('att.file_types')}</Text>
            </Group>
            {file && <Group gap="xs"><IconFileSpreadsheet size={18} /><Text size="sm" fw={600}>{file.name}</Text>{info && <Badge variant="light">{info.type.toUpperCase()}</Badge>}{info && <Text size="xs" c="dimmed">{t('att.rows_in_file', { count: info.row_count })}</Text>}</Group>}
            {info && info.sheets.length > 1 && <Select label={t('att.sheet')} w={260} allowDeselect={false} data={info.sheets} value={sheet} onChange={(v) => { setSheet(v); setPreview(null); if (file) inspect.mutate({ f: file, sheet: v }); }} />}
            {info && (
              <>
                <Text size="sm">{t('att.columns_found')}: {info.columns.map((c) => <Badge key={c.index} mr={4} variant="outline">{c.letter}: {c.label}</Badge>)}</Text>
                <Table verticalSpacing={2} fz="xs"><Table.Tbody>{info.sample.slice(0, 3).map((r, i) => <Table.Tr key={i}>{r.map((c, j) => <Table.Td key={j}>{c}</Table.Td>)}</Table.Tr>)}</Table.Tbody></Table>
              </>
            )}
          </Stack></Card>

          {info && (
            <Card withBorder padding="md"><Stack gap="sm">
              <Title order={5}>{t('att.step2')}</Title>
              <Group align="flex-end">
                <Select label={t('att.profile')} placeholder={t('att.profile_auto')} clearable w={360} data={(profiles.data ?? []).map((p) => ({ value: p.id, label: p.name }))} value={profileId} onChange={(v) => { setProfileId(v); setPreview(null); }} />
                <Button variant="default" leftSection={<IconEdit size={16} />} disabled={!chosen} onClick={() => setEditing(chosen)}>{t('att.view_profile')}</Button>
                <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>{t('att.new_profile')}</Button>
              </Group>
              <Text size="sm" c="dimmed">{chosen?.description ?? t('att.profile_auto_hint')}</Text>
            </Stack></Card>
          )}

          {info && (
            <Card withBorder padding="md"><Stack gap="sm">
              <Title order={5}>{t('att.step3')}</Title>
              <Group><Button loading={run.isPending && !run.variables} onClick={() => run.mutate(false)}>{t('att.preview')}</Button><Text size="xs" c="dimmed">{t('att.preview_hint')}</Text></Group>
              {preview && (
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 2, sm: 4 }}>
                    {([['rows_total', 'gray'], ['rows_imported', 'green'], ['rows_skipped', 'blue'], ['rows_rejected', 'red']] as const).map(([k, c]) => <Card key={k} withBorder padding="xs"><Text size="xs" c="dimmed">{t(`att.${k}`)}</Text><Text fw={700} size="lg" c={c}>{preview[k]}</Text></Card>)}
                  </SimpleGrid>
                  <Text size="xs" c="dimmed">{t('att.recognised')}: {Object.entries(preview.columns).filter(([, v]) => v).map(([k, v]) => `${t(`att.recog.${k}`)} = ${v}`).join(' · ')}</Text>
                  {preview.sample.length > 0 && (
                    <Table verticalSpacing={2} fz="xs"><Table.Thead><Table.Tr><Table.Th>{t('att.line')}</Table.Th><Table.Th>{t('hr.employee')}</Table.Th><Table.Th>{t('att.when')}</Table.Th><Table.Th>{t('att.direction')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                      <Table.Tbody>{preview.sample.map((s, i) => <Table.Tr key={i}><Table.Td>{s.line}</Table.Td><Table.Td>{s.employee} <Text span c="dimmed" size="xs">({s.ref})</Text></Table.Td><Table.Td>{s.at}</Table.Td><Table.Td>{t(`att.dir.${s.direction}`)}</Table.Td><Table.Td>{!s.new && <Badge size="xs" color="blue" variant="light">{t('att.already_there')}</Badge>}</Table.Td></Table.Tr>)}</Table.Tbody></Table>
                  )}
                  {preview.unknown_ids.length > 0 && (
                    <Alert color="orange" variant="light" title={t('att.unknown_codes')}>
                      <Text size="sm" mb="xs">{t('att.unknown_codes_hint')}</Text>
                      <Stack gap="xs">{preview.unknown_ids.map((c) => <Group key={c} gap="xs"><Badge variant="outline" w={90}>{c}</Badge><Select size="xs" searchable clearable placeholder={t('att.choose_employee')} w={260} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} value={mapping[c] ?? null} onChange={(v) => setMapping({ ...mapping, [c]: v })} /></Group>)}</Stack>
                      <Group mt="sm"><Button size="xs" disabled={!Object.values(mapping).some(Boolean)} loading={saveCodes.isPending} onClick={() => saveCodes.mutate()}>{t('att.save_mappings')}</Button></Group>
                    </Alert>
                  )}
                  {preview.errors && <Alert color="red" variant="light" title={t('att.rejected_lines')}><Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>{preview.errors}</Text></Alert>}
                </Stack>
              )}
            </Stack></Card>
          )}

          {preview && (
            <Card withBorder padding="md"><Stack gap="sm">
              <Title order={5}>{t('att.step4')}</Title>
              <Group><Button color="green" disabled={preview.rows_imported === 0} loading={run.isPending && run.variables === true} onClick={() => run.mutate(true)}>{t('att.import_now', { count: preview.rows_imported })}</Button>{preview.rows_imported === 0 && <Text size="sm" c="dimmed">{t('att.nothing_new')}</Text>}</Group>
            </Stack></Card>
          )}
          {done && <Alert color="green" variant="light" icon={<IconCircleCheck />} title={t('att.import_done')}>{t('att.import_summary', { imported: done.rows_imported, skipped: done.rows_skipped, rejected: done.rows_rejected })}</Alert>}
        </Stack></Tabs.Panel>

        <Tabs.Panel value="profiles"><ProfilesTab onEdit={setEditing} /></Tabs.Panel>
        <Tabs.Panel value="codes"><CodesTab /></Tabs.Panel>
        <Tabs.Panel value="history"><HistoryTab /></Tabs.Panel>
      </Tabs>
      <ImportProfileEditor profile={editing} columns={cols} onClose={() => setEditing(null)} onSaved={(id) => { setProfileId(id); setPreview(null); }} />
    </>
  );
}

function ProfilesTab({ onEdit }: { onEdit: (p: Profile | 'new') => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [del, setDel] = useState<Profile | null>(null);
  const q = useQuery({ queryKey: ['att-profiles'], queryFn: async () => (await api.get<{ data: Profile[] }>('/attendance/import-profiles')).data.data });
  const copy = useMutation({ mutationFn: async (id: string) => api.post(`/attendance/import-profiles/${id}/duplicate`), onSuccess: () => { toastOk(t('att.profile_copied')); void qc.invalidateQueries({ queryKey: ['att-profiles'] }); }, onError: toastError });
  const remove = useMutation({ mutationFn: async () => api.delete(`/attendance/import-profiles/${del!.id}`), onSuccess: () => { toastOk(); setDel(null); void qc.invalidateQueries({ queryKey: ['att-profiles'] }); }, onError: toastError });
  return (
    <Stack gap="sm">
      <Group justify="space-between"><Text size="sm" c="dimmed">{t('att.profiles_intro')}</Text><Button leftSection={<IconPlus size={16} />} onClick={() => onEdit('new')}>{t('att.new_profile')}</Button></Group>
      <Table highlightOnHover verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('att.layout')}</Table.Th><Table.Th visibleFrom="sm">{t('att.identify_by')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(q.data ?? []).map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td><Group gap="xs"><Text size="sm" fw={600}>{p.name}</Text>{p.is_system && <Badge size="xs" variant="light">{t('att.shipped')}</Badge>}</Group><Text size="xs" c="dimmed" lineClamp={2}>{p.description}</Text></Table.Td>
              <Table.Td visibleFrom="sm">{t(`att.layout_${p.layout}`)}</Table.Td><Table.Td visibleFrom="sm">{t(`att.identify_${p.identify_by === 'either' ? 'either' : p.identify_by === 'device_code' ? 'code' : 'number'}`)}</Table.Td>
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                <RowIconButton label={t('att.duplicate')} onClick={() => copy.mutate(p.id)}><IconCopy size={18} /></RowIconButton>
                <RowIconButton label={p.is_system ? t('att.view_profile') : t('common.edit')} onClick={() => onEdit(p)}><IconEdit size={18} /></RowIconButton>
                {!p.is_system && <RowIconButton label={t('common.delete')} color="red" onClick={() => setDel(p)}><IconTrash size={18} /></RowIconButton>}
              </Group></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <ConfirmModal opened={!!del} onClose={() => setDel(null)} onConfirm={() => remove.mutate()} loading={remove.isPending} text={t('att.profile_delete_confirm', { name: del?.name ?? '' })} />
    </Stack>
  );
}

function CodesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [emp, setEmp] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<Employee>>('/employees', { params: { per_page: 100 } })).data.data });
  const list = useQuery({ queryKey: ['att-codes'], queryFn: async () => (await api.get<{ data: { id: string; employee: string | null; employee_number: string | null; code: string; label: string | null }[] }>('/attendance/device-codes')).data.data });
  const add = useMutation({ mutationFn: async () => api.post('/attendance/device-codes', { codes: [{ employee_id: emp, code, label: label || undefined }] }), onSuccess: () => { toastOk(); setCode(''); setLabel(''); void qc.invalidateQueries({ queryKey: ['att-codes'] }); }, onError: toastError });
  const remove = useMutation({ mutationFn: async (id: string) => api.delete(`/attendance/device-codes/${id}`), onSuccess: () => { toastOk(); void qc.invalidateQueries({ queryKey: ['att-codes'] }); }, onError: toastError });
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">{t('att.codes_intro')}</Text>
      <Group align="flex-end" gap="xs">
        <Select label={t('hr.employee')} searchable w={280} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} value={emp} onChange={setEmp} />
        <TextInput label={t('att.device_code')} value={code} onChange={(e) => setCode(e.currentTarget.value)} w={150} />
        <TextInput label={t('att.label')} placeholder={t('att.device_label_hint')} value={label} onChange={(e) => setLabel(e.currentTarget.value)} w={200} />
        <Button leftSection={<IconPlus size={16} />} disabled={!emp || !code.trim()} loading={add.isPending} onClick={() => add.mutate()}>{t('common.add')}</Button>
      </Group>
      <Table verticalSpacing="xs">
        <Table.Thead><Table.Tr><Table.Th>{t('att.device_code')}</Table.Th><Table.Th>{t('hr.employee')}</Table.Th><Table.Th visibleFrom="sm">{t('att.label')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(list.data ?? []).map((c) => <Table.Tr key={c.id}><Table.Td><Badge variant="outline">{c.code}</Badge></Table.Td><Table.Td>{c.employee} <Text span size="xs" c="dimmed">{c.employee_number}</Text></Table.Td><Table.Td visibleFrom="sm">{c.label}</Table.Td>
            <Table.Td><RowIconButton label={t('common.delete')} color="red" onClick={() => remove.mutate(c.id)}><IconTrash size={18} /></RowIconButton></Table.Td></Table.Tr>)}
          {list.data?.length === 0 && <Table.Tr><Table.Td colSpan={4}><Text size="sm" c="dimmed">{t('att.no_codes')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['att-imports'], queryFn: async () => (await api.get<{ data: { id: string; filename: string; file_type: string | null; rows_total: number; rows_imported: number; rows_skipped: number; rows_rejected: number; created_at: string }[] }>('/attendance/imports')).data.data });
  return (
    <Table verticalSpacing="xs">
      <Table.Thead><Table.Tr><Table.Th>{t('att.when')}</Table.Th><Table.Th>{t('att.file')}</Table.Th><Table.Th>{t('att.rows_imported')}</Table.Th><Table.Th>{t('att.rows_skipped')}</Table.Th><Table.Th>{t('att.rows_rejected')}</Table.Th></Table.Tr></Table.Thead>
      <Table.Tbody>
        {(q.data ?? []).map((i) => <Table.Tr key={i.id}><Table.Td>{i.created_at.slice(0, 16).replace('T', ' ')}</Table.Td><Table.Td>{i.filename} {i.file_type && <Badge size="xs" variant="light">{i.file_type.toUpperCase()}</Badge>}</Table.Td><Table.Td>{i.rows_imported}</Table.Td><Table.Td>{i.rows_skipped}</Table.Td><Table.Td>{i.rows_rejected || '—'}</Table.Td></Table.Tr>)}
        {q.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('att.no_imports')}</Text></Table.Td></Table.Tr>}
      </Table.Tbody>
    </Table>
  );
}
