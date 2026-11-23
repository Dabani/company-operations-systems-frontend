import { Tabs } from '@mantine/core';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader } from '@/components/PageHeader';
import { PayAssignmentsPanel } from '@/components/payroll/PayAssignmentsPanel';
import { PayComponentsPanel } from '@/components/payroll/PayComponentsPanel';
import { PayDryRunPanel } from '@/components/payroll/PayDryRunPanel';
import { PayItemsPanel } from '@/components/payroll/PayItemsPanel';
import { PaySchemesPanel } from '@/components/payroll/PaySchemesPanel';
import { PayStatusPanel } from '@/components/payroll/PayStatusPanel';

/** Payroll configuration: status, components, schemes (versions and bands), assignments, recurring items, dry-run. Nothing is pre-filled; every money value needs a second person. */
export function PayrollSetupPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const any = can('hr.payroll.view') || can('hr.payroll.configure') || can('hr.payroll.verify') || can('hr.payroll.prepare');
  const tabs = [
    any && ['status', t('pay.tab_status'), <PayStatusPanel key="s" />],
    any && ['components', t('pay.tab_components'), <PayComponentsPanel key="c" />],
    any && ['schemes', t('pay.tab_schemes'), <PaySchemesPanel key="m" />],
    any && ['assignments', t('pay.tab_assignments'), <PayAssignmentsPanel key="a" />],
    any && ['items', t('pay.tab_items'), <PayItemsPanel key="i" />],
    can('hr.payroll.prepare') && ['dry', t('pay.tab_dry'), <PayDryRunPanel key="d" />],
  ].filter(Boolean) as [string, string, ReactElement][];
  const [tab, setTab] = useState<string | null>(tabs[0]?.[0] ?? null);
  return (
    <>
      <PageHeader title={t('pay.setup_title')} description={t('pay.setup_intro')} />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">{tabs.map(([k, label]) => <Tabs.Tab key={k} value={k}>{label}</Tabs.Tab>)}</Tabs.List>
        {tabs.map(([k, , el]) => <Tabs.Panel key={k} value={k}>{el}</Tabs.Panel>)}
      </Tabs>
    </>
  );
}
