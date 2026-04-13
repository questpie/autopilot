import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SupportedLocale } from '@/lib/i18n'

type Theme = 'dark' | 'light' | 'system'
type Locale = SupportedLocale | 'auto'

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
  locale: Locale
  setLocale: (locale: Locale) => void
  developerMode: boolean
  setDeveloperMode: (enabled: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark' satisfies Theme,
      setTheme: (theme) => set({ theme }),
      locale: 'auto' satisfies Locale,
      setLocale: (locale) => set({ locale }),
      developerMode: false,
      setDeveloperMode: (developerMode) => set({ developerMode }),
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
