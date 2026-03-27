import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "@/locales/en.json"

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
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
