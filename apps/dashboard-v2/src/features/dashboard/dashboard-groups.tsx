import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/feedback/skeleton'
import { DURATION, EASING, clampedDelay, useMotionPreference } from '@/lib/motion'
import { QueryErrorResetBoundary, useSuspenseQuery } from '@tanstack/react-query'
import { m } from 'framer-motion'
import { Suspense } from 'react'
import { ActivitySection } from './activity-section'
import { AgentsSection } from './agents-section'
import { AlertsSection } from './alerts-section'
import { dashboardGroupsQuery } from './dashboard.queries'
import { PinsSection } from './pins-section'
import { WidgetLoader } from './widget-loader'

/** Built-in sections that are always available. */
const BUILT_IN_SECTIONS: Record<string, React.ComponentType> = {
	alerts: AlertsSection,
	agents: AgentsSection,
	pinned: PinsSection,
	activity: ActivitySection,
}

/**
 * Renders dashboard sections in order defined by groups.yaml,
 * mixing built-in sections with custom widget sections.
 */
function StaggerSection({
	children,
	index,
	shouldReduce,
}: {
	children: React.ReactNode
	index: number
	shouldReduce: boolean
}) {
	return (
		<m.div
			initial={shouldReduce ? false : { opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: DURATION.normal,
				ease: EASING.enter,
				delay: shouldReduce ? 0 : clampedDelay(index, 50, 400),
			}}
		>
			{children}
		</m.div>
	)
}

function SectionBoundary({
	children,
	fallback,
}: {
	children: React.ReactNode
	fallback: React.ReactNode
}) {
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<ErrorBoundary onRetry={reset}>
					<Suspense fallback={fallback}>{children}</Suspense>
				</ErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	)
}

export function DashboardGroups() {
	const { data } = useSuspenseQuery(dashboardGroupsQuery)
	const { shouldReduce } = useMotionPreference()
	const groups =
		(data as { groups: Array<{ id: string; title: string; position: number }> })?.groups ?? []

	const sectionFallback = (
		<div className="flex flex-col gap-3">
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-20 w-full" />
		</div>
	)

	// If no groups defined, render default order
	if (groups.length === 0) {
		const defaults = [
			{ id: 'alerts', Section: AlertsSection },
			{ id: 'agents', Section: AgentsSection },
			{ id: 'pinned', Section: PinsSection },
			{ id: 'widgets', Section: WidgetLoader },
			{ id: 'activity', Section: ActivitySection },
		]
		return (
			<div className="flex flex-col gap-8">
				{defaults.map(({ id, Section }, i) => (
					<StaggerSection key={id} index={i} shouldReduce={shouldReduce}>
						<SectionBoundary fallback={sectionFallback}>
							<Section />
						</SectionBoundary>
					</StaggerSection>
				))}
			</div>
		)
	}

	// Sort groups by position
	const sorted = [...groups].sort((a, b) => a.position - b.position)

	return (
		<div className="flex flex-col gap-8">
			{sorted.map((group, i) => {
				const BuiltIn = BUILT_IN_SECTIONS[group.id]
				if (BuiltIn) {
					return (
						<StaggerSection key={group.id} index={i} shouldReduce={shouldReduce}>
							<SectionBoundary fallback={sectionFallback}>
								<BuiltIn />
							</SectionBoundary>
						</StaggerSection>
					)
				}
				return null
			})}
			<StaggerSection index={sorted.length} shouldReduce={shouldReduce}>
				<SectionBoundary fallback={sectionFallback}>
					<WidgetLoader />
				</SectionBoundary>
			</StaggerSection>
		</div>
	)
}
