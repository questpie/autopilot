import type { SupportedLocale } from '@/lib/i18n'

export type AppTheme = 'dark' | 'light' | 'system'
export type AppLocale = SupportedLocale | 'auto'

export const APP_PREFERENCE_KEYS = {
  theme: 'ui.theme',
  locale: 'ui.locale',
  developerMode: 'ui.developerMode',
} as const

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light' || value === 'system'
}

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'auto' || value === 'en' || value === 'sk'
}

export function isBooleanPreference(value: unknown): value is boolean {
  return typeof value === 'boolean'
}
