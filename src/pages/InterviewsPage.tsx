import { Badge, Button, Group, Modal, Select, Stack, Table, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { toastError, toastOk } from '@/lib/ui';
import { RichTextField } from '@/components/RichTextField';
import { SafeHtml } from '@/components/SafeHtml';

interface Interview {
  id: string; applicant: string; vacancy: string | null; type: string; status: string; scheduled_at: string; location: string | null; notes: string | null;
  panel: { id: string; name: string; submitted: boolean }[]; can_score: boolean; my_scorecard_submitted: boolean;
  scorecards?: { panelist: string; score: number; recommendation: string; strengths: string | null; concerns: string | null }[];
}
const REC = ['strong_yes', 'yes', 'no', 'strong_no'];
const REC_COLOR: Record<string, string> = { strong_yes: 'green', yes: 'teal', no: 'orange', strong_no: 'red' };

export function InterviewsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [scoring, setScoring] = useState<Interview | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const form = useForm({ initialValues: { score: null as string | null, recommendation: null as string | null, strengths: '', concerns: '' } });
  const list = useQuery({ queryKey: ['hr-interviews'], queryFn: async () => (await api.get<{ data: Interview[] }>('/interviews')).data.data });
  const detail = useQuery({ queryKey: ['hr-interview', viewId], enabled: !!viewId, queryFn: async () => (await api.get<{ data: Interview }>(`/interviews/${viewId}`)).data.data });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['hr-interviews'] }); void qc.invalidateQueries({ queryKey: ['hr-interview'] }); void qc.invalidateQueries({ queryKey: ['hr-applicant'] }); };

  const submit = useMutation({ mutationFn: async (v: typeof form.values) => api.post(`/interviews/${scoring!.id}/scorecard`, { ...v, score: Number(v.score) }),
    onSuccess: () => { toastOk(t('rec.scorecard_saved')); setScoring(null); form.reset(); refresh(); }, onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); } });
  const status = useMutation({ mutationFn: async (p: { id: string; status: 'completed' | 'cancelled' }) => api.post(`/interviews/${p.id}/status`, { status: p.status }), onSuccess: () => { toastOk(); refresh(); }, onError: toastError });

  return (
    <>
      <PageHeader title={t('rec.interviews_title')} description={t('rec.interviews_intro')} />
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead><Table.Tr><Table.Th>{t('rec.applicant')}</Table.Th><Table.Th visibleFrom="sm">{t('rec.vacancy')}</Table.Th><Table.Th>{t('rec.when')}</Table.Th><Table.Th>{t('common.status')}</Table.Th><Table.Th visibleFrom="sm">{t('rec.panel')}</Table.Th><Table.Th /></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(list.data ?? []).map((i) => (
            <Table.Tr key={i.id}>
              <Table.Td><Text size="sm" fw={600}>{i.applicant}</Text><Text size="xs" c="dimmed">{t(`rec.itype.${i.type}`)}{i.location ? ` · ${i.location}` : ''}</Text></Table.Td>
              <Table.Td visibleFrom="sm">{i.vacancy}</Table.Td><Table.Td>{i.scheduled_at.slice(0, 16).replace('T', ' ')}</Table.Td>
              <Table.Td><Badge variant="light" color={i.status === 'completed' ? 'green' : i.status === 'cancelled' ? 'gray' : 'blue'}>{t(`rec.istatus.${i.status}`)}</Badge></Table.Td>
              <Table.Td visibleFrom="sm">{i.panel.filter((p) => p.submitted).length} / {i.panel.length}</Table.Td>
              <Table.Td><Group gap={4} wrap="nowrap" justify="flex-end">
                {i.can_score && <Button size="compact-xs" onClick={() => setScoring(i)}>{t('rec.score')}</Button>}
                <Button size="compact-xs" variant="subtle" onClick={() => setViewId(i.id)}>{t('approvals.details')}</Button>
                {can('hr.recruitment.manage') && i.status === 'scheduled' && <Button size="compact-xs" variant="subtle" color="red" onClick={() => status.mutate({ id: i.id, status: 'cancelled' })}>{t('approvals.cancel')}</Button>}
              </Group></Table.Td>
            </Table.Tr>
          ))}
          {list.data?.length === 0 && <Table.Tr><Table.Td colSpan={6}><Text size="sm" c="dimmed">{t('rec.no_interviews_list')}</Text></Table.Td></Table.Tr>}
        </Table.Tbody>
      </Table>

      <Modal opened={!!scoring} onClose={() => setScoring(null)} title={scoring ? `${t('rec.score')} — ${scoring.applicant}` : ''} centered>
        <form onSubmit={form.onSubmit((v) => submit.mutate(v))}><Stack gap="sm">
          <Text size="sm" c="dimmed">{t('rec.scorecard_note')}</Text>
          <Group grow align="flex-start">
            <Select label={t('rec.score_label')} required data={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} — ${t(`rec.score_${n}`)}` }))} {...form.getInputProps('score')} />
            <Select label={t('hr.recommendation')} required data={REC.map((r) => ({ value: r, label: t(`rec.rec.${r}`) }))} {...form.getInputProps('recommendation')} />
          </Group>
          <RichTextField label={t('rec.strengths')} minHeight={80} {...form.getInputProps('strengths')} />
          <RichTextField label={t('rec.concerns')} minHeight={80} {...form.getInputProps('concerns')} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setScoring(null)}>{t('common.cancel')}</Button><Button type="submit" loading={submit.isPending}>{t('rec.submit_scorecard')}</Button></Group>
        </Stack></form>
      </Modal>

      <Modal opened={!!viewId} onClose={() => setViewId(null)} title={detail.data ? `${detail.data.applicant} — ${t(`rec.itype.${detail.data.type}`)}` : t('common.loading')} centered size="lg">
        {detail.data && (
          <Stack gap="sm">
            <Text size="sm">{detail.data.scheduled_at.slice(0, 16).replace('T', ' ')}{detail.data.location ? ` · ${detail.data.location}` : ''}</Text>
            <Text size="sm"><b>{t('rec.panel')}:</b> {detail.data.panel.map((p) => `${p.name}${p.submitted ? ' ✓' : ''}`).join(', ')}</Text>
            {!detail.data.my_scorecard_submitted && !can('hr.recruitment.manage') && <Text size="sm" c="dimmed">{t('rec.others_hidden')}</Text>}
            {(detail.data.scorecards ?? []).map((s, i) => (
              <Stack key={i} gap={2} p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
                <Group justify="space-between"><Text size="sm" fw={600}>{s.panelist}</Text><Group gap={6}><Badge variant="light">{s.score} / 5</Badge><Badge color={REC_COLOR[s.recommendation]} variant="light">{t(`rec.rec.${s.recommendation}`)}</Badge></Group></Group>
                {s.strengths && <><Text size="xs" fw={700}>{t('rec.strengths')}</Text><SafeHtml html={s.strengths} /></>}{s.concerns && <><Text size="xs" fw={700}>{t('rec.concerns')}</Text><SafeHtml html={s.concerns} /></>}
              </Stack>
            ))}
            {detail.data.scorecards?.length === 0 && <Text size="sm" c="dimmed">{t('rec.no_scorecards')}</Text>}
          </Stack>
        )}
      </Modal>
    </>
  );
}
