import { Tabs } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { AttendanceSettingsTab, HolidaysTab, PlacesTab, SchedulesTab, ShiftsTab } from '@/components/AttendanceSetup';
import { PageHeader } from '@/components/PageHeader';

export function AttendanceSetupPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('att.setup_title')} description={t('att.setup_intro')} />
      <Tabs defaultValue="shifts" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="shifts">{t('att.tab_shifts')}</Tabs.Tab><Tabs.Tab value="schedules">{t('att.tab_schedules')}</Tabs.Tab><Tabs.Tab value="holidays">{t('att.tab_holidays')}</Tabs.Tab>
          <Tabs.Tab value="places">{t('att.tab_places')}</Tabs.Tab><Tabs.Tab value="settings">{t('att.tab_settings')}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="shifts"><ShiftsTab /></Tabs.Panel>
        <Tabs.Panel value="schedules"><SchedulesTab /></Tabs.Panel>
        <Tabs.Panel value="holidays"><HolidaysTab /></Tabs.Panel>
        <Tabs.Panel value="places"><PlacesTab /></Tabs.Panel>
        <Tabs.Panel value="settings"><AttendanceSettingsTab /></Tabs.Panel>
      </Tabs>
    </>
  );
}
