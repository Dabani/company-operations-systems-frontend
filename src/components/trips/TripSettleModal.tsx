import { Alert, Button, Group, Modal, Radio, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { allowedResolutions, fmtMoney, settlementDirection } from '@/lib/trips';
import { toastError, toastOk } from '@/lib/ui';
import { useLookup } from '@/lib/useLookup';

interface Totals { accepted_total: string; advance_total: string; balance: string; direction: string }
interface Props { opened: boolean; onClose: () => void; tripId: string; employeeId: string; name: string; currency: string }

/** Close one traveller's account: expenses accepted minus the advance paid. A payroll deduction needs the employee's recorded consent and its lawful basis. */
export function TripSettleModal({ opened, onClose, tripId, employeeId, name, currency }: Props) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const res = useLookup('trip_settlement_resolution');
  const [resolution, setResolution] = useState<string>('');
  const [note, setNote] = useState('');
  const [consentOn, setConsentOn] = useState('');
  const [basis, setBasis] = useState('');
  const q = useQuery({ queryKey: ['trip-settle', tripId, employeeId], enabled: opened, queryFn: async () => (await api.get<{ data: Totals }>(`/trips/${tripId}/settlement-preview`, { params: { employee_id: employeeId } })).data.data });
  const dir = q.data ? settlementDirection(q.data.balance) : 'even';
  const allowed = allowedResolutions(dir);
  const pick = allowed.includes(resolution) ? resolution : allowed.length === 1 ? allowed[0] : '';
  const ok = !!pick && (pick !== 'waived' || !!note.trim()) && (pick !== 'payroll_deduction' || (!!consentOn && !!basis.trim()));
  const save = useMutation({
    mutationFn: async () => api.post(`/trips/${tripId}/settle`, { employee_id: employeeId, resolution: pick, note: note || undefined, consent: pick === 'payroll_deduction' ? { consented_on: consentOn, lawful_basis: basis } : undefined }),
    onSuccess: () => { toastOk(t('trips.settled_ok')); onClose(); void qc.invalidateQueries({ queryKey: ['trip', tripId] }); void qc.invalidateQueries({ queryKey: ['trips'] }); }, onError: toastError,
  });
  const m = (v: string) => fmtMoney(v, currency, i18n.language);
  return (
    <Modal opened={opened} onClose={onClose} title={`${t('trips.settle')} — ${name}`} centered>
      <Stack gap="sm">
        {q.data && <Table fz="sm" verticalSpacing={4}><Table.Tbody>
          <Table.Tr><Table.Td>{t('trips.accepted_total')}</Table.Td><Table.Td ta="right">{m(q.data.accepted_total)}</Table.Td></Table.Tr>
          <Table.Tr><Table.Td>{t('trips.advance_paid')}</Table.Td><Table.Td ta="right">− {m(q.data.advance_total)}</Table.Td></Table.Tr>
          <Table.Tr><Table.Td fw={700}>{t(`trips.direction.${dir}`)}</Table.Td><Table.Td ta="right" fw={700} c={dir === 'employee_owes' ? 'red' : undefined}>{m(q.data.balance.replace('-', ''))}</Table.Td></Table.Tr>
        </Table.Tbody></Table>}
        {allowed.length > 1 || allowed.length === 1 ? (
          <Radio.Group label={t('trips.resolution')} value={pick} onChange={setResolution}>
            <Stack gap={6} mt={6}>{allowed.map((r) => <Radio key={r} value={r} label={res.items.find((x) => x.code === r)?.label ?? r} />)}</Stack>
          </Radio.Group>
        ) : null}
        {pick === 'waived' && <Textarea label={t('trips.waive_reason')} required autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />}
        {pick === 'payroll_deduction' && (
          <Stack gap="xs"><Alert color="orange" variant="light">{t('trips.consent_note')}</Alert>
            <TextInput type="date" label={t('trips.consent_date')} required max={new Date().toISOString().slice(0, 10)} value={consentOn} onChange={(e) => setConsentOn(e.currentTarget.value)} />
            <Textarea label={t('trips.lawful_basis')} required autosize minRows={2} value={basis} onChange={(e) => setBasis(e.currentTarget.value)} /></Stack>
        )}
        <Text size="xs" c="dimmed">{t('trips.settle_hint')}</Text>
        <Group justify="flex-end"><Button variant="default" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} loading={save.isPending} onClick={() => save.mutate()}>{t('trips.settle')}</Button></Group>
      </Stack>
    </Modal>
  );
}
