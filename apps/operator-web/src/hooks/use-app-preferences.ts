import { useEffect, useRef } from 'react'
import { changeLanguage } from '@/lib/i18n'
import { APP_PREFERENCE_KEYS, isAppLocale, isAppTheme, isBooleanPreference } from '@/lib/app-preferences'
import { useAppStore } from '@/stores/app.store'
import { useSession } from './use-session'
import { useSetUserPreference, useUserPreferences } from './use-preferences'

export function useAppPreferences() {
  const theme = useAppStore((s) => s.theme)
  const locale = useAppStore((s) => s.locale)
  const developerMode = useAppStore((s) => s.developerMode)
  const setThemeLocal = useAppStore((s) => s.setTheme)
  const setLocaleLocal = useAppStore((s) => s.setLocale)
  const setDeveloperModeLocal = useAppStore((s) => s.setDeveloperMode)
  const setPreference = useSetUserPreference()

  function persist(key: string, value: unknown) {
    setPreference.mutate({ key, value })
  }

  function setTheme(themeValue: typeof theme) {
    setThemeLocal(themeValue)
    persist(APP_PREFERENCE_KEYS.theme, themeValue)
  }

  function setLocale(localeValue: typeof locale) {
    setLocaleLocal(localeValue)
    changeLanguage(localeValue)
    persist(APP_PREFERENCE_KEYS.locale, localeValue)
  }

  function setDeveloperMode(enabled: boolean) {
    setDeveloperModeLocal(enabled)
    persist(APP_PREFERENCE_KEYS.developerMode, enabled)
  }

  return {
    theme,
    setTheme,
    locale,
    setLocale,
    developerMode,
    setDeveloperMode,
  }
}

export function useHydrateAppPreferences() {
  const { isAuthenticated, isPending } = useSession()
  const preferencesQuery = useUserPreferences(isAuthenticated && !isPending)
  const setPreference = useSetUserPreference()
  const seededKeysRef = useRef(new Set<string>())

  useEffect(() => {
    if (!isAuthenticated || !preferencesQuery.data) return

    const byKey = new Map(preferencesQuery.data.map((item) => [item.key, item.value]))
    const nextState: Partial<Pick<ReturnType<typeof useAppStore.getState>, 'theme' | 'locale' | 'developerMode'>> = {}

    const themeValue = byKey.get(APP_PREFERENCE_KEYS.theme)
    if (isAppTheme(themeValue)) nextState.theme = themeValue

    const localeValue = byKey.get(APP_PREFERENCE_KEYS.locale)
    if (isAppLocale(localeValue)) nextState.locale = localeValue

    const developerModeValue = byKey.get(APP_PREFERENCE_KEYS.developerMode)
    if (isBooleanPreference(developerModeValue)) nextState.developerMode = developerModeValue

    useAppStore.getState().hydratePreferences(nextState)
    if (nextState.locale) changeLanguage(nextState.locale)

    const currentState = useAppStore.getState()
    const seeds: Array<[string, unknown]> = [
      [APP_PREFERENCE_KEYS.theme, currentState.theme],
      [APP_PREFERENCE_KEYS.locale, currentState.locale],
      [APP_PREFERENCE_KEYS.developerMode, currentState.developerMode],
    ]

    for (const [key, value] of seeds) {
      if (byKey.has(key) || seededKeysRef.current.has(key)) continue
      seededKeysRef.current.add(key)
      setPreference.mutate({ key, value })
    }
  }, [isAuthenticated, preferencesQuery.data, setPreference])

  return preferencesQuery
}
