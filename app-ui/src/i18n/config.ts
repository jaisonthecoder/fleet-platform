import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ar from './locales/ar.json'

export const supportedLanguages = ['en', 'ar'] as const
export type AppLanguage = (typeof supportedLanguages)[number]

/** Default locale used for redirects and fallbacks. */
export const defaultLanguage: AppLanguage = 'en'

/** Right-to-left languages; drives the document `dir` attribute. */
export const rtlLanguages: readonly AppLanguage[] = ['ar']

export const defaultNamespace = 'translation'

/** Returns the document direction for a given language. */
export function directionFor(language: string): 'rtl' | 'ltr' {
  return (rtlLanguages as readonly string[]).includes(
    language.split('-')[0] ?? '',
  )
    ? 'rtl'
    : 'ltr'
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    defaultNS: defaultNamespace,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

export default i18n
