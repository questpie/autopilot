import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/feedback/skeleton'
import { PageTransition } from '@/components/layouts/page-transition'
import { DashboardGroups } from '@/features/dashboard/dashboard-groups'
import { useTranslation } from '@/lib/i18n'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/_app/')({
	component: DashboardHome,
})

function DashboardGroupsShell() {
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient) {
		return (
			<div className="flex flex-col gap-8">
				<div className="flex flex-col gap-3">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-20 w-full" />
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-4 w-32" />
					<Skeleton className="h-20 w-full" />
				</div>
			</div>
		)
	}

	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<ErrorBoundary onRetry={reset}>
					<DashboardGroups />
				</ErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	)
}

function DashboardHome() {
	const { t } = useTranslation()

	return (
		<PageTransition className="flex flex-1 flex-col gap-8 p-6">
			{/* Header */}
			<div>
				<h1 className="font-heading text-2xl font-semibold">{t('dashboard.title')}</h1>
				<p className="mt-1 text-sm text-muted-foreground">{t('dashboard.welcome')}</p>
			</div>

			{/* Dashboard sections (ordered by groups.yaml or defaults) */}
			<DashboardGroupsShell />
		</PageTransition>
	)
}
