import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from './en-US.json';
import spanish from './es-ES.json';

void i18n.use(initReactI18next).init({
  resources: { 'en-US': { translation: english }, 'es-ES': { translation: spanish } },
  lng: navigator.language.startsWith('es') ? 'es-ES' : 'en-US',
  fallbackLng: false,
  supportedLngs: ['en-US', 'es-ES'],
  interpolation: { escapeValue: false },
});
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});
document.documentElement.lang = i18n.language;

export default i18n;
