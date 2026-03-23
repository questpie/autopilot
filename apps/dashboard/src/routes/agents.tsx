import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { TopBar } from '@/components/layout/top-bar'
import { AgentCard } from '@/components/data/agent-card'
import { AgentDetailPanel } from '@/components/data/agent-detail-panel'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgents } from '@/hooks/use-agents'
import { useActivity } from '@/hooks/use-activity'

export const Route = createFileRoute('/agents')({
	component: AgentsPage,
	validateSearch: (search: Record<string, unknown>) => ({
		agent: (search.agent as string) ?? undefined,
	}),
})

function AgentsPage() {
	const { agent: agentId } = useSearch({ from: '/agents' })
	const navigate = useNavigate()
	const { data: agents, isLoading, isError } = useAgents()
	const { data: activity } = useActivity()

	const selectedAgent = agentId ? agents?.find((a) => a.id === agentId) : undefined

	return (
		<ErrorBoundary>
			<TopBar title="Agents" />
			<div className="flex-1 overflow-y-auto p-6">
				{isLoading ? (
					<div className="grid grid-cols-3 gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-36" />
						))}
					</div>
				) : isError ? (
					<EmptyState
						icon={'\u26A0'}
						title="Cannot load agents"
						description="Make sure the orchestrator is running."
					/>
				) : !agents || agents.length === 0 ? (
					<EmptyState
						title="No agents configured"
						description="Define agents in your company.yaml to see them here."
					/>
				) : (
					<div className="grid grid-cols-3 gap-4">
						{agents.map((agent) => (
							<AgentCard
								key={agent.id}
								agent={agent}
								activity={activity}
								onClick={() =>
									navigate({ to: '/agents', search: { agent: agent.id }, replace: true })
								}
							/>
						))}
					</div>
				)}
			</div>

			{selectedAgent && (
				<AgentDetailPanel
					agent={selectedAgent}
					onClose={() => navigate({ to: '/agents', search: {}, replace: true })}
				/>
			)}
		</ErrorBoundary>
	)
}
