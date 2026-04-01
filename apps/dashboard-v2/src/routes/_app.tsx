import { QUESTPIESpinner } from '@/components/brand'
import { PageError } from '@/components/feedback'
import { AppShell } from '@/components/layouts/app-shell'
import { checkAuthServer } from '@/lib/auth.fn'
import { createFileRoute, redirect } from '@tanstack/react-router'
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
	return (
		<>
			<AppShell />
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
