import { Alert, Badge, Card, Collapse, Group, List, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmt, FLAG_COLOR } from '@/lib/payroll';

export interface SlipLine { code: string; name: string; base: string | null; rate: string | null; amount: string; bands?: { lower: string; upper: string | null; rate: string; part: string; amount: string }[]; version_id?: string | null }
export interface SlipDetail {
  status: string; currency: string; category: string | null; run: { code: string; period_from: string; period_to: string; paid_on: string | null; kind: string; status: string };
  employee: { name: string; number: string | null }; proration: { factor: string | null; worked_days: number | null; period_days: number | null };
  totals: { gross: string; taxable_earnings: string; pensionable_earnings: string; employee_contributions: string; deductions: string; net: string; employer_contributions: string; employer_cost: string };
  net_difference: string | null; excluded_reason: string | null; earnings: SlipLine[]; contributions: SlipLine[]; deductions: SlipLine[]; employer: SlipLine[]; flags: { severity: string; code: string; message: string }[];
}

/** A stored payslip, read-only: the same view for HR and for the employee (who gets no review flags). */
export function PayslipView({ slip, showTechnical }: { slip: SlipDetail; showTechnical?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const m = (v: string | null) => fmt(v, slip.currency, i18n.language);
  const block = (title: string, lines: SlipLine[], withBase = false) => lines.length > 0 && (
    <Card withBorder padding="sm">
      <Text fw={600} size="sm" mb={4}>{title}</Text>
      <Table verticalSpacing={4} fz="sm"><Table.Tbody>
        {lines.map((l) => (
          <Table.Tr key={l.code + l.amount}>
            <Table.Td>{l.name}{showTechnical && l.version_id && <Text span size="xs" c="dimmed"> · v:{l.version_id.slice(-6)}</Text>}
              {withBase && l.base !== null && <Text size="xs" c="dimmed">{t('pay.base')} {m(l.base)}{l.rate ? ` · ${Number(l.rate)}%` : ''}</Text>}
              {!!l.bands?.length && <><Text size="xs" c="blue" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === l.code ? null : l.code)}>{t('pay.bands')}</Text>
                <Collapse expanded={open === l.code}><Table fz="xs" verticalSpacing={2}><Table.Tbody>{l.bands.map((b, i) => <Table.Tr key={i}><Table.Td>{Number(b.lower)} – {b.upper === null ? '…' : Number(b.upper)}</Table.Td><Table.Td>{Number(b.rate)}%</Table.Td><Table.Td ta="right">{m(b.part)}</Table.Td><Table.Td ta="right">{m(b.amount)}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Collapse></>}
            </Table.Td>
            <Table.Td ta="right">{m(l.amount)}</Table.Td>
          </Table.Tr>))}
      </Table.Tbody></Table>
    </Card>
  );
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <div><Text fw={700}>{slip.employee.name}</Text><Text size="xs" c="dimmed">{slip.employee.number} · {slip.run.code} · {slip.run.period_from} → {slip.run.period_to}</Text></div>
        {slip.proration.factor !== null && Number(slip.proration.factor) < 1 && <Badge variant="light" color="blue">{t('pay.days_worked', { worked: slip.proration.worked_days, total: slip.proration.period_days })}</Badge>}
      </Group>
      {slip.excluded_reason && <Alert color="gray" variant="light">{t('pay.excluded')}: {slip.excluded_reason}</Alert>}
      {slip.flags.length > 0 && <Alert color={slip.flags.some((f) => f.severity === 'blocker') ? 'red' : 'orange'} variant="light" title={t('pay.flags')}><List size="sm">{slip.flags.map((f, i) => <List.Item key={i}><Badge size="xs" color={FLAG_COLOR[f.severity]} variant="light" mr={6}>{t(`pay.severity.${f.severity}`)}</Badge>{f.message}</List.Item>)}</List></Alert>}
      {block(t('pay.earnings'), slip.earnings)}
      <Card withBorder padding="sm"><Group justify="space-between"><Text fw={600}>{t('pay.gross')}</Text><Text fw={600}>{m(slip.totals.gross)}</Text></Group></Card>
      {block(t('pay.contributions'), slip.contributions, true)}
      {block(t('pay.deductions'), slip.deductions)}
      <Card withBorder padding="sm" bg="var(--mantine-color-teal-light)"><Group justify="space-between"><Text fw={700} fz="lg">{t('pay.net')}</Text><Text fw={700} fz="lg">{m(slip.totals.net)}</Text></Group>
        {slip.net_difference !== null && <Group justify="space-between"><Text size="sm">{t('pay.net_difference')}</Text><Text size="sm" fw={600} c={Number(slip.net_difference) < 0 ? 'red' : undefined}>{m(slip.net_difference)}</Text></Group>}</Card>
      {block(t('pay.employer'), slip.employer, true)}
      {showTechnical && <Text size="xs" c="dimmed">{t('pay.employer_cost')}: {m(slip.totals.employer_cost)} · {t('pay.taxable')}: {m(slip.totals.taxable_earnings)} · {t('pay.pensionable')}: {m(slip.totals.pensionable_earnings)}</Text>}
    </Stack>
  );
}
