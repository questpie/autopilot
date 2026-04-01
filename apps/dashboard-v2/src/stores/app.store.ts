import type { SSEStatus } from "@/lib/sse-client"
import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "dark" | "light" | "system"

interface AppState {
  /** Mobile overlay: whether the sidebar sheet is open */
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  /** Desktop: whether the sidebar is collapsed to icon rail */
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void

  theme: Theme
  setTheme: (theme: Theme) => void

  sseStatus: SSEStatus
  sseRetryCount: number
  setSSEStatus: (status: SSEStatus, retryCount?: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      theme: "dark" as Theme,
      setTheme: (theme) => set({ theme }),

      sseStatus: "offline" as SSEStatus,
      sseRetryCount: 0,
      setSSEStatus: (status, retryCount) =>
        set({ sseStatus: status, sseRetryCount: retryCount ?? 0 }),
    }),
    {
      name: "questpie-app-store",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
