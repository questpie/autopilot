import { useState, useCallback } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AppShell } from "@/components/layouts/app-shell"
import { CommandPalette } from "@/components/command-palette"
import { KeyboardHelpDialog } from "@/components/keyboard-help-dialog"
import { Toaster } from "sonner"
import { requireAuth } from "@/lib/auth-guard"
import { useSSE } from "@/hooks/use-sse"
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useAppStore } from "@/stores/app.store"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    await requireAuth({ location })
  },
  component: AppLayout,
})

function AppLayout() {
  const navigate = useNavigate()
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setRightPanel = useAppStore((s) => s.setRightPanel)
  const rightPanel = useAppStore((s) => s.rightPanel)
  const closeRightPanel = useAppStore((s) => s.closeRightPanel)
  const [helpOpen, setHelpOpen] = useState(false)

  // SSE connection
  useSSE()

  // Global keyboard shortcuts
  useGlobalShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onToggleChat: () => {
      if (rightPanel.open && rightPanel.mode === "chat") {
        closeRightPanel()
      } else {
        setRightPanel({ mode: "chat" })
      }
    },
    onOpenInbox: () => void navigate({ to: "/inbox" }),
    onShowHelp: () => setHelpOpen(true),
    onCreateNew: () => {
      // Context-dependent: navigate to task creation
      void navigate({ to: "/tasks", search: { create: true } as Record<string, unknown> })
    },
    onNavigate: useCallback(
      (path: string) => void navigate({ to: path }),
      [navigate],
    ),
  })

  return (
    <>
      <AppShell />
      <CommandPalette />
      <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            "rounded-none border border-border bg-card text-card-foreground font-heading text-xs",
        }}
      />
    </>
  )
}
