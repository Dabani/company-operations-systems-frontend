import { ActionIcon, Badge, Button, Group, Modal, Popover, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconClockPause, IconClockPlay, IconPlayerPlay, IconPlayerStop, IconPlayerPause } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { toastError, toastOk } from '@/lib/ui';
import type { Paginated } from '@/types';

interface Timer { id: string; state: 'running' | 'paused'; project: string; task: string | null; description: string | null; elapsed_seconds: number }
interface TimerResponse { data: Timer | null; server_now: string; settings: { max_hours: number; idle_warning_minutes: number; manual_allowed: boolean } }
interface Proj { id: string; code: string; name: string }
interface TaskRow { id: string; key: string; title: string }

export const fmt = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

/** Header timer. The server owns the clock: the browser only displays server elapsed time plus the seconds since the last sync. */
export function TimerWidget() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ project: string | null; task: string | null; note: string }>({ project: null, task: null, note: '' });
  const [confirm, setConfirm] = useState(false);
  const [tick, setTick] = useState(0);

  const q = useQuery({ queryKey: ['timer'], enabled: can('time.track'), refetchInterval: 30000, refetchOnWindowFocus: true,
    queryFn: async () => ({ ...(await api.get<TimerResponse>('/timer')).data, fetchedAt: Date.now() }) });
  const projects = useQuery({ queryKey: ['timer-projects'], enabled: open, queryFn: async () => (await api.get<Paginated<Proj>>('/projects', { params: { per_page: 100 } })).data.data });
  const tasks = useQuery({ queryKey: ['timer-tasks', form.project], enabled: open && !!form.project, queryFn: async () => (await api.get<{ data: TaskRow[] }>(`/projects/${form.project}/tasks`)).data.data });

  useEffect(() => { const i = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const sync = () => { void qc.invalidateQueries({ queryKey: ['timer'] }); void qc.invalidateQueries({ queryKey: ['time-week'] }); };
  const act = useMutation({ mutationFn: async (v: string) => api.post(`/timer/${v}`), onSuccess: sync, onError: toastError });
  const start = useMutation({
    mutationFn: async (stopExisting: boolean) => api.post('/timer/start', { project_id: form.project, task_id: form.task, description: form.note || null, stop_existing: stopExisting }),
    onSuccess: () => { setOpen(false); setConfirm(false); toastOk(t('time.started')); sync(); },
    onError: (e) => { if (parseError(e).fields.timer) setConfirm(true); else toastError(e); },
  });

  if (!can('time.track') || !q.data) return null;
  const timer = q.data.data;
  const elapsed = timer ? timer.elapsed_seconds + (timer.state === 'running' ? Math.floor((Date.now() - q.data.fetchedAt) / 1000) : 0) : 0;
  void tick;
  const maxS = q.data.settings.max_hours * 3600;
  const near = timer && elapsed > maxS - 3600;

  return (
    <>
      {timer ? (
        <Group gap={6} wrap="nowrap">
          <Tooltip label={`${timer.project}${timer.task ? ` · ${timer.task}` : ''}`}>
            <Badge size="lg" variant="light" color={near ? 'red' : timer.state === 'running' ? 'green' : 'yellow'} leftSection={timer.state === 'running' ? <IconClockPlay size={14} /> : <IconClockPause size={14} />} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(elapsed)}</Badge>
          </Tooltip>
          {timer.state === 'running'
            ? <ActionIcon variant="light" onClick={() => act.mutate('pause')} aria-label={t('time.pause')}><IconPlayerPause size={16} /></ActionIcon>
            : <ActionIcon variant="light" color="green" onClick={() => act.mutate('resume')} aria-label={t('time.resume')}><IconPlayerPlay size={16} /></ActionIcon>}
          <ActionIcon variant="light" color="red" onClick={() => act.mutate('stop')} aria-label={t('time.stop')}><IconPlayerStop size={16} /></ActionIcon>
        </Group>
      ) : (
        <Popover opened={open} onChange={setOpen} width={320} position="bottom-end" withArrow shadow="md" trapFocus>
          <Popover.Target><Tooltip label={t('time.start')}><ActionIcon variant="light" onClick={() => setOpen((o) => !o)} aria-label={t('time.start')}><IconPlayerPlay size={18} /></ActionIcon></Tooltip></Popover.Target>
          <Popover.Dropdown><Stack gap="xs">
            <Select placeholder={t('time.project')} searchable data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))} value={form.project} onChange={(v) => setForm({ ...form, project: v, task: null })} />
            <Select placeholder={t('time.task_optional')} clearable searchable disabled={!form.project} data={(tasks.data ?? []).map((x) => ({ value: x.id, label: `${x.key} · ${x.title}` }))} value={form.task} onChange={(v) => setForm({ ...form, task: v })} />
            <TextInput placeholder={t('time.note')} value={form.note} onChange={(e) => setForm({ ...form, note: e.currentTarget.value })} />
            <Button disabled={!form.project} loading={start.isPending} onClick={() => start.mutate(false)}>{t('time.start')}</Button>
          </Stack></Popover.Dropdown>
        </Popover>
      )}
      <Modal opened={confirm} onClose={() => setConfirm(false)} title={t('time.already_running')} centered>
        <Stack><Text size="sm">{t('time.stop_and_start')}</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button><Button loading={start.isPending} onClick={() => start.mutate(true)}>{t('time.stop_and_start_btn')}</Button></Group></Stack>
      </Modal>
    </>
  );
}
