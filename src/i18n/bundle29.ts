// COPS Bundle 29: menu labels for every menu entry seeded by bundles 17 to 28, repeated here so a menu never shows a raw key. Same wording as the feature bundles; rw/sw pending native review.
type D = Record<string, string>;

const en: D = {
  'menu.meetings': 'Meetings',
  'menu.meetings.list': 'Meetings',
  'menu.meetings.rooms': 'Meeting rooms',
  'menu.meetings.minutes': 'Minutes',
  'menu.meetings.followups': 'Follow-up',
  'menu.meetings.events': 'Events',
  'menu.procurement': 'Procurement',
  'menu.procurement.requisitions': 'Purchase requisitions',
  'menu.procurement.suppliers': 'Suppliers',
  'menu.procurement.orders': 'Purchase orders',
  'menu.procurement.invoices': 'Supplier invoices',
  'menu.procurement.rfqs': 'Quotations',
};

const fr: D = {
  'menu.meetings': 'Réunions',
  'menu.meetings.list': 'Réunions',
  'menu.meetings.rooms': 'Salles de réunion',
  'menu.meetings.minutes': 'Procès-verbaux',
  'menu.meetings.followups': 'Suivi',
  'menu.meetings.events': 'Événements',
  'menu.procurement': 'Achats',
  'menu.procurement.requisitions': 'Demandes d\'achat',
  'menu.procurement.suppliers': 'Fournisseurs',
  'menu.procurement.orders': 'Bons de commande',
  'menu.procurement.invoices': 'Factures fournisseurs',
  'menu.procurement.rfqs': 'Devis',
};

const rw: D = {
  'menu.meetings': 'Inama',
  'menu.meetings.list': 'Inama',
  'menu.meetings.rooms': 'Ibyumba by\'inama',
  'menu.meetings.minutes': 'Raporo z\'inama',
  'menu.meetings.followups': 'Gukurikirana',
  'menu.meetings.events': 'Ibikorwa',
  'menu.procurement': 'Gura',
  'menu.procurement.requisitions': 'Ibyifuzo byo kugura',
  'menu.procurement.suppliers': 'Abatanga serivisi',
  'menu.procurement.orders': 'Amateka y\'ubugure',
  'menu.procurement.invoices': 'Fagitire z\'abatanga serivisi',
  'menu.procurement.rfqs': 'Ibiciro byatanzwe',
};

const sw: D = {
  'menu.meetings': 'Mikutano',
  'menu.meetings.list': 'Mikutano',
  'menu.meetings.rooms': 'Vyumba vya mikutano',
  'menu.meetings.minutes': 'Muhtasari wa mikutano',
  'menu.meetings.followups': 'Ufuatiliaji',
  'menu.meetings.events': 'Matukio',
  'menu.procurement': 'Manunuzi',
  'menu.procurement.requisitions': 'Maombi ya ununuzi',
  'menu.procurement.suppliers': 'Wauzaji',
  'menu.procurement.orders': 'Maagizo ya ununuzi',
  'menu.procurement.invoices': 'Ankara za wauzaji',
  'menu.procurement.rfqs': 'Nukuu',
};

export default { en, fr, rw, sw };
