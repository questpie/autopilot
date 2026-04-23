import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppLocale, AppTheme } from '@/lib/app-preferences'

interface AppState {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  developerMode: boolean
  setDeveloperMode: (enabled: boolean) => void
  hydratePreferences: (input: Partial<Pick<AppState, 'theme' | 'locale' | 'developerMode'>>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark' satisfies AppTheme,
      setTheme: (theme) => set({ theme }),
      locale: 'auto' satisfies AppLocale,
      setLocale: (locale) => set({ locale }),
      developerMode: false,
      setDeveloperMode: (developerMode) => set({ developerMode }),
      hydratePreferences: (input) => set(input),
    }),
    {
      name: 'questpie-app-store',
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        developerMode: state.developerMode,
      }),
    },
  ),
)

export type { AppTheme, AppLocale }
