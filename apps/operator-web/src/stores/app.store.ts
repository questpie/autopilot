import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light' | 'system'

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark' as Theme,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'questpie-app-store',
      partialize: (state) => ({
        theme: state.theme,
      }),
    },
  ),
)
