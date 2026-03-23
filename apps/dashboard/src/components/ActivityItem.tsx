import { AgentAvatar } from './AgentAvatar'

interface ActivityItemProps {
	agent: string
	role?: string
	action: string
	timestamp: string
	detail?: string
}

export function ActivityItem({ agent, role, action, timestamp, detail }: ActivityItemProps) {
	return (
		<div className="flex gap-3 py-2 border-b border-border/50">
			<AgentAvatar name={agent} role={role} />
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="text-sm font-semibold text-fg">{agent}</span>
					<span className="text-xs text-ghost">{timestamp}</span>
				</div>
				<p className="text-sm text-muted">{action}</p>
				{detail && (
					<p className="text-xs text-ghost font-mono mt-1 truncate">{detail}</p>
				)}
			</div>
		</div>
	)
}
