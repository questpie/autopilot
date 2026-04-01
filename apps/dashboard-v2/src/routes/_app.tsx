import { QUESTPIESpinner } from '@/components/brand'
import { CommandPalette } from '@/components/command-palette'
import { PageError } from '@/components/feedback'
import { KeyboardHelpDialog } from '@/components/keyboard-help-dialog'
import { AppShell } from '@/components/layouts/app-shell'
import { statusQuery } from '@/features/dashboard/dashboard.queries'
import { useGlobalShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useSSE } from '@/hooks/use-sse'
import { checkAuthServer } from '@/lib/auth.fn'
import { useAppStore } from '@/stores/app.store'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Toaster } from 'sonner'

export const Route = createFileRoute('/_app')({
	beforeLoad: async ({ location }) => {
		const result = await checkAuthServer()

		// No users → setup wizard
		if (result.noUsersExist) {
			throw redirect({ to: '/setup' })
		}

		// Needs 2FA
		if (result.needs2FA) {
			throw redirect({ to: '/login/2fa' })
		}

		// Not authenticated → login
		if (!result.isAuthenticated) {
			throw redirect({ to: '/login', search: { redirect: location.href } })
		}

		// Setup not completed → finish setup
		if (!result.setupCompleted) {
			throw redirect({ to: '/setup' })
		}

		// Pass user to context for child routes
		return { user: result.user }
	},
	loader: async ({ context }) => {
		// Pre-fetch commonly needed data so useSuspenseQuery calls don't suspend
		void context.queryClient.ensureQueryData(statusQuery)
	},
	pendingComponent: AuthPending,
	errorComponent: ({ error, reset }) => <PageError description={error.message} onRetry={reset} />,
	component: AppLayout,
})

function AuthPending() {
	return (
		<div className="flex h-screen w-screen items-center justify-center bg-background">
			<QUESTPIESpinner size={32} />
		</div>
	)
}

function AppLayout() {
	const navigate = useNavigate()
	const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
	const [helpOpen, setHelpOpen] = useState(false)

	// SSE connection
	useSSE()

	// Global keyboard shortcuts
	useGlobalShortcuts({
		onCommandPalette: () => setCommandPaletteOpen(true),
		onShowHelp: () => setHelpOpen(true),
		onCreateNew: () => {
			// Context-dependent: navigate to task creation
			void navigate({ to: '/tasks', search: { create: true } })
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
						'rounded-none border border-border bg-card text-card-foreground font-heading text-xs',
					duration: 4000,
				}}
			/>
		</>
	)
}
