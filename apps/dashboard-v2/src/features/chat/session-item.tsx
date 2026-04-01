import { GenerativeAvatar } from '@questpie/avatar'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatSessionSummary } from './chat.queries'

interface SessionItemProps {
	session: ChatSessionSummary
	active?: boolean
	hasUnseen?: boolean
}

function formatSessionTime(timestamp: string): string {
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return '—'
	const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
	if (diffMinutes < 1) return 'now'
	if (diffMinutes < 60) return `${diffMinutes}m`
	if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncateLabel(value: string, maxLength: number): string {
	if (value.length <= maxLength) return value
	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function getAutoSessionTitle(message: string | null): string | null {
	if (!message) return null

	const normalized = message.replace(/\s+/g, ' ').trim()
	if (!normalized) return null

	const firstSegment = normalized.split(/[.!?\n]/)[0]?.trim() ?? normalized
	const cleaned = firstSegment
		.replace(/^(please|can you|could you|would you|help me|i need|let's|lets)\s+/i, '')
		.replace(/^[-#*\d.\s]+/, '')
		.trim()

	if (!cleaned) return null
	return truncateLabel(cleaned, 44)
}

function getSessionLabel(session: ChatSessionSummary): string {
	const channelName = session.channelName?.trim()
	const isDirectSession = session.channelId?.startsWith('dm-') ?? false

	if (channelName && !isDirectSession) {
		return channelName
	}

	const autoTitle = getAutoSessionTitle(session.firstMessage)
	if (autoTitle) {
		return autoTitle
	}

	if (channelName) {
		return channelName
	}

	return session.agentName
}

export function SessionItem({
	session,
	active = false,
	hasUnseen = false,
}: SessionItemProps): React.JSX.Element {
	const label = getSessionLabel(session)

	return (
		<Link
			to="/s/$sessionId"
			params={{ sessionId: session.id }}
			className={cn(
				'flex items-center gap-2.5 border-l-2 px-3 py-1 transition-colors hover:bg-white/[0.03]',
				active ? 'border-primary bg-primary/5' : 'border-transparent',
			)}
			title={label}
		>
			<GenerativeAvatar
				seed={session.agentId}
				size={48}
				className="size-6 shrink-0 border border-border"
			/>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-heading text-xs text-foreground">{label}</span>
					{!active && hasUnseen ? (
						<Badge
							variant="secondary"
							className="h-4 shrink-0 px-1.5 text-[9px] uppercase tracking-[0.18em] text-foreground"
						>
							New
						</Badge>
					) : null}
					<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
						{formatSessionTime(session.lastMessageAt)}
					</span>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="truncate text-[10px] text-muted-foreground">{session.agentName}</span>
					{session.status === 'running' ? (
						<span className="size-1.5 rounded-full bg-success" />
					) : null}
				</div>
			</div>
		</Link>
	)
}
