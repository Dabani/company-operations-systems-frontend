import { ActionIcon, Alert, Button, Fieldset, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, parseError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PeopleMultiSelect, PersonSelect, usePeople } from '@/components/PeoplePicker';
import { RichTextField } from '@/components/RichTextField';
import { utcToWall, wallToUtc } from '@/lib/meetings';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';
import type { Paginated } from '@/types';

export interface MeetingForEdit {
  id: string; title: string; purpose: string | null; type_id: string; confidentiality_id: string | null; confidential: boolean; starts_at: string; ends_at: string; timezone: string;
  rsvp_deadline: string | null; venue: string | null; online_url: string | null; status: string;
  room: { id: string } | null; department: { id: string } | null; project: { id: string } | null; chair: { id: string; name: string } | null; secretary: { id: string; name: string } | null; facilitator: { id: string; name: string } | null;
}

interface Props { opened: boolean; onClose: () => void; meeting?: MeetingForEdit | null; onSaved: (id: string) => void }
interface Guest { name: string; email: string }
interface Room { id: string; name: string; capacity: number | null; is_active: boolean }

const blank = {
  title: '', purpose: '', type_id: null as string | null, confidential: false, starts_at: '', ends_at: '', room_id: null as string | null, venue: '', online_url: '', rsvp_deadline: '',
  department_id: null as string | null, project_id: null as string | null, chair_id: null as string | null, secretary_id: null as string | null, facilitator_id: null as string | null,
  user_ids: [] as string[], department_ids: [] as string[], guests: [] as Guest[],
  repeat: 'none', interval: 1 as number | string, occurrences: 4 as number | string, reason: '',
};

/** Create or change a meeting. Times are typed in the organization's timezone and sent as UTC instants. */
export function MeetingFormModal({ opened, onClose, meeting, onSaved }: Props) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const edit = !!meeting;
  const form = useForm({ initialValues: blank });
  const people = usePeople(opened);
  const types = useLookup('meeting_type', opened);
  const conf = useLookup('meeting_confidentiality', opened);
  const tz = meeting?.timezone ?? people.timezone ?? 'UTC';
  const rooms = useQuery({ queryKey: ['meeting-rooms-options'], enabled: opened, queryFn: async () => (await api.get<{ data: Room[] }>('/meeting-rooms')).data.data });
  const depts = useQuery({ queryKey: ['dept-options'], enabled: opened && can('department.view'), queryFn: async () => (await api.get<Paginated<{ id: string; name: string }>>('/departments', { params: { per_page: 100 } })).data.data });
  const projects = useQuery({ queryKey: ['project-options'], enabled: opened && can('project.view'), queryFn: async () => (await api.get<Paginated<{ id: string; code: string; name: string }>>('/projects', { params: { per_page: 100 } })).data.data });

  useEffect(() => {
    if (!opened) return;
    if (meeting) {
      people.remember([meeting.chair, meeting.secretary, meeting.facilitator].filter(Boolean).map((p) => ({ id: p!.id, name: p!.name, email: '' })));
      form.setValues({ ...blank, title: meeting.title, purpose: meeting.purpose ?? '', type_id: meeting.type_id, confidential: meeting.confidential, starts_at: utcToWall(meeting.starts_at, meeting.timezone),
        ends_at: utcToWall(meeting.ends_at, meeting.timezone), room_id: meeting.room?.id ?? null, venue: meeting.venue ?? '', online_url: meeting.online_url ?? '', rsvp_deadline: utcToWall(meeting.rsvp_deadline, meeting.timezone),
        department_id: meeting.department?.id ?? null, project_id: meeting.project?.id ?? null, chair_id: meeting.chair?.id ?? null, secretary_id: meeting.secretary?.id ?? null, facilitator_id: meeting.facilitator?.id ?? null });
    } else {
      form.setValues(blank);
    }
    form.clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, meeting?.id]);

  const save = useMutation({
    mutationFn: async (v: typeof blank) => {
      const confidentialId = conf.items.find((c) => c.code === (v.confidential ? 'confidential' : 'normal'))?.id ?? null;
      const body: Record<string, unknown> = {
        title: v.title, purpose: v.purpose || null, type_id: v.type_id, confidentiality_id: confidentialId, starts_at: wallToUtc(v.starts_at, tz), ends_at: wallToUtc(v.ends_at, tz),
        room_id: v.room_id, venue: v.venue || null, online_url: v.online_url || null, rsvp_deadline: v.rsvp_deadline ? wallToUtc(v.rsvp_deadline, tz) : null,
        department_id: v.department_id, project_id: v.project_id, chair_id: v.chair_id, secretary_id: v.secretary_id, facilitator_id: v.facilitator_id,
      };
      if (edit) {
        if (meeting!.status === 'scheduled' && v.reason) body.reason = v.reason;
        return (await api.patch<{ data: { id: string }; meta?: { warnings?: { name: string | null }[] } }>(`/meetings/${meeting!.id}`, body)).data;
      }
      body.participants = { user_ids: v.user_ids, department_ids: v.department_ids, guests: v.guests.filter((g) => g.name && g.email) };
      if (v.repeat !== 'none') body.recurrence = { frequency: v.repeat, interval: Number(v.interval) || 1, occurrences: Number(v.occurrences) || 2 };
      return (await api.post<{ data: { id: string }; meta?: { created?: number; warnings?: { name: string | null }[] } }>('/meetings', body)).data;
    },
    onSuccess: (r) => { toastOk(); if (r.meta?.warnings?.length) notifications.show({ color: 'orange', autoClose: 10000, message: `${t('meet.busy_warning')} ${r.meta.warnings.map((w) => w.name).filter(Boolean).join(', ')}` }); onSaved(r.data.id); onClose(); },
    onError: (e) => { form.setErrors(parseError(e).fields); toastError(e); },
  });

  const v = form.values;
  const bad = !v.title || !v.type_id || !v.starts_at || !v.ends_at || v.ends_at <= v.starts_at;
  const roomOptions = (rooms.data ?? []).filter((r) => r.is_active || r.id === v.room_id).map((r) => ({ value: r.id, label: r.capacity ? `${r.name} (${r.capacity})` : r.name }));

  return (
    <Modal opened={opened} onClose={onClose} title={edit ? t('meet.edit') : t('meet.new')} size="xl" centered>
      <form onSubmit={form.onSubmit((x) => save.mutate(x))}>
        <Stack gap="sm">
          <TextInput label={t('meet.title')} required maxLength={200} {...form.getInputProps('title')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label={t('common.type')} required data={types.options} {...form.getInputProps('type_id')} />
            <Switch mt={{ base: 0, sm: 28 }} label={t('meet.confidential')} description={t('meet.confidential_hint')} {...form.getInputProps('confidential', { type: 'checkbox' })} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">{t('meet.times_in_tz', { tz })}</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput type="datetime-local" label={t('meet.starts')} required {...form.getInputProps('starts_at')} />
            <TextInput type="datetime-local" label={t('meet.ends')} required error={v.ends_at && v.ends_at <= v.starts_at ? t('meet.end_after_start') : form.errors.ends_at} onChange={(e) => form.setFieldValue('ends_at', e.currentTarget.value)} value={v.ends_at} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label={t('meet.room')} data={roomOptions} clearable searchable {...form.getInputProps('room_id')} />
            <TextInput label={t('meet.venue')} description={t('meet.venue_hint')} maxLength={255} {...form.getInputProps('venue')} />
          </SimpleGrid>
          <TextInput label={t('meet.online_url')} placeholder="https://" maxLength={500} {...form.getInputProps('online_url')} />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <PersonSelect label={t('meet.chair')} people={people} value={v.chair_id} onChange={(x) => form.setFieldValue('chair_id', x)} error={form.errors.chair_id as string | undefined} description={t('meet.chair_hint')} />
            <PersonSelect label={t('meet.secretary')} people={people} value={v.secretary_id} onChange={(x) => form.setFieldValue('secretary_id', x)} error={form.errors.secretary_id as string | undefined} />
            <PersonSelect label={t('meet.facilitator')} people={people} value={v.facilitator_id} onChange={(x) => form.setFieldValue('facilitator_id', x)} error={form.errors.facilitator_id as string | undefined} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Select label={t('meet.department')} data={(depts.data ?? []).map((d) => ({ value: d.id, label: d.name }))} clearable searchable disabled={!can('department.view')} {...form.getInputProps('department_id')} />
            <Select label={t('meet.project')} data={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` }))} clearable searchable disabled={!can('project.view')} {...form.getInputProps('project_id')} />
            <TextInput type="datetime-local" label={t('meet.rsvp_deadline')} {...form.getInputProps('rsvp_deadline')} />
          </SimpleGrid>
          <RichTextField label={t('meet.purpose')} minHeight={90} {...form.getInputProps('purpose')} />

          {!edit && (
            <>
              <Fieldset legend={t('meet.invitees')}>
                <Stack gap="sm">
                  <PeopleMultiSelect label={t('meet.people')} people={people} value={v.user_ids} onChange={(x) => form.setFieldValue('user_ids', x)} />
                  <Select label={t('meet.whole_department')} data={(depts.data ?? []).filter((d) => !v.department_ids.includes(d.id)).map((d) => ({ value: d.id, label: d.name }))} value={null} searchable placeholder={t('meet.add_department')}
                    onChange={(id) => id && form.setFieldValue('department_ids', [...v.department_ids, id])} disabled={!can('department.view')} />
                  {v.department_ids.length > 0 && <Group gap="xs">{v.department_ids.map((id) => (
                    <Button key={id} size="compact-xs" variant="light" rightSection={<IconTrash size={12} />} onClick={() => form.setFieldValue('department_ids', v.department_ids.filter((x) => x !== id))}>{depts.data?.find((d) => d.id === id)?.name}</Button>))}</Group>}
                  <Text size="sm" fw={500}>{t('meet.guests')}</Text>
                  {v.guests.map((g, i) => (
                    <Group key={i} align="flex-end" wrap="nowrap">
                      <TextInput style={{ flex: 1 }} placeholder={t('common.name')} value={g.name} onChange={(e) => form.setFieldValue(`guests.${i}.name`, e.currentTarget.value)} />
                      <TextInput style={{ flex: 1 }} type="email" placeholder="email@example.org" value={g.email} onChange={(e) => form.setFieldValue(`guests.${i}.email`, e.currentTarget.value)} />
                      <ActionIcon variant="subtle" color="red" aria-label={t('common.delete')} onClick={() => form.removeListItem('guests', i)}><IconTrash size={16} /></ActionIcon>
                    </Group>))}
                  <Group><Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => form.insertListItem('guests', { name: '', email: '' })}>{t('meet.add_guest')}</Button></Group>
                </Stack>
              </Fieldset>
              <Fieldset legend={t('meet.repeat')}>
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Select label={t('meet.repeats')} allowDeselect={false} data={[{ value: 'none', label: t('meet.no_repeat') }, { value: 'daily', label: t('meet.daily') }, { value: 'weekly', label: t('meet.weekly') }, { value: 'monthly', label: t('meet.monthly') }]} {...form.getInputProps('repeat')} />
                  {v.repeat !== 'none' && <NumberInput label={t('meet.every')} min={1} max={52} {...form.getInputProps('interval')} />}
                  {v.repeat !== 'none' && <NumberInput label={t('meet.occurrences')} min={2} max={52} {...form.getInputProps('occurrences')} />}
                </SimpleGrid>
              </Fieldset>
            </>
          )}
          {edit && meeting!.status === 'scheduled' && (
            <>
              <Alert variant="light" color="blue">{t('meet.change_notice')}</Alert>
              <TextInput label={t('meet.change_reason')} maxLength={1000} {...form.getInputProps('reason')} />
            </>
          )}
          <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" loading={save.isPending} disabled={bad}>{t('common.save')}</Button></Group>
        </Stack>
      </form>
    </Modal>
  );
}
