import { AuthBrandPanel } from '@/components/brand'
import { SquareBuildLogo } from '@/components/brand'
import { checkAuth } from '@/lib/auth-check'
import { DURATION, EASING, fadeInUp } from '@/lib/motion'
import { useMotionPreference } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Outlet, createFileRoute, redirect, useMatches } from '@tanstack/react-router'
import { m } from 'framer-motion'

export const Route = createFileRoute('/_auth')({
	beforeLoad: async ({ location }) => {
		const result = await checkAuth()

		// No users → setup
		if (result.noUsersExist && !location.pathname.includes('/setup')) {
			throw redirect({ to: '/setup' })
		}

		if (result.needs2FA && location.pathname !== '/login/2fa') {
			throw redirect({ to: '/login/2fa' })
		}

		if (result.isAuthenticated && !result.needs2FA && result.setupCompleted) {
			throw redirect({ to: '/' })
		}
	},
	component: AuthLayout,
})

function AuthLayout() {
	const matches = useMatches()
	const isSetup = matches.some((m) => m.routeId.includes('setup'))
	const { shouldReduce, variants } = useMotionPreference()

	return (
		<div className="flex min-h-dvh bg-background">
			<AuthBrandPanel />

			{/* Right: Form area — full height flex so children can use justify-between */}
			<div className="flex min-h-dvh flex-1 flex-col items-center overflow-y-auto px-4 py-6 sm:px-6 md:px-12 md:py-8 lg:px-16">
				<m.div
					className={cn('my-auto flex w-full flex-col', isSetup ? 'max-w-160' : 'max-w-105')}
					{...variants(fadeInUp)}
					transition={{
						duration: shouldReduce ? 0 : DURATION.slow,
						ease: EASING.enter,
					}}
				>
					<Outlet />
					<div className="mt-32 flex justify-center sm:mb-8 md:hidden">
						<SquareBuildLogo size={40} />
					</div>
				</m.div>
			</div>
		</div>
	)
}
