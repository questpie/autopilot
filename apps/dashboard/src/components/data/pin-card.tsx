import type { Pin } from '@/lib/types'
import { AgentAvatar } from './agent-avatar'
import { cn } from '@/lib/utils'

const PIN_TYPE_ICONS: Record<string, string> = {
	update: '\uD83D\uDCCC',
	success: '\u2705',
	warning: '\u26A0\uFE0F',
	error: '\u274C',
	question: '\u2753',
	info: '\u2139\uFE0F',
}

const PIN_TYPE_BADGE: Record<string, string> = {
	update: 'bg-primary text-primary-foreground',
	success: 'bg-success text-success-foreground',
	warning: 'bg-warning text-warning-foreground',
	error: 'bg-destructive text-destructive-foreground',
	question: 'bg-info text-info-foreground',
	info: 'bg-info text-info-foreground',
}

interface PinCardProps {
	pin: Pin
	agentRole?: string
	onClick?: () => void
}

export function PinCard({ pin, agentRole, onClick }: PinCardProps) {
	const timeAgo = pin.created_at ? formatTimeAgo(pin.created_at) : ''

	return (
		<div
			onClick={onClick}
			className="border border-border bg-card p-3 transition-colors cursor-pointer hover:bg-accent h-full"
		>
			<div className="flex items-start gap-2 mb-1">
				<span
					className={cn(
						'inline-flex items-center justify-center w-5 h-5 text-[10px] font-mono font-bold shrink-0',
						PIN_TYPE_BADGE[pin.type] ?? 'bg-muted text-muted-foreground',
					)}
				>
					{PIN_TYPE_ICONS[pin.type] ?? '\uD83D\uDCCC'}
				</span>
				<div className="text-sm font-medium">{pin.title}</div>
			</div>
			{pin.content && (
				<div className="text-[11px] text-muted-foreground mb-2 line-clamp-2">
					{pin.content.replace(/[*#_`>]/g, '').replace(/\n+/g, ' ')}
				</div>
			)}

			{pin.created_by && (
				<div className="flex items-center gap-2 mb-1">
					<AgentAvatar name={pin.created_by} role={agentRole} size="sm" />
					<span className="font-mono text-[10px] text-muted-foreground">
						{pin.created_by} {timeAgo && `\u00B7 ${timeAgo}`}
					</span>
				</div>
			)}

			{pin.metadata?.progress !== undefined && (
				<div className="mt-2">
					<div className="h-1 bg-secondary w-full">
						<div
							className="h-full bg-primary transition-all"
							style={{ width: `${pin.metadata.progress}%` }}
						/>
					</div>
					<span className="font-mono text-[9px] text-muted-foreground">
						{pin.metadata.progress}%
					</span>
				</div>
			)}
		</div>
	)
}

function formatTimeAgo(timestamp: string): string {
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ''
	const diff = Date.now() - date.getTime()
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins}m ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}
