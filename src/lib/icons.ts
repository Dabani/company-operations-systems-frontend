import { IconLayoutKanban as IconLayoutKanbanPolish, IconClock as IconClockPolish, IconCoin as IconCoinPolish, IconFileInvoice as IconFileInvoicePolish, IconPercentage as IconPercentagePolish, IconRoute as IconRoutePolish, IconUsersGroup as IconUsersGroupPolish, IconBuildingStore as IconBuildingStorePolish, IconWorld as IconWorldPolish, IconChecklist as IconChecklistPolish, IconScale as IconScalePolish } from '@tabler/icons-react';
import {
  IconLayoutDashboard, IconSettings, IconShieldLock, IconUsers, IconKey, IconBuilding, IconId, IconSitemap,
  IconMapPin, IconAdjustments, IconListDetails, IconHistory, IconHandStop, IconStairs, IconDoor, IconArchive,
  IconBooks, IconHeadset, IconTicket, IconMessages, IconFiles, IconTrashX, IconServer2, IconDeviceLaptop, IconTruckDelivery, IconUserShield, IconAlertTriangle, IconClockExclamation, IconFolders, IconDoorEnter, IconClipboardCheck, IconCalendarTime, IconShieldCheck, IconScale, IconCalendarEvent, IconSchool, IconChecklist, IconDatabase, IconReportAnalytics, IconChartBar, IconPresentationAnalytics, IconSend, IconCircle, type Icon,
} from '@tabler/icons-react';

// Icon names stored in the database (menu_items.icon, widgets, lookups) resolve here.
// Add an entry whenever a later bundle seeds a new icon name.
const MAP: Record<string, Icon> = {
  IconLayoutDashboard, IconSettings, IconShieldLock, IconUsers, IconKey, IconBuilding, IconId, IconSitemap,
  IconMapPin, IconAdjustments, IconListDetails, IconHistory, IconHandStop, IconStairs, IconDoor, IconArchive, IconBooks,
  IconHeadset, IconTicket, IconMessages, IconFiles, IconTrashX, IconServer2, IconDeviceLaptop, IconTruckDelivery, IconUserShield, IconAlertTriangle, IconClockExclamation, IconFolders, IconDoorEnter, IconClipboardCheck, IconCalendarTime, IconShieldCheck, IconScale, IconCalendarEvent, IconSchool, IconChecklist, IconDatabase, IconReportAnalytics, IconChartBar, IconPresentationAnalytics, IconSend,
};

Object.assign(MAP, { IconLayoutKanban: IconLayoutKanbanPolish, IconClock: IconClockPolish, IconCoin: IconCoinPolish, IconFileInvoice: IconFileInvoicePolish, IconPercentage: IconPercentagePolish, IconRoute: IconRoutePolish, IconUsersGroup: IconUsersGroupPolish, IconBuildingStore: IconBuildingStorePolish, IconWorld: IconWorldPolish, IconChecklist: IconChecklistPolish, IconScale: IconScalePolish });

export const iconFor = (name?: string | null): Icon => (name && MAP[name]) || IconCircle;
