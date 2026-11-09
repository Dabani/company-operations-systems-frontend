// COPS Bundle 13 UI strings. rw/sw are first-pass translations pending native review.
type D = Record<string, string>;

const en: D = {
  'flows.new_version': 'New version',
  'lookups.iso_note': 'ISO 4217 code, 3 capital letters (e.g. JPY). Other lists get their key automatically.',
};

const fr: D = {
  'flows.new_version': 'Nouvelle version',
  'lookups.iso_note': 'Code ISO 4217, 3 lettres majuscules (ex. JPY). Les autres listes reçoivent leur clé automatiquement.',
};

const rw: D = {
  'flows.new_version': 'Verisiyo nshya',
  'lookups.iso_note': 'Kode ya ISO 4217, inyuguti 3 nkuru (urugero JPY). Izindi lisiti zibona urufunguzo ku buryo bwikora.',
};

const sw: D = {
  'flows.new_version': 'Toleo jipya',
  'lookups.iso_note': 'Msimbo wa ISO 4217, herufi 3 kubwa (mfano JPY). Orodha nyingine hupata ufunguo kiotomatiki.',
};

export default { en, fr, rw, sw };
