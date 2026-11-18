import { ActionIcon, Alert, Button, Card, Collapse, Group, Menu, Modal, NumberInput, Progress, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconDots, IconDownload, IconPaperclip, IconPlus, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, downloadBlob, downloadFile, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { FileTypeIcon } from '@/components/FileTypeIcon';
import { StatusBadge } from '@/components/StatusBadge';
import { UploadModal } from '@/components/UploadModal';
import { EXPENSE_COLOR, budgetUsage, fmtMoney } from '@/lib/events';
import { formatBytes } from '@/lib/format';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { FileRow } from '@/types';

interface Expense {
  id: string; category: string; category_id: string; description: string; vendor: string | null; expense_date: string; amount: number | string; status: string; over_budget: boolean; decision_note: string | null;
  receipts: number; approval_request_id: string | null; created_by: string | null; me: { can_edit: boolean; can_submit: boolean; can_attach: boolean };
}
interface Summary { currency: string | null; budget: number | null; approved: number; pending: number; remaining: number | null; over_budget: boolean; over_budget_items: number; by_category: Record<string, number> | { category: string; amount: number }[] }

const blank = { category_id: null as string | null, description: '', vendor: '', expense_date: '', amount: '' as number | string };

export function EventExpensesTab({ eventId, currency, canAdd }: { eventId: string; currency: string | null; canAdd: boolean }) {
  const { t, i18n } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const key = ['event-expenses', eventId];
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [removing, setRemoving] = useState<Expense | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: Expense[]; meta: { summary: Summary; currency: string | null } }>(`/events/${eventId}/expenses`)).data });
  const cur = q.data?.meta.currency ?? currency;
  const sum = q.data?.meta.summary;
  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); };
  const submit = useMutation({ mutationFn: async (id: string) => (await api.post(`/event-expenses/${id}/submit`, {})).data, onSuccess: () => { toastOk(t('ev.exp_submitted')); refresh(); }, onError: toastError });
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/event-expenses/${id}`)).data, onSuccess: () => { setRemoving(null); toastOk(); refresh(); }, onError: toastError });
  const exportIt = (f: 'csv' | 'xlsx') => { downloadBlob(`/events/${eventId}/expenses/export?format=${f}`, `expenses.${f}`).catch(toastError); };
  const used = sum ? budgetUsage(Number(sum.approved) + Number(sum.pending), sum.budget) : null;

  return (
    <Stack gap="md">
      {sum && (
        <Card withBorder padding="sm">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <div><Text size="xs" c="dimmed">{t('ev.budget')}</Text><Title order={4}>{sum.budget === null ? '—' : fmtMoney(sum.budget, cur, i18n.language)}</Title></div>
            <div><Text size="xs" c="dimmed">{t('ev.exp_approved')}</Text><Title order={4}>{fmtMoney(sum.approved, cur, i18n.language)}</Title></div>
            <div><Text size="xs" c="dimmed">{t('ev.exp_pending')}</Text><Title order={4}>{fmtMoney(sum.pending, cur, i18n.language)}</Title></div>
            <div><Text size="xs" c="dimmed">{t('ev.exp_remaining')}</Text><Title order={4} c={sum.over_budget ? 'red' : undefined}>{sum.remaining === null ? '—' : fmtMoney(sum.remaining, cur, i18n.language)}</Title></div>
          </SimpleGrid>
          {used !== null && <Progress mt="sm" value={Math.min(used, 100)} color={used > 100 ? 'red' : used > 80 ? 'orange' : 'green'} />}
          {sum.over_budget && <Alert mt="sm" color="red" variant="light">{t('ev.exp_over_budget')}</Alert>}
        </Card>
      )}
      <Group justify="space-between">
        <Title order={5}>{t('ev.expenses')}</Title>
        <Group gap="xs">
          {can('data.export') && <Menu><Menu.Target><Button variant="default" leftSection={<IconDownload size={16} />}>{t('common.export')}</Button></Menu.Target>
            <Menu.Dropdown><Menu.Item onClick={() => exportIt('xlsx')}>XLSX</Menu.Item><Menu.Item onClick={() => exportIt('csv')}>CSV</Menu.Item></Menu.Dropdown></Menu>}
          {canAdd && <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>{t('ev.exp_new')}</Button>}
        </Group>
      </Group>
      <Table.ScrollContainer minWidth={600}>
        <Table verticalSpacing="xs">
          <Table.Thead><Table.Tr><Table.Th>{t('ev.exp_date')}</Table.Th><Table.Th>{t('ev.exp_description')}</Table.Th><Table.Th ta="right">{t('ev.exp_amount')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(q.data?.data ?? []).length === 0 && <Table.Tr><Table.Td colSpan={5}><Text size="sm" c="dimmed">{t('ev.exp_none')}</Text></Table.Td></Table.Tr>}
            {(q.data?.data ?? []).map((x) => (
              <Table.Tr key={x.id}>
                <Table.Td><Text size="sm">{x.expense_date}</Text></Table.Td>
                <Table.Td><Text size="sm" fw={500}>{x.description}</Text><Text size="xs" c="dimmed">{[t(`ev.cat.${x.category}`, { defaultValue: x.category }), x.vendor].filter(Boolean).join(' · ')}</Text>
                  {x.decision_note && <Text size="xs" c="dimmed">{x.decision_note}</Text>}
                  <Collapse expanded={open === x.id}>{open === x.id && <Receipts id={x.id} canUpload={x.me.can_attach} onChanged={refresh} />}</Collapse></Table.Td>
                <Table.Td ta="right"><Text size="sm" fw={600} c={x.over_budget ? 'red' : undefined}>{fmtMoney(x.amount, cur, i18n.language)}</Text>{x.over_budget && <Text size="xs" c="red">{t('ev.exp_over_flag')}</Text>}</Table.Td>
                <Table.Td><Group gap={6} wrap="nowrap"><StatusBadge label={t(`ev.exp.${x.status}`)} color={EXPENSE_COLOR[x.status]} />
                  {x.approval_request_id && <Text size="xs" component={Link} to="/approvals">{t('ev.exp_view_approval')}</Text>}</Group></Table.Td>
                <Table.Td>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon variant="subtle" aria-label={t('ev.exp_receipts')} title={t('ev.exp_receipts')} onClick={() => setOpen(open === x.id ? null : x.id)}><IconPaperclip size={16} /></ActionIcon>
                    {(x.me.can_edit || x.me.can_submit) && (
                      <Menu position="bottom-end"><Menu.Target><ActionIcon variant="subtle" aria-label={t('common.actions')}><IconDots size={16} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          {x.me.can_submit && <Menu.Item onClick={() => submit.mutate(x.id)}>{t('ev.exp_submit')}</Menu.Item>}
                          {x.me.can_edit && <Menu.Item onClick={() => setEditing(x)}>{t('common.edit')}</Menu.Item>}
                          {x.me.can_edit && <Menu.Item color="red" onClick={() => setRemoving(x)}>{t('common.delete')}</Menu.Item>}
                        </Menu.Dropdown></Menu>)}
                  </Group>
                </Table.Td>
              </Table.Tr>))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <ExpenseModal eventId={eventId} expense={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <ConfirmModal opened={!!removing} onClose={() => setRemoving(null)} loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} />
    </Stack>
  );
}

function ExpenseModal({ eventId, expense, onClose, onSaved }: { eventId: string; expense: Expense | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const opened = expense !== null;
  const cats = useLookup('event_expense_category', opened);
  const form = useForm({ initialValues: blank });
  const [loaded, setLoaded] = useState<string | null>(null);
  const sig = expense === null ? null : expense === 'new' ? 'new' : expense.id;
  if (sig !== loaded) {
    setLoaded(sig);
    if (expense && expense !== 'new') form.setValues({ category_id: expense.category_id, description: expense.description, vendor: expense.vendor ?? '', expense_date: expense.expense_date, amount: Number(expense.amount) });
    else form.setValues({ ...blank, expense_date: new Date().toISOString().slice(0, 10) });
    form.clearErrors();
  }
  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const body = { category_id: v.category_id, description: v.description, vendor: v.vendor || null, expense_date: v.expense_date, amount: Number(v.amount) };
      return expense && expense !== 'new' ? (await api.patch(`/event-expenses/${expense.id}`, body)).data : (await api.post(`/events/${eventId}/expenses`, body)).data;
    },
    onSuccess: () => { toastOk(); onSaved(); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });
  return (
    <Modal opened={opened} onClose={onClose} centered title={expense === 'new' ? t('ev.exp_new') : t('common.edit')}>
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack gap="sm">
          <Select label={t('ev.exp_category')} required data={cats.options} {...form.getInputProps('category_id')} />
          <Textarea label={t('ev.exp_description')} required autosize minRows={2} maxLength={500} {...form.getInputProps('description')} />
          <TextInput label={t('ev.exp_vendor')} maxLength={190} {...form.getInputProps('vendor')} />
          <TextInput type="date" label={t('ev.exp_date')} required {...form.getInputProps('expense_date')} />
          <NumberInput label={t('ev.exp_amount')} required min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps('amount')} />
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}

function Receipts({ id, canUpload, onChanged }: { id: string; canUpload: boolean; onChanged: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const key = ['event-expense-files', id];
  const [up, setUp] = useState(false);
  const files = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ data: FileRow[] }>(`/event-expense-files/${id}`)).data.data });
  return (
    <Stack gap={4} mt="xs">
      {(files.data ?? []).length === 0 && <Text size="xs" c="dimmed">{t('ev.exp_no_receipts')}</Text>}
      {(files.data ?? []).map((f) => (
        <Group key={f.id} gap="xs" wrap="nowrap"><FileTypeIcon ext={f.extension} size={22} /><Text size="xs" style={{ flex: 1 }}>{f.name} ({formatBytes(f.size_bytes)})</Text>
          <ActionIcon variant="subtle" aria-label={t('meet.download')} onClick={() => { downloadFile(f.id, f.name).catch(toastError); }}><IconDownload size={14} /></ActionIcon></Group>))}
      {canUpload && <Button size="compact-xs" variant="light" leftSection={<IconUpload size={12} />} onClick={() => setUp(true)} style={{ alignSelf: 'flex-start' }}>{t('ev.exp_add_receipt')}</Button>}
      <UploadModal opened={up} onClose={() => setUp(false)} onDone={() => { void qc.invalidateQueries({ queryKey: key }); onChanged(); }} endpoint={`/event-expense-files/${id}`} allowRestricted={false} />
    </Stack>
  );
}
