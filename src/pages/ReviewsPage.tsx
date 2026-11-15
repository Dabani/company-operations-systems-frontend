import { Badge, Button, Group, Modal, MultiSelect, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconPlus, IconUsersPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { REVIEW_COLOR, ReviewModal, type Review } from '@/components/ReviewModal';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Cycle { id: string; name: string; period_start: string; period_end: string; status: string }

export function ReviewsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const manage = can('hr.reviews.manage');
  const [openId, setOpenId] = useState<string | null>(null);
  const [cycleModal, setCycleModal] = useState(false);
  const [assigning, setAssigning] = useState<Cycle | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [cycleFilter, setCycleFilter] = useState<string | null>(null);
  const form = useForm({ initialValues: { name: '', period_start: '', period_end: '' } });

  const reviews = useQuery({ queryKey: ['hr-reviews', cycleFilter], queryFn: async () => (await api.get<{ data: Review[] }>('/reviews', { params: { cycle_id: cycleFilter ?? undefined } })).data.data });
  const cycles = useQuery({ queryKey: ['hr-cycles'], enabled: manage, queryFn: async () => (await api.get<{ data: Cycle[] }>('/review-cycles')).data.data });
  const emps = useQuery({ queryKey: ['emp-options'], enabled: manage, queryFn: async () => (await api.get<Paginated<{ id: string; full_name: string }>>('/employees', { params: { per_page: 100 } })).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-cycles'] }); void qc.invalidateQueries({ queryKey: ['hr-reviews'] }); };

  const create = useMutation({ mutationFn: async (v: typeof form.values) => api.post('/review-cycles', v), onSuccess: () => { toastOk(); setCycleModal(false); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const close = useMutation({ mutationFn: async (id: string) => api.post(`/review-cycles/${id}/close`), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });
  const assign = useMutation({ mutationFn: async () => (await api.post<{ data: { created: number } }>(`/review-cycles/${assigning!.id}/reviews`, { employee_ids: picked })).data.data, onSuccess: (r) => { toastOk(t('hr.assigned', { count: r.created })); setAssigning(null); setPicked([]); refresh(); }, onError: toastError });

  const list = (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead><Table.Tr><Table.Th>{t('hr.cycle')}</Table.Th><Table.Th>{t('hr.employee')}</Table.Th><Table.Th visibleFrom="sm">{t('hr.reviewer')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
      <Table.Tbody>
        {(reviews.data ?? []).map((r) => (
          <Table.Tr key={r.id}>
            <Table.Td>{r.cycle}</Table.Td><Table.Td>{r.employee}</Table.Td><Table.Td visibleFrom="sm">{r.reviewer ?? '—'}</Table.Td>
            <Table.Td><Badge color={REVIEW_COLOR[r.status]} variant="light">{t(`hr.review_status.${r.status}`)}</Badge></Table.Td>
            <Table.Td><Button size="compact-xs" variant="subtle" onClick={() => setOpenId(r.id)}>{t('approvals.details')}</Button></Table.Td>
          </Table.Tr>
        ))}
        {reviews.data?.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" size="sm">{t('hr.no_reviews')}</Text></Table.Td></Table.Tr>}
      </Table.Tbody>
    </Table>
  );

  return (
    <>
      <PageHeader title={t('hr.reviews_title')} description={t('hr.reviews_intro')} />
      <Tabs defaultValue="reviews">
        <Tabs.List mb="md"><Tabs.Tab value="reviews">{t('hr.reviews_tab')}</Tabs.Tab>{manage && <Tabs.Tab value="cycles">{t('hr.cycles_tab')}</Tabs.Tab>}</Tabs.List>
        <Tabs.Panel value="reviews">{list}</Tabs.Panel>
        {manage && (
          <Tabs.Panel value="cycles">
            <Group justify="flex-end" mb="sm"><Button leftSection={<IconPlus size={16} />} onClick={() => setCycleModal(true)}>{t('hr.new_cycle')}</Button></Group>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead><Table.Tr><Table.Th>{t('common.name')}</Table.Th><Table.Th visibleFrom="sm">{t('hr.period')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
              <Table.Tbody>
                {(cycles.data ?? []).map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td><Text size="sm" fw={600}>{c.name}</Text></Table.Td><Table.Td visibleFrom="sm">{c.period_start} → {c.period_end}</Table.Td>
                    <Table.Td><Badge color={c.status === 'open' ? 'green' : 'gray'} variant="light">{t(`hr.cycle_status.${c.status}`)}</Badge></Table.Td>
                    <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                      <Button size="compact-xs" variant="subtle" onClick={() => setCycleFilter(cycleFilter === c.id ? null : c.id)}>{cycleFilter === c.id ? t('hr.clear_filter') : t('hr.filter_reviews')}</Button>
                      {c.status === 'open' && <Button size="compact-xs" variant="subtle" leftSection={<IconUsersPlus size={14} />} onClick={() => setAssigning(c)}>{t('hr.assign')}</Button>}
                      {c.status === 'open' && <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconLock size={14} />} loading={close.isPending} onClick={() => close.mutate(c.id)}>{t('hr.close_cycle')}</Button>}
                    </Group></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        )}
      </Tabs>

      <Modal opened={cycleModal} onClose={() => setCycleModal(false)} title={t('hr.new_cycle')} centered>
        <form onSubmit={form.onSubmit((v) => create.mutate(v))}>
          <Stack gap="sm">
            <TextInput label={t('common.name')} required {...form.getInputProps('name')} />
            <Group grow><TextInput type="date" label={t('hr.period_start')} required {...form.getInputProps('period_start')} /><TextInput type="date" label={t('hr.period_end')} required {...form.getInputProps('period_end')} /></Group>
            <Group justify="flex-end"><Button variant="default" onClick={() => setCycleModal(false)}>{t('common.cancel')}</Button><Button type="submit" loading={create.isPending}>{t('common.save')}</Button></Group>
          </Stack>
        </form>
      </Modal>
      <Modal opened={!!assigning} onClose={() => setAssigning(null)} title={`${t('hr.assign')} — ${assigning?.name ?? ''}`} centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">{t('hr.assign_note')}</Text>
          <MultiSelect searchable label={t('hr.employees')} data={(emps.data ?? []).map((e) => ({ value: e.id, label: e.full_name }))} value={picked} onChange={setPicked} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setAssigning(null)}>{t('common.cancel')}</Button><Button disabled={!picked.length} loading={assign.isPending} onClick={() => assign.mutate()}>{t('hr.assign')}</Button></Group>
        </Stack>
      </Modal>
      <ReviewModal id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
