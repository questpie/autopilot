import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { AppShell } from "@/components/layouts/app-shell"
import { CommandPalette } from "@/components/command-palette"
import { KeyboardHelpDialog } from "@/components/keyboard-help-dialog"
import { Toaster } from "sonner"
import { checkAuthServer } from "@/lib/auth.fn"
import { QuestPieSpinner } from "@/components/brand"
import { PageError } from "@/components/feedback"
import { useSSE } from "@/hooks/use-sse"
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { useAppStore } from "@/stores/app.store"
import { statusQuery } from "@/features/dashboard/dashboard.queries"
import { agentsQuery } from "@/features/team/team.queries"

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const result = await checkAuthServer()

    // No users → setup wizard
    if (result.noUsersExist) {
      throw redirect({ to: "/setup" })
    }

    // Not authenticated → login
    if (!result.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }

    // Needs 2FA
    if (result.needs2FA) {
      throw redirect({ to: "/login/2fa" })
    }

    // Setup not completed → finish setup
    if (!result.setupCompleted) {
      throw redirect({ to: "/setup" })
    }

    // Pass user to context for child routes
    return { user: result.user }
  },
  loader: async ({ context }) => {
    // Pre-fetch commonly needed data so useSuspenseQuery calls don't suspend
    void Promise.all([
      context.queryClient.ensureQueryData(statusQuery),
      context.queryClient.ensureQueryData(agentsQuery),
    ])
  },
  pendingComponent: AuthPending,
  errorComponent: ({ error, reset }) => (
    <PageError description={error.message} onRetry={reset} />
  ),
  component: AppLayout,
})

function AuthPending() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <QuestPieSpinner size={32} />
    </div>
  )
}

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
      void navigate({ to: "/tasks", search: { create: true } })
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
