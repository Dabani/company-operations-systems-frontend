import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fr from './fr';
import rw from './rw';
import sw from './sw';
import b7 from './bundle7';
import p7a from './patch07a';
import b8 from './bundle08';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Ikinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
];

const saved = localStorage.getItem('ops.lang');

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, ...b7.en, ...p7a.en, ...b8.en } }, fr: { translation: { ...fr, ...b7.fr, ...p7a.fr, ...b8.fr } },
    rw: { translation: { ...rw, ...b7.rw, ...p7a.rw, ...b8.rw } }, sw: { translation: { ...sw, ...b7.sw, ...p7a.sw, ...b8.sw } },
  },
  lng: saved && LANGS.some((l) => l.code === saved) ? saved : 'en',
  fallbackLng: 'en',                 // English is the default language
  keySeparator: false,               // flat keys such as "menu.admin.users"
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('ops.lang', lng);
  document.documentElement.lang = lng;
});

export default i18n;
