import { create } from "zustand"
import { persist } from "zustand/middleware"

interface QuickAccessState {
  paths: string[]
  addPath: (path: string) => void
  removePath: (path: string) => void
  isQuickAccess: (path: string) => boolean
  toggle: (path: string) => void
}

export const useQuickAccessStore = create<QuickAccessState>()(
  persist(
    (set, get) => ({
      paths: [],
      addPath: (path) =>
        set((state) => {
          if (state.paths.includes(path)) return state
          return { paths: [...state.paths, path] }
        }),
      removePath: (path) =>
        set((state) => ({
          paths: state.paths.filter((p) => p !== path),
        })),
      isQuickAccess: (path) => get().paths.includes(path),
      toggle: (path) => {
        const state = get()
        if (state.paths.includes(path)) {
          state.removePath(path)
        } else {
          state.addPath(path)
        }
      },
    }),
    {
      name: "questpie-quick-access",
      partialize: (state) => ({
        paths: state.paths,
      }),
    },
  ),
)
