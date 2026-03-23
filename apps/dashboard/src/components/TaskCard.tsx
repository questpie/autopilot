import { StatusBadge } from './StatusBadge'

interface TaskCardProps {
	id: string
	title: string
	status: string
	agent?: string
	priority?: string
}

export function TaskCard({ id, title, status, agent, priority }: TaskCardProps) {
	return (
		<div className="bg-card border border-border p-3 hover:border-purple/40 transition-colors">
			<div className="flex items-center justify-between mb-2">
				<span className="text-xs font-mono text-ghost">{id}</span>
				<StatusBadge status={status} />
			</div>
			<p className="text-sm text-fg mb-2 leading-snug">{title}</p>
			<div className="flex items-center justify-between">
				{agent && <span className="text-xs text-muted">{agent}</span>}
				{priority && (
					<span className="text-xs font-mono text-ghost uppercase">{priority}</span>
				)}
			</div>
		</div>
	)
}
