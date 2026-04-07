import { useEffect, useState } from 'react'
import { GenerativeAvatar } from '@questpie/avatar'

interface SessionHeaderProps {
	agentId: string
	agentName: string
	status: string
	startedAt: string
	endedAt?: string | null
	toolCalls: number
}

function formatDuration(startedAt: string, endedAt?: string | null): string {
	const start = new Date(startedAt).getTime()
	const end = new Date(endedAt ?? Date.now()).getTime()
	if (Number.isNaN(start) || Number.isNaN(end)) return '—'

	const totalSeconds = Math.max(0, Math.floor((end - start) / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
	if (minutes > 0) return `${minutes}m ${seconds}s`
	return `${seconds}s`
}

function statusLabel(status: string): { label: string; tone: string } {
	switch (status) {
		case 'running':
			return { label: 'Running', tone: 'bg-success' }
		case 'completed':
			return { label: 'Completed', tone: 'bg-muted-foreground' }
		default:
			return { label: 'Error', tone: 'bg-destructive' }
	}
}

export function SessionHeader({
	agentId,
	agentName,
	status,
	startedAt,
	endedAt,
	toolCalls,
}: SessionHeaderProps): React.JSX.Element {
	const [, setNow] = useState(Date.now())
	const indicator = statusLabel(status)

	useEffect(() => {
		if (status !== 'running') return
		const interval = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(interval)
	}, [status])

	return (
		<div className="flex items-center gap-3 border-b border-border px-4 py-3">
			<GenerativeAvatar seed={agentId} size={32} className="size-8 border border-border" />
			<div className="min-w-0 flex-1">
				<div className="truncate font-heading text-sm text-foreground">{agentName || 'Unknown Agent'}</div>
				<div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span className={`size-1.5 rounded-full ${indicator.tone}`} />
						{indicator.label}
					</span>
					<span>{formatDuration(startedAt, endedAt)}</span>
					<span>{toolCalls} tool calls</span>
				</div>
			</div>
		</div>
	)
}
