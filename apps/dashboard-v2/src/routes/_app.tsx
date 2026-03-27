import { useState, useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AppShell } from "@/components/layouts/app-shell"
import { CommandPalette } from "@/components/command-palette"
import { KeyboardHelpDialog } from "@/components/keyboard-help-dialog"
import { Toaster } from "sonner"
import { requireAuth, checkAuth } from "@/lib/auth-guard"
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

  // Client-side auth check on hydration (SSR skips beforeLoad auth)
  useEffect(() => {
    checkAuth().then(({ isAuthenticated, noUsersExist, needs2FA }) => {
      if (noUsersExist) {
        void navigate({ to: "/setup" })
      } else if (!isAuthenticated) {
        void navigate({ to: "/login" })
      } else if (needs2FA) {
        void navigate({ to: "/login/2fa" })
      }
    })
  }, [navigate])

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
    onNavigate: (path: string) => void navigate({ to: path }),
  })

  return (
    <>
      <AppShell />
      <CommandPalette />
      <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <Toaster
        position="bottom-right"
        dir="ltr"
        gap={8}
        visibleToasts={5}
        toastOptions={{
          className:
            "rounded-none border border-border bg-card text-card-foreground font-heading text-xs",
          duration: 4000,
        }}
      />
    </>
  )
}
