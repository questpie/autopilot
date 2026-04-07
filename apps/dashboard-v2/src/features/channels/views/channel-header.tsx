import { HashIcon, UsersIcon } from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'
import { Button } from '@/components/ui/button'
interface ChannelHeaderProps {
	name: string
	description?: string | null
	memberCount: number
	type: 'group' | 'direct' | 'broadcast'
	/** For DM: the other participant's ID (avatar seed) */
	dmParticipantId?: string
	/** For DM: the other participant's display name */
	dmParticipantName?: string
	onMembersClick?: () => void
}

export function ChannelHeader({
	name,
	description,
	memberCount,
	type,
	dmParticipantId,
	dmParticipantName,
	onMembersClick,
}: ChannelHeaderProps): React.JSX.Element {
	return (
		<div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
			{type === 'direct' && dmParticipantId ? (
				<GenerativeAvatar
					seed={dmParticipantId}
					size={24}
					className="size-6 shrink-0 border border-border"
				/>
			) : (
				<HashIcon size={16} className="shrink-0 text-muted-foreground" />
			)}

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-heading text-sm text-foreground">
						{type === 'direct' && dmParticipantName ? dmParticipantName : name}
					</span>
				</div>
				{description ? (
					<div className="truncate text-xs text-muted-foreground">{description}</div>
				) : null}
			</div>

			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
				onClick={onMembersClick}
			>
				<UsersIcon size={14} />
				<span className="text-xs">{memberCount}</span>
			</Button>
		</div>
	)
}
