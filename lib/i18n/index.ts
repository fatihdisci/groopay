import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import tr from '../../locales/tr.json';
import en from '../../locales/en.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
};

const deviceLocale = getLocales()[0]?.languageCode ?? 'tr';
const supportedLanguages = ['tr', 'en'];
const fallbackLanguage = 'tr';
const defaultLanguage = supportedLanguages.includes(deviceLocale)
  ? deviceLocale
  : fallbackLanguage;

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: fallbackLanguage,
  interpolation: {
    escapeValue: false,
  },
  returnObjects: true,
});

export default i18n;
