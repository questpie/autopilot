import { GenerativeAvatar } from '@questpie/avatar'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { ChatSessionSummary } from './chat.queries'

interface SessionItemProps {
	session: ChatSessionSummary
	active?: boolean
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

export function SessionItem({
	session,
	active = false,
}: SessionItemProps): React.JSX.Element {
	return (
		<Link
			to="/s/$sessionId"
			params={{ sessionId: session.id }}
			className={cn(
				'flex items-start gap-3 border-l-2 px-4 py-3 transition-colors hover:bg-white/[0.03]',
				active ? 'border-primary bg-primary/5' : 'border-transparent',
			)}
		>
			<GenerativeAvatar
				seed={session.agentId}
				size={28}
				className="size-7 shrink-0 border border-border"
			/>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-heading text-xs text-foreground">
						{session.agentName}
					</span>
					<span className="text-[10px] text-muted-foreground">
						{formatSessionTime(session.startedAt)}
					</span>
					{session.status === 'running' ? (
						<span className="mt-0.5 size-1.5 rounded-full bg-success" />
					) : null}
				</div>
				<div className="mt-1 truncate text-xs text-muted-foreground">
					{session.firstMessage || 'New session'}
				</div>
			</div>
		</Link>
	)
}
