import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "@/locales/en.json"

/**
 * i18n setup using i18next with React bindings.
 * - English as default fallback
 * - Supports pluralization via ICU-style _one/_other suffixes
 * - Variable interpolation: {{variable}}
 * - Missing keys fall back to English, then to the key itself
 */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React handles XSS
  },
  returnNull: false,
  parseMissingKeyHandler: (key: string) => key,
})

export { i18n }
export { useTranslation } from "react-i18next"

/**
 * Direct t() function for use outside React components.
 */
export const t = i18n.t.bind(i18n)
