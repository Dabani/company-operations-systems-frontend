// Bundle 7 UI strings (reports, update prompt, route errors). Merged over en/fr/rw/sw in i18n/index.ts.
// rw/sw are first-pass translations pending native review. Report CONTENT (titles, KPIs, columns) is localised by the API.
type D = Record<string, string>;

const en: D = {
  'menu.reports': 'Reports',
  'reports.title': 'Reports', 'reports.subtitle': 'Charts and figures across modules. What you see depends on your permissions.',
  'reports.empty': 'No reports are available for your role.', 'reports.snapshot': 'As of now', 'reports.all': 'All reports',
  'reports.p30': 'Last 30 days', 'reports.p90': 'Last 90 days', 'reports.p180': 'Last 6 months', 'reports.p365': 'Last 12 months', 'reports.custom': 'Custom',
  'reports.from': 'From', 'reports.to': 'To', 'reports.period': 'Period', 'reports.csv': 'CSV', 'reports.xlsx': 'Excel',
  'reports.how': 'How is this calculated?', 'reports.formula': 'Formula', 'reports.inclusion': 'Included / excluded', 'reports.date_basis': 'Date basis',
  'reports.sources': 'Source tables', 'reports.timezone': 'Timezone', 'reports.generated': 'Generated', 'reports.no_chart': 'No data for this period.',
  'reports.no_rows': 'No rows.', 'reports.export_failed': 'The export could not be created.', 'reports.table': 'Detail',
  'pwa.update_available': 'A new version is available.', 'pwa.update_now': 'Update now', 'pwa.later': 'Later',
  'pwa.back_online': 'You are back online.', 'pwa.action_offline': 'You are offline - this action was not sent. Try again when you are connected.',
  'route.error_title': 'This page could not be loaded', 'route.error_text': 'Check your connection and try again. If the problem continues, reload the app.',
  'route.retry': 'Try again', 'route.reload': 'Reload the app',
};

const fr: D = {
  'menu.reports': 'Rapports',
  'reports.title': 'Rapports', 'reports.subtitle': 'Graphiques et chiffres par module. Ce que vous voyez dépend de vos autorisations.',
  'reports.empty': 'Aucun rapport n\'est disponible pour votre rôle.', 'reports.snapshot': 'À ce jour', 'reports.all': 'Tous les rapports',
  'reports.p30': '30 derniers jours', 'reports.p90': '90 derniers jours', 'reports.p180': '6 derniers mois', 'reports.p365': '12 derniers mois', 'reports.custom': 'Personnalisé',
  'reports.from': 'Du', 'reports.to': 'Au', 'reports.period': 'Période', 'reports.csv': 'CSV', 'reports.xlsx': 'Excel',
  'reports.how': 'Comment est-ce calculé ?', 'reports.formula': 'Formule', 'reports.inclusion': 'Inclus / exclus', 'reports.date_basis': 'Base de date',
  'reports.sources': 'Tables sources', 'reports.timezone': 'Fuseau horaire', 'reports.generated': 'Généré', 'reports.no_chart': 'Aucune donnée pour cette période.',
  'reports.no_rows': 'Aucune ligne.', 'reports.export_failed': 'L\'export n\'a pas pu être créé.', 'reports.table': 'Détail',
  'pwa.update_available': 'Une nouvelle version est disponible.', 'pwa.update_now': 'Mettre à jour', 'pwa.later': 'Plus tard',
  'pwa.back_online': 'Vous êtes de nouveau en ligne.', 'pwa.action_offline': 'Vous êtes hors ligne : cette action n\'a pas été envoyée. Réessayez une fois connecté.',
  'route.error_title': 'Cette page n\'a pas pu être chargée', 'route.error_text': 'Vérifiez votre connexion et réessayez. Si le problème persiste, rechargez l\'application.',
  'route.retry': 'Réessayer', 'route.reload': 'Recharger l\'application',
};

const rw: D = {
  'menu.reports': 'Raporo',
  'reports.title': 'Raporo', 'reports.subtitle': 'Ibishushanyo n\'imibare ya buri gice. Ibyo ubona biterwa n\'uburenganzira ufite.',
  'reports.empty': 'Nta raporo zihari ku nshingano yawe.', 'reports.snapshot': 'Kugeza ubu', 'reports.all': 'Raporo zose',
  'reports.p30': 'Iminsi 30 ishize', 'reports.p90': 'Iminsi 90 ishize', 'reports.p180': 'Amezi 6 ashize', 'reports.p365': 'Amezi 12 ashize', 'reports.custom': 'Wihitiyemo',
  'reports.from': 'Kuva', 'reports.to': 'Kugeza', 'reports.period': 'Igihe', 'reports.csv': 'CSV', 'reports.xlsx': 'Excel',
  'reports.how': 'Bibarwa gute?', 'reports.formula': 'Uburyo bwo kubara', 'reports.inclusion': 'Ibibarwa / ibitabarwa', 'reports.date_basis': 'Itariki yifashishwa',
  'reports.sources': 'Imbonerahamwe zifashishwa', 'reports.timezone': 'Isaha y\'akarere', 'reports.generated': 'Yakozwe', 'reports.no_chart': 'Nta makuru kuri iki gihe.',
  'reports.no_rows': 'Nta murongo.', 'reports.export_failed': 'Ntibyashobotse kohereza raporo.', 'reports.table': 'Ibisobanuro',
  'pwa.update_available': 'Hari verisiyo nshya.', 'pwa.update_now': 'Vugurura ubu', 'pwa.later': 'Nyuma',
  'pwa.back_online': 'Wongeye kubona murandasi.', 'pwa.action_offline': 'Nta murandasi - igikorwa ntikoherejwe. Ongera ugerageze umaze guhuza.',
  'route.error_title': 'Iyi paji ntiyashoboye gufungurwa', 'route.error_text': 'Genzura murandasi wongere ugerageze. Ikibazo nigikomeza, ongera ufungure porogaramu.',
  'route.retry': 'Ongera ugerageze', 'route.reload': 'Ongera ufungure porogaramu',
};

const sw: D = {
  'menu.reports': 'Ripoti',
  'reports.title': 'Ripoti', 'reports.subtitle': 'Michoro na takwimu za moduli zote. Unachoona kinategemea ruhusa zako.',
  'reports.empty': 'Hakuna ripoti kwa jukumu lako.', 'reports.snapshot': 'Hadi sasa', 'reports.all': 'Ripoti zote',
  'reports.p30': 'Siku 30 zilizopita', 'reports.p90': 'Siku 90 zilizopita', 'reports.p180': 'Miezi 6 iliyopita', 'reports.p365': 'Miezi 12 iliyopita', 'reports.custom': 'Chagua mwenyewe',
  'reports.from': 'Kuanzia', 'reports.to': 'Hadi', 'reports.period': 'Kipindi', 'reports.csv': 'CSV', 'reports.xlsx': 'Excel',
  'reports.how': 'Inakokotolewaje?', 'reports.formula': 'Fomula', 'reports.inclusion': 'Vilivyojumuishwa / visivyojumuishwa', 'reports.date_basis': 'Msingi wa tarehe',
  'reports.sources': 'Jedwali chanzo', 'reports.timezone': 'Saa za eneo', 'reports.generated': 'Imetengenezwa', 'reports.no_chart': 'Hakuna data kwa kipindi hiki.',
  'reports.no_rows': 'Hakuna safu.', 'reports.export_failed': 'Usafirishaji haukuweza kufanyika.', 'reports.table': 'Maelezo',
  'pwa.update_available': 'Toleo jipya linapatikana.', 'pwa.update_now': 'Sasisha sasa', 'pwa.later': 'Baadaye',
  'pwa.back_online': 'Umerudi mtandaoni.', 'pwa.action_offline': 'Hauko mtandaoni - kitendo hakikutumwa. Jaribu tena ukiunganishwa.',
  'route.error_title': 'Ukurasa huu haukuweza kupakiwa', 'route.error_text': 'Angalia muunganisho wako na ujaribu tena. Tatizo likiendelea, pakia upya programu.',
  'route.retry': 'Jaribu tena', 'route.reload': 'Pakia upya programu',
};

export default { en, fr, rw, sw } as Record<string, D>;
