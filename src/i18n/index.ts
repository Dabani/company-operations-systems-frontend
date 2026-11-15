import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { bundleOrder } from './slice';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Ikinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
];

type Dict = Record<string, string>;

/**
 * Each language is its own chunk, fetched only when it is needed (English is always loaded: it is the fallback).
 * The per-language slice of every bundle*.ts / patch*.ts file is produced by the Vite plugin in vite.config.ts,
 * so adding a new bundle file needs no change here.
 */
const base: Record<string, () => Promise<{ default: Dict }>> = {
  en: () => import('./en'), fr: () => import('./fr'), rw: () => import('./rw'), sw: () => import('./sw'),
};
const slices: Record<string, Record<string, () => Promise<unknown>>> = {
  en: import.meta.glob('./{bundle,patch}[0-9]*.ts', { query: { lang: 'en' }, import: 'default' }),
  fr: import.meta.glob('./{bundle,patch}[0-9]*.ts', { query: { lang: 'fr' }, import: 'default' }),
  rw: import.meta.glob('./{bundle,patch}[0-9]*.ts', { query: { lang: 'rw' }, import: 'default' }),
  sw: import.meta.glob('./{bundle,patch}[0-9]*.ts', { query: { lang: 'sw' }, import: 'default' }),
};

const loading = new Map<string, Promise<void>>();

export function loadLanguage(code: string): Promise<void> {
  const lang = LANGS.some((l) => l.code === code.slice(0, 2)) ? code.slice(0, 2) : 'en';
  let p = loading.get(lang);
  if (!p) {
    p = (async () => {
      const parts = bundleOrder(Object.keys(slices[lang]));
      const [main, ...rest] = await Promise.all([base[lang](), ...parts.map((k) => slices[lang][k]())]);
      const merged: Dict = Object.assign({}, main.default, ...(rest as Dict[]));
      i18n.addResourceBundle(lang, 'translation', merged, true, true);
    })();
    p.catch(() => loading.delete(lang));            // a failed download can be retried
    loading.set(lang, p);
  }
  return p;
}

const saved = localStorage.getItem('ops.lang');
const initial = saved && LANGS.some((l) => l.code === saved) ? saved : 'en';

const initialised = i18n.use(initReactI18next).init({
  resources: {},
  lng: initial,
  fallbackLng: 'en',                 // English is the default language
  keySeparator: false,               // flat keys such as "menu.admin.users"
  interpolation: { escapeValue: false },
});

// Switching language (menu, profile, portal) first makes sure that language's texts are downloaded.
const change = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (async (lng?: string, callback?: Parameters<typeof change>[1]) => {
  if (lng) await loadLanguage(lng).catch(() => undefined);
  return change(lng, callback);
}) as typeof i18n.changeLanguage;

/** Resolves when the active language and the English fallback are ready: the app renders after this. */
export const i18nReady: Promise<void> = initialised.then(() => Promise.all([loadLanguage('en'), loadLanguage(initial)])).then(() => undefined).catch(() => undefined);

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('ops.lang', lng);
  document.documentElement.lang = lng;
});

export default i18n;
