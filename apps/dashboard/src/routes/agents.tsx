import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { AgentAvatar } from '@/components/AgentAvatar'
import { StatusBadge } from '@/components/StatusBadge'
import { ActivityItem } from '@/components/ActivityItem'

export const Route = createFileRoute('/agents')({
	component: AgentsPage,
})

interface Agent {
	id: string
	name: string
	role: string
	status: string
	description?: string
	recentActivity?: {
		agent: string
		role?: string
		action: string
		timestamp: string
		detail?: string
	}[]
}

function AgentsPage() {
	const [agents, setAgents] = useState<Agent[]>([])
	const [selected, setSelected] = useState<Agent | null>(null)

	useEffect(() => {
		apiFetch<Agent[]>('/api/agents').then(setAgents).catch(() => {})
	}, [])

	return (
		<div className="flex gap-4 h-full">
			<div className="flex-1">
				<h2 className="text-xs font-mono text-ghost uppercase tracking-wider mb-3">
					Agents
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
					{agents.length === 0 && (
						<p className="text-xs text-ghost py-4">No agents registered</p>
					)}
					{agents.map((agent) => (
						<button
							key={agent.id}
							onClick={() => setSelected(agent)}
							className={`bg-card border p-4 text-left transition-colors ${
								selected?.id === agent.id
									? 'border-purple'
									: 'border-border hover:border-purple/40'
							}`}
						>
							<div className="flex items-center gap-3 mb-3">
								<AgentAvatar name={agent.name} role={agent.role} />
								<div className="min-w-0">
									<p className="text-sm font-semibold text-fg truncate">
										{agent.name}
									</p>
									<p className="text-xs text-ghost font-mono">{agent.role}</p>
								</div>
							</div>
							<StatusBadge status={agent.status} />
						</button>
					))}
				</div>
			</div>

			{/* Detail Panel */}
			{selected && (
				<div className="w-80 bg-card border border-border p-4 shrink-0 overflow-y-auto">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-3">
							<AgentAvatar name={selected.name} role={selected.role} />
							<div>
								<p className="text-sm font-semibold text-fg">{selected.name}</p>
								<p className="text-xs text-ghost font-mono">{selected.role}</p>
							</div>
						</div>
						<button
							onClick={() => setSelected(null)}
							className="text-ghost hover:text-fg text-sm transition-colors"
						>
							x
						</button>
					</div>
					<StatusBadge status={selected.status} />
					{selected.description && (
						<p className="text-sm text-muted mt-3">{selected.description}</p>
					)}
					{selected.recentActivity && selected.recentActivity.length > 0 && (
						<div className="mt-4">
							<h3 className="text-xs font-mono text-ghost uppercase tracking-wider mb-2">
								Recent Activity
							</h3>
							{selected.recentActivity.map((item, i) => (
								<ActivityItem
									key={`${item.timestamp}-${i}`}
									agent={item.agent}
									role={item.role}
									action={item.action}
									timestamp={item.timestamp}
									detail={item.detail}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
