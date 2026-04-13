import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "@/locales/en.json"
import sk from "@/locales/sk.json"

export const SUPPORTED_LOCALES = ['sk', 'en'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value)
}

function hasProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

function detectLocale(): SupportedLocale {
  // Check persisted store
  try {
    const stored = localStorage.getItem('questpie-app-store')
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (hasProperty(parsed, 'state')) {
        const state = parsed.state
        if (hasProperty(state, 'locale')) {
          const locale = state.locale
          if (typeof locale === 'string' && locale !== 'auto' && isSupportedLocale(locale)) {
            return locale
          }
        }
      }
    }
  } catch {
    // ignore parse errors
  }

  // Browser detection
  const browserLang = navigator.language
  if (browserLang.startsWith('sk')) return 'sk'
  return 'en'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sk: { translation: sk },
  },
  lng: detectLocale(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  parseMissingKeyHandler: (key: string) => key,
})

export { i18n }
export { useTranslation } from "react-i18next"

export const t = i18n.t.bind(i18n)

export function changeLanguage(locale: SupportedLocale | 'auto') {
  const resolved = locale === 'auto' ? detectBrowserLocale() : locale
  void i18n.changeLanguage(resolved)
}

function detectBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language
  if (browserLang.startsWith('sk')) return 'sk'
  return 'en'
}
