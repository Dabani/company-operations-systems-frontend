import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import fr from './fr';
import rw from './rw';
import sw from './sw';

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'rw', label: 'Ikinyarwanda' },
  { code: 'sw', label: 'Kiswahili' },
];

const saved = localStorage.getItem('ops.lang');

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr }, rw: { translation: rw }, sw: { translation: sw } },
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
