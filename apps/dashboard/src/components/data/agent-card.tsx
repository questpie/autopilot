import { cn } from '@/lib/utils'
import type { Agent, ActivityEntry } from '@/lib/types'
import { AgentAvatar } from './agent-avatar'

interface AgentCardProps {
	agent: Agent
	activity?: ActivityEntry[]
	onClick?: () => void
}

export function AgentCard({ agent, activity, onClick }: AgentCardProps) {
	const stats = computeAgentStats(agent.id, activity)

	return (
		<div
			onClick={onClick}
			className="border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-accent h-full"
		>
			<div className="flex items-start gap-3 mb-3">
				<AgentAvatar name={agent.name} size="md" />
				<div className="min-w-0">
					<div className="text-sm font-medium truncate">{agent.name}</div>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
						{agent.role}
					</div>
				</div>
			</div>

			<div className="flex items-center gap-2 mb-2">
				<AgentStatusDot status={stats.status} />
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
					{stats.status}
				</span>
			</div>

			{stats.currentTask && (
				<div className="font-mono text-[10px] text-muted-foreground mb-2 truncate">
					{stats.currentTask}
				</div>
			)}

			<div className="font-mono text-[10px] text-muted-foreground">
				{stats.sessions} sessions \u00B7 {stats.toolCalls} tool calls
			</div>
		</div>
	)
}

function AgentStatusDot({ status }: { status: string }) {
	const colors: Record<string, string> = {
		active: 'bg-primary animate-[pulse-dot_2s_ease-in-out_infinite]',
		idle: 'bg-primary/40',
		scheduled: 'bg-primary/60',
		offline: 'bg-muted-foreground',
	}

	return <span className={cn('w-2 h-2 rounded-full shrink-0', colors[status] ?? colors.idle)} />
}

function computeAgentStats(agentId: string, activity?: ActivityEntry[]) {
	if (!activity) return { status: 'idle', sessions: 0, toolCalls: 0, currentTask: '' }

	const agentActivity = activity.filter((a) => a.agent === agentId)
	const sessions = agentActivity.filter((a) => a.type === 'session_start').length
	const toolCalls = agentActivity.filter((a) => a.type === 'tool_call').length

	const lastStart = agentActivity.findLast((a) => a.type === 'session_start')
	const lastEnd = agentActivity.findLast((a) => a.type === 'session_end')
	const isActive =
		lastStart && (!lastEnd || new Date(lastStart.at) > new Date(lastEnd.at))

	const currentTask = lastStart?.details?.taskId ?? ''

	return {
		status: isActive ? 'active' : 'idle',
		sessions,
		toolCalls,
		currentTask,
	}
}
