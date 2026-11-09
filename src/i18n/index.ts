import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fr from './fr';
import rw from './rw';
import sw from './sw';
import b7 from './bundle7';
import p7a from './patch07a';
import b8 from './bundle08';
import b9 from './bundle09';
import b10 from './bundle10';
import b11 from './bundle11';
import b12 from './bundle12';
import b12b from './bundle12b';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Ikinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
];

const saved = localStorage.getItem('ops.lang');

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, ...b7.en, ...p7a.en, ...b8.en, ...b9.en, ...b10.en, ...b11.en, ...b12.en, ...b12b.en } }, fr: { translation: { ...fr, ...b7.fr, ...p7a.fr, ...b8.fr, ...b9.fr, ...b10.fr, ...b11.fr, ...b12.fr, ...b12b.fr } },
    rw: { translation: { ...rw, ...b7.rw, ...p7a.rw, ...b8.rw, ...b9.rw, ...b10.rw, ...b11.rw, ...b12.rw, ...b12b.rw } }, sw: { translation: { ...sw, ...b7.sw, ...p7a.sw, ...b8.sw, ...b9.sw, ...b10.sw, ...b11.sw, ...b12.sw, ...b12b.sw } },
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
