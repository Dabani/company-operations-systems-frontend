import { Tabs } from '@mantine/core';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { LeaveLegalPanel } from '@/components/leave/LeaveLegalPanel';
import { LeavePeriodsPanel } from '@/components/leave/LeavePeriodsPanel';
import { LeavePolicyPanel } from '@/components/leave/LeavePolicyPanel';
import { LeaveProfilePanel } from '@/components/leave/LeaveProfilePanel';
import { LeaveStatusPanel } from '@/components/leave/LeaveStatusPanel';
import { LeaveTypesPanel } from '@/components/leave/LeaveTypesPanel';
import { PageHeader } from '@/components/PageHeader';

/** Leave setup: go-live status, types, periods, statutory rules, policy worked examples, profiles. Each tab shows only for the permission that lets the API serve it. */
export function LeaveSetupPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const manage = can('hr.leave.manage');
  const legal = can('hr.leave.legal.manage') || manage || can('rules.view');
  const tabs = [
    legal && ['status', t('leave.tab_status'), <LeaveStatusPanel key="s" />],
    manage && ['types', t('leave.tab_types'), <LeaveTypesPanel key="t" />],
    manage && ['periods', t('leave.tab_periods'), <LeavePeriodsPanel key="p" />],
    legal && ['legal', t('leave.tab_legal'), <LeaveLegalPanel key="l" />],
    legal && ['policy', t('leave.tab_policy'), <LeavePolicyPanel key="o" />],
    can('hr.leave.profile') && ['profiles', t('leave.tab_profiles'), <LeaveProfilePanel key="f" />],
  ].filter(Boolean) as [string, string, ReactElement][];
  const [tab, setTab] = useState<string | null>(tabs[0]?.[0] ?? null);
  return (
    <>
      <PageHeader title={t('leave.setup_title')} description={t('leave.setup_intro')} />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">{tabs.map(([k, label]) => <Tabs.Tab key={k} value={k}>{label}</Tabs.Tab>)}</Tabs.List>
        {tabs.map(([k, , el]) => <Tabs.Panel key={k} value={k}>{el}</Tabs.Panel>)}
      </Tabs>
    </>
  );
}
