import { Linkify } from '@/lib/linkify'
import type { ActivityEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'

const TYPE_COLORS: Record<string, string> = {
	tool_call: 'text-info',
	session_start: 'text-success',
	session_end: 'text-muted-foreground',
	message: 'text-foreground',
	error: 'text-destructive',
	human: 'text-primary',
	'notification:task_assigned': 'text-warning',
}

export function ActivityItem({ entry, agentRole }: { entry: ActivityEntry; agentRole?: string }) {
	const date = new Date(entry.at)
	const time = Number.isNaN(date.getTime())
		? ''
		: date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			})

	const toolName = entry.details?.tool ?? ''
	const colorClass = TYPE_COLORS[entry.type] ?? 'text-muted-foreground'

	return (
		<div className="flex gap-3 py-2 px-0 text-[12px]">
			<span className="font-mono text-[10px] text-muted-foreground shrink-0 w-16 pt-0.5">
				{time}
			</span>
			<AgentAvatar name={entry.agent} size="sm" />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
						{entry.agent}
					</span>
					{toolName && <span className={cn('font-mono text-[10px]', colorClass)}>{toolName}</span>}
				</div>
				<div className="text-muted-foreground text-[11px] truncate">
					<Linkify>{entry.summary}</Linkify>
				</div>
			</div>
		</div>
	)
}
