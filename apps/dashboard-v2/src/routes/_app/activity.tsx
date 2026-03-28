import { EmptyState } from '@/components/feedback/empty-state'
import { PageTransition } from '@/components/layouts/page-transition'
import { Button } from '@/components/ui/button'
import { ActivityItemRow } from '@/features/activity/activity-item'
import { activityQuery } from '@/features/activity/activity.queries'
import { ActivitySkeleton } from '@/features/dashboard/dashboard-skeleton'
import { agentsQuery } from '@/features/team/team.queries'
import { useTranslation } from '@/lib/i18n'
import { FunnelIcon, LightningIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useCallback, useState } from 'react'

export const Route = createFileRoute('/_app/activity')({
	component: ActivityPage,
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(activityQuery({ limit: 50 })),
			context.queryClient.ensureQueryData(agentsQuery),
		])
	},
})

const ACTION_TYPES = [
	'all',
	'write_file',
	'run_terminal',
	'message',
	'pin',
	'task',
	'http',
	'search_web',
	'browse',
	'deploy',
	'read_file',
	'search',
	'execute',
	'approve',
	'reject',
] as const

function ActivityPage() {
	const { t } = useTranslation()
	const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined)
	const [actionFilter, setActionFilter] = useState<string>('all')
	const [limit, setLimit] = useState(50)

	const { data: activityData, isLoading: activityLoading } = useQuery(
		activityQuery({ agent: agentFilter, limit }),
	)
	const { data: agents } = useQuery(agentsQuery)

	const loadMore = useCallback(() => {
		setLimit((prev) => prev + 50)
	}, [])

	if (activityLoading) {
		return (
			<div className="p-6">
				<ActivitySkeleton />
			</div>
		)
	}

	const entries = (activityData ?? []) as Array<{
		at: string
		agent: string
		type: string
		summary: string
		details?: Record<string, unknown>
	}>

	// Client-side action type filter
	const filteredEntries =
		actionFilter === 'all' ? entries : entries.filter((e) => e.type === actionFilter)

	return (
		<PageTransition className="flex flex-1 flex-col gap-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="font-heading text-2xl font-semibold">{t('nav.activity')}</h1>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex items-center gap-1.5">
					<FunnelIcon size={14} className="text-muted-foreground" />
					<span className="font-heading text-xs text-muted-foreground">
						{t('activity.filter_agent')}:
					</span>
					<Button
						variant={agentFilter === undefined ? 'default' : 'ghost'}
						size="sm"
						onClick={() => setAgentFilter(undefined)}
						className="h-7 px-2 text-xs"
					>
						{t('inbox.filter_all')}
					</Button>
					{(agents ?? []).map((agent) => (
						<Button
							key={agent.id}
							variant={agentFilter === agent.id ? 'default' : 'ghost'}
							size="sm"
							onClick={() => setAgentFilter(agent.id)}
							className="h-7 px-2 text-xs"
						>
							{agent.name}
						</Button>
					))}
				</div>

				<div className="flex items-center gap-1.5">
					<span className="font-heading text-xs text-muted-foreground">
						{t('activity.filter_action')}:
					</span>
					<select
						value={actionFilter}
						onChange={(e) => setActionFilter(e.target.value)}
						className="h-7 rounded-none border border-border bg-background px-2 font-heading text-xs text-foreground"
					>
						{ACTION_TYPES.map((type) => (
							<option key={type} value={type}>
								{type === 'all' ? t('inbox.filter_all') : type.replace(/_/g, ' ')}
							</option>
						))}
					</select>
				</div>
			</div>

			{/* Activity list */}
			{filteredEntries.length === 0 ? (
				<EmptyState
					icon={<LightningIcon size={32} />}
					message={t('dashboard.no_activity')}
					description={t('dashboard.no_activity_description')}
				/>
			) : (
				<>
					<div className="border border-border">
						<AnimatePresence mode="popLayout">
							{filteredEntries.map((entry) => (
								<ActivityItemRow key={`${entry.at}-${entry.agent}-${entry.type}`} entry={entry} showDate />
							))}
						</AnimatePresence>
					</div>

					{/* Load more */}
					{entries.length >= limit && (
						<div className="flex justify-center">
							<Button
								variant="outline"
								size="sm"
								onClick={loadMore}
								className="font-heading text-xs"
							>
								{t('activity.load_more')}
							</Button>
						</div>
					)}
				</>
			)}
		</PageTransition>
	)
}
