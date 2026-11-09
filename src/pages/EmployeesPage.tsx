import { Badge, Button, Group, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconEye, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { DataList, RowIconButton, type Column } from '@/components/DataList';
import { PageHeader } from '@/components/PageHeader';
import { useLookup } from '@/lib/useLookup';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Emp { id: string; employee_number: string; first_name: string; last_name: string; full_name: string; email: string | null; phone: string | null; position_title: string | null;
  category_id: string; category: string; status: string; department_id: string | null; department: string | null; manager_employee_id: string | null; has_login: boolean; hired_on: string | null }
const blank = { employee_number: '', first_name: '', last_name: '', email: '', phone: '', position_title: '', category_id: '', department_id: null as string | null, manager_employee_id: null as string | null, hired_on: '', national_id: '', bank_account: '' };

export function EmployeesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const cats = useLookup('employee_category');
  const [editing, setEditing] = useState<Emp | 'new' | null>(null);
  const [secret, setSecret] = useState<{ national_id: string | null; bank_account: string | null } | null>(null);
  const form = useForm({ initialValues: blank });
  const depts = useQuery({ queryKey: ['dept-options'], queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], queryFn: async () => (await api.get<Paginated<Emp>>('/employees', { params: { per_page: 100 } })).data.data });
  const manage = can('employee.manage');

  const open = (e: Emp | 'new') => { setEditing(e); form.setValues(e === 'new' ? blank : { ...blank, employee_number: e.employee_number, first_name: e.first_name, last_name: e.last_name, email: e.email ?? '', phone: e.phone ?? '', position_title: e.position_title ?? '', category_id: e.category_id, department_id: e.department_id, manager_employee_id: e.manager_employee_id, hired_on: e.hired_on ?? '' }); };
  const save = useMutation({
    mutationFn: async (v: typeof blank) => { const body = Object.fromEntries(Object.entries(v).filter(([k, x]) => !(['national_id', 'bank_account'].includes(k) && x === ''))); return editing === 'new' ? api.post('/employees', body) : api.patch(`/employees/${(editing as Emp).id}`, body); },
    onSuccess: () => { toastOk(); setEditing(null); void qc.invalidateQueries({ queryKey: ['employees'] }); void qc.invalidateQueries({ queryKey: ['emp-options'] }); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  const reveal = useMutation({ mutationFn: async (e: Emp) => (await api.get(`/employees/${e.id}/sensitive`)).data, onSuccess: setSecret, onError: toastError });

  const columns: Column<Emp>[] = [
    { key: 'employee_number', label: t('employees.number'), sortable: true, render: (e) => <Badge variant="outline">{e.employee_number}</Badge> },
    { key: 'last_name', label: t('common.name'), sortable: true, render: (e) => <div><Text size="sm" fw={600}>{e.full_name}</Text><Text size="xs" c="dimmed">{e.position_title ?? ''}</Text></div> },
    { key: 'category', label: t('employees.category'), visibleFrom: 'sm', render: (e) => cats.items.find((c) => c.id === e.category_id)?.label ?? e.category },
    { key: 'department', label: t('employees.department'), visibleFrom: 'md', render: (e) => e.department ?? '—' },
    { key: 'has_login', label: t('employees.has_login'), visibleFrom: 'md', render: (e) => <Badge color={e.has_login ? 'green' : 'gray'} variant="light">{e.has_login ? t('common.yes') : t('common.no')}</Badge> },
  ];

  return (
    <>
      <PageHeader title={t('employees.title')} />
      <DataList<Emp> title={t('employees.title')} endpoint="/employees" queryKey="employees" columns={columns} defaultSort={{ key: 'last_name', direction: 'asc' }}
        filters={[{ key: 'category_id', label: t('employees.category'), options: cats.options }]}
        toolbar={manage ? <Button leftSection={<IconPlus size={16} />} onClick={() => open('new')}>{t('employees.new')}</Button> : undefined}
        rowActions={(e) => <>
          {manage && <RowIconButton label={t('common.edit')} onClick={() => open(e)}><IconEdit size={18} /></RowIconButton>}
          {can('employee.view_sensitive') && <RowIconButton label={t('employees.reveal')} onClick={() => reveal.mutate(e)}><IconEye size={18} /></RowIconButton>}
        </>} />

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('employees.new') : t('employees.edit')} size="lg" centered>
        <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
          <Stack gap="sm">
            <Group grow><Select label={t('employees.category')} required data={cats.options} {...form.getInputProps('category_id')} /></Group>
            <Group grow><TextInput label={t('employees.first_name')} required {...form.getInputProps('first_name')} /><TextInput label={t('employees.last_name')} required {...form.getInputProps('last_name')} /></Group>
            <Group grow><TextInput label={t('common.email')} {...form.getInputProps('email')} /><TextInput label={t('common.phone')} {...form.getInputProps('phone')} /></Group>
            <Group grow><Select label={t('employees.department')} clearable data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} {...form.getInputProps('department_id')} />
              <Select label={t('employees.manager')} clearable searchable data={(emps.data ?? []).filter((x) => editing === 'new' || x.id !== (editing as Emp)?.id).map((x) => ({ value: x.id, label: x.full_name }))} {...form.getInputProps('manager_employee_id')} /></Group>
            <Group grow><TextInput label={t('employees.position')} {...form.getInputProps('position_title')} /><TextInput type="date" label={t('employees.hired_on')} {...form.getInputProps('hired_on')} /></Group>
            {can('employee.manage_sensitive') && <Group grow><TextInput label={t('employees.national_id')} description={t('employees.sensitive_note')} autoComplete="off" {...form.getInputProps('national_id')} /><TextInput label={t('employees.bank_account')} autoComplete="off" {...form.getInputProps('bank_account')} /></Group>}
            <Group justify="flex-end"><Button variant="default" onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <Modal opened={!!secret} onClose={() => setSecret(null)} title={t('employees.sensitive')} centered>
        <Stack gap="xs"><Text size="sm" c="dimmed">{t('employees.audited_note')}</Text>
          <Text size="sm"><b>{t('employees.national_id')}:</b> {secret?.national_id ?? '—'}</Text><Text size="sm"><b>{t('employees.bank_account')}:</b> {secret?.bank_account ?? '—'}</Text></Stack>
      </Modal>
    </>
  );
}
