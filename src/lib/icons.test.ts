import { describe, expect, it } from 'vitest';
import { iconFor } from './icons';

// Every icon name seeded into menu_items by bundles 17 to 28 must resolve to a real icon, not the fallback circle.
const SEEDED = ['IconCalendarEvent', 'IconDoor', 'IconChecklist', 'IconConfetti', 'IconShoppingCart', 'IconClipboardList', 'IconBuildingStore', 'IconTruckDelivery', 'IconFileInvoice', 'IconScale'];

describe('menu icons', () => {
  const fallback = iconFor('IconDoesNotExist');
  it.each(SEEDED)('%s is mapped', (name) => { expect(iconFor(name)).not.toBe(fallback); });
});
