import { HashIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { Channel } from '../data/channels.queries'

interface ChannelItemProps {
	channel: Channel
	active?: boolean
}

function formatChannelTime(timestamp: string | undefined | null): string {
	if (!timestamp) return ''
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ''
	const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000)
	if (diffMinutes < 1) return 'now'
	if (diffMinutes < 60) return `${diffMinutes}m`
	if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChannelItem({ channel, active = false }: ChannelItemProps): React.JSX.Element {
	return (
		<Link
			to="/c/$channelId"
			params={{ channelId: channel.id }}
			className={cn(
				'flex items-center gap-2.5 border-l-2 px-3 py-1 transition-colors hover:bg-white/[0.03]',
				active ? 'border-primary bg-primary/5' : 'border-transparent',
			)}
			title={channel.name}
		>
			<HashIcon size={14} className="shrink-0 text-muted-foreground" />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-heading text-xs text-foreground">
						{channel.name}
					</span>
					<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
						{formatChannelTime(channel.updated_at)}
					</span>
				</div>
				{channel.description ? (
					<div className="truncate text-[10px] text-muted-foreground">
						{channel.description}
					</div>
				) : null}
			</div>
		</Link>
	)
}
