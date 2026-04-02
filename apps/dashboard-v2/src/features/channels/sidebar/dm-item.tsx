import { GenerativeAvatar } from '@questpie/avatar'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { Channel } from '../data/channels.queries'

interface DmItemProps {
	channel: Channel
	active?: boolean
	currentUserId?: string
}

function formatDmTime(timestamp: string | undefined | null): string {
	if (!timestamp) return ''
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ''
	const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
	if (diffMinutes < 1) return 'now'
	if (diffMinutes < 60) return `${diffMinutes}m`
	if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDmDisplayName(channel: Channel, currentUserId?: string): string {
	// DM channel IDs follow pattern: dm-{actorA}--{actorB}
	const parts = channel.id.replace(/^dm-/, '').split('--')
	const otherId = parts.find((p) => p !== currentUserId) ?? parts[0] ?? channel.name
	return otherId ?? channel.name
}

function getDmAvatarSeed(channel: Channel, currentUserId?: string): string {
	const parts = channel.id.replace(/^dm-/, '').split('--')
	return parts.find((p) => p !== currentUserId) ?? parts[0] ?? channel.id
}

export function DmItem({
	channel,
	active = false,
	currentUserId,
}: DmItemProps): React.JSX.Element {
	const displayName = getDmDisplayName(channel, currentUserId)
	const avatarSeed = getDmAvatarSeed(channel, currentUserId)

	return (
		<Link
			to="/dm/$channelId"
			params={{ channelId: channel.id }}
			className={cn(
				'flex items-center gap-2.5 border-l-2 px-3 py-1 transition-colors hover:bg-white/[0.03]',
				active ? 'border-primary bg-primary/5' : 'border-transparent',
			)}
			title={displayName}
		>
			<GenerativeAvatar
				seed={avatarSeed}
				size={48}
				className="size-6 shrink-0 border border-border"
			/>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-heading text-xs text-foreground">
						{displayName}
					</span>
					<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
						{formatDmTime(channel.updated_at)}
					</span>
				</div>
			</div>
		</Link>
	)
}
