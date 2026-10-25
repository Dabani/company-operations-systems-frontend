import {
  IconLayoutDashboard, IconSettings, IconShieldLock, IconUsers, IconKey, IconBuilding, IconId, IconSitemap,
  IconMapPin, IconAdjustments, IconListDetails, IconHistory, IconHandStop, IconStairs, IconDoor, IconArchive,
  IconBooks, IconHeadset, IconTicket, IconMessages, IconFiles, IconTrashX, IconServer2, IconDeviceLaptop, IconTruckDelivery, IconUserShield, IconAlertTriangle, IconClockExclamation, IconFolders, IconDoorEnter, IconClipboardCheck, IconCalendarTime, IconShieldCheck, IconScale, IconCalendarEvent, IconSchool, IconChecklist, IconDatabase, IconReportAnalytics, IconCircle, type Icon,
} from '@tabler/icons-react';

// Icon names stored in the database (menu_items.icon, widgets, lookups) resolve here.
// Add an entry whenever a later bundle seeds a new icon name.
const MAP: Record<string, Icon> = {
  IconLayoutDashboard, IconSettings, IconShieldLock, IconUsers, IconKey, IconBuilding, IconId, IconSitemap,
  IconMapPin, IconAdjustments, IconListDetails, IconHistory, IconHandStop, IconStairs, IconDoor, IconArchive, IconBooks,
  IconHeadset, IconTicket, IconMessages, IconFiles, IconTrashX, IconServer2, IconDeviceLaptop, IconTruckDelivery, IconUserShield, IconAlertTriangle, IconClockExclamation, IconFolders, IconDoorEnter, IconClipboardCheck, IconCalendarTime, IconShieldCheck, IconScale, IconCalendarEvent, IconSchool, IconChecklist, IconDatabase, IconReportAnalytics,
};

export const iconFor = (name?: string | null): Icon => (name && MAP[name]) || IconCircle;
