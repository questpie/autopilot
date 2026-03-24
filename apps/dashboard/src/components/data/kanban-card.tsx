import { Badge } from '@/components/ui/badge'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import { StatusBadge } from './status-badge'

interface KanbanCardProps {
	task: Task
	onClick: () => void
	onDragStart: () => void
}

const PRIORITY_COLORS: Record<string, string> = {
	critical: 'bg-destructive/10 text-destructive border-destructive/25',
	high: 'bg-warning/10 text-warning border-warning/25',
	medium: 'bg-info/10 text-info border-info/25',
	low: 'bg-muted text-muted-foreground border-border',
}

function labelColor(_label: string): string {
	return '#B700FF'
}

export function KanbanCard({ task, onClick, onDragStart }: KanbanCardProps) {
	return (
		<div
			draggable
			onDragStart={onDragStart}
			onClick={onClick}
			className={cn(
				'border border-border bg-card p-3 cursor-pointer transition-colors hover:bg-accent',
				task.status === 'blocked' && 'border-destructive/50',
			)}
		>
			<div className="flex items-center justify-between gap-1 mb-1.5">
				<span className="font-mono text-[10px] text-muted-foreground truncate">{task.id}</span>
				{task.priority && (
					<Badge className={cn('font-mono text-[8px] px-1 py-0', PRIORITY_COLORS[task.priority])}>
						{task.priority.toUpperCase()}
					</Badge>
				)}
			</div>

			<div className="text-[13px] font-medium leading-snug mb-2 line-clamp-2">{task.title}</div>

			<div className="flex items-center gap-2 flex-wrap">
				{task.assigned_to && (
					<div className="flex items-center gap-1.5">
						<AgentAvatar name={task.assigned_to} size="sm" />
						<span className="font-mono text-[9px] text-muted-foreground uppercase">
							{task.assigned_to}
						</span>
					</div>
				)}

				{task.labels && task.labels.length > 0 && (
					<div className="flex gap-1 flex-wrap ml-auto">
						{task.labels.slice(0, 3).map((label) => (
							<span
								key={label}
								className="font-mono text-[8px] font-semibold px-1.5 py-0 border"
								style={{
									color: labelColor(label),
									borderColor: labelColor(label),
									backgroundColor: `color-mix(in oklch, ${labelColor(label)} 10%, transparent)`,
								}}
							>
								{label}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
