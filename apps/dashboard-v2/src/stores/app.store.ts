import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SSEStatus } from "@/lib/sse-client"

type Theme = "dark" | "light" | "system"

interface RightPanelState {
  open: boolean
  mode: "chat" | "details" | null
  channel: string | null
}

interface AppState {
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Right panel
  rightPanel: RightPanelState
  setRightPanel: (panel: Partial<RightPanelState>) => void
  closeRightPanel: () => void

  // Command palette
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // Theme (persisted)
  theme: Theme
  setTheme: (theme: Theme) => void

  // SSE connection status
  sseStatus: SSEStatus
  sseRetryCount: number
  setSSEStatus: (status: SSEStatus, retryCount?: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Right panel
      rightPanel: { open: false, mode: null, channel: null },
      setRightPanel: (panel) =>
        set((state) => ({
          rightPanel: { ...state.rightPanel, ...panel, open: true },
        })),
      closeRightPanel: () =>
        set({ rightPanel: { open: false, mode: null, channel: null } }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // Theme
      theme: "dark" as Theme,
      setTheme: (theme) => set({ theme }),

      // SSE
      sseStatus: "offline" as SSEStatus,
      sseRetryCount: 0,
      setSSEStatus: (status, retryCount) =>
        set({ sseStatus: status, sseRetryCount: retryCount ?? 0 }),
    }),
    {
      name: "questpie-app-store",
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
)
