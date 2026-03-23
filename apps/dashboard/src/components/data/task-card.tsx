import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'
import { StatusBadge } from './status-badge'
import { AgentAvatar } from './agent-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface TaskCardProps {
	task: Task
	onClick?: () => void
	onApprove?: () => void
	onReject?: () => void
}

const PRIORITY_COLORS: Record<string, string> = {
	critical: 'bg-destructive/10 text-destructive',
	high: 'bg-warning/10 text-warning',
	medium: 'bg-info/10 text-info',
	low: 'bg-muted text-muted-foreground',
}

function labelColor(label: string): string {
	let hash = 0
	for (let i = 0; i < label.length; i++) {
		hash = label.charCodeAt(i) + ((hash << 5) - hash)
	}
	const hue = Math.abs(hash) % 360
	return `oklch(0.7 0.15 ${hue})`
}

export function TaskCard({ task, onClick, onApprove, onReject }: TaskCardProps) {
	return (
		<div
			onClick={onClick}
			className={cn(
				'border border-border bg-card p-4 cursor-pointer transition-colors hover:bg-accent',
				task.status === 'blocked' && 'border-destructive/50',
			)}
		>
			<div className="flex items-center justify-between gap-2 mb-2">
				<span className="font-mono text-[11px] text-muted-foreground">{task.id}</span>
				<div className="flex items-center gap-1.5">
					{task.priority && (
						<Badge className={cn('font-mono text-[8px]', PRIORITY_COLORS[task.priority])}>
							{task.priority.toUpperCase()}
						</Badge>
					)}
					<StatusBadge status={task.status} />
				</div>
			</div>
			<div className="text-sm font-medium mb-2">{task.title}</div>
			<div className="flex items-center gap-2 flex-wrap">
				{task.assigned_to && (
					<div className="flex items-center gap-2">
						<AgentAvatar name={task.assigned_to} size="sm" />
						<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
							{task.assigned_to}
						</span>
						{task.status === 'in_progress' && (
							<span className="w-1.5 h-1.5 bg-success animate-[pulse-dot_2s_ease-in-out_infinite]" />
						)}
					</div>
				)}
				{task.labels && task.labels.length > 0 && (
					<div className="flex gap-1 flex-wrap ml-auto">
						{task.labels.slice(0, 4).map((label) => (
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
			{task.status === 'blocked' && task.blockers?.[0] && (
				<div className="mt-2 text-[11px] text-destructive font-mono">
					{task.blockers[0].reason}
				</div>
			)}
			{task.status === 'review' && (
				<div className="flex gap-2 mt-3 pt-3 border-t border-border">
					<Button
						size="sm"
						onClick={(e) => { e.stopPropagation(); onApprove?.() }}
					>
						Approve
					</Button>
					<Button
						size="sm"
						variant="destructive"
						onClick={(e) => { e.stopPropagation(); onReject?.() }}
					>
						Reject
					</Button>
				</div>
			)}
		</div>
	)
}
