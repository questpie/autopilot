import type { ChannelInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Plus } from '@phosphor-icons/react'

interface ChatSidebarProps {
	channels: ChannelInfo[]
	activeChannel: string
	onSelect: (channel: string) => void
	onCreateChannel: () => void
}

export function ChatSidebar({
	channels,
	activeChannel,
	onSelect,
	onCreateChannel,
}: ChatSidebarProps) {
	const channelList = channels.filter((c) => c.type === 'channel')
	const directList = channels.filter((c) => c.type === 'direct')

	return (
		<div className="w-[200px] border-r border-border shrink-0 flex flex-col overflow-y-auto">
			<div className="p-3">
				<SectionHeader label="Channels" />
				{channelList.map((ch) => (
					<ChannelItem
						key={ch.id}
						channel={ch}
						isActive={activeChannel === ch.id}
						onClick={() => onSelect(ch.id)}
					/>
				))}
				{channelList.length === 0 &&
					['general', 'dev', 'ops'].map((id) => (
						<ChannelItem
							key={id}
							channel={{ id, name: id, type: 'channel', unread: 0 }}
							isActive={activeChannel === id}
							onClick={() => onSelect(id)}
						/>
					))}

				{directList.length > 0 && (
					<>
						<SectionHeader label="Direct" />
						{directList.map((ch) => (
							<ChannelItem
								key={ch.id}
								channel={ch}
								isActive={activeChannel === ch.id}
								onClick={() => onSelect(ch.id)}
								prefix="@"
							/>
						))}
					</>
				)}
			</div>

			<div className="mt-auto p-3 border-t border-border">
				<button
					onClick={onCreateChannel}
					className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full px-2 py-1.5"
				>
					<Plus size={12} />
					Channel
				</button>
			</div>
		</div>
	)
}

function SectionHeader({ label }: { label: string }) {
	return (
		<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-semibold px-2 py-1.5 mt-2 first:mt-0">
			{label}
		</div>
	)
}

function ChannelItem({
	channel,
	isActive,
	onClick,
	prefix = '#',
}: {
	channel: ChannelInfo
	isActive: boolean
	onClick: () => void
	prefix?: string
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				'flex items-center justify-between w-full px-2 py-1.5 font-mono text-[11px] transition-colors cursor-pointer',
				isActive
					? 'text-primary bg-primary/5'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent',
			)}
		>
			<span className="truncate">
				{prefix}
				{channel.name}
			</span>
			{(channel.unread ?? 0) > 0 && (
				<span className="font-mono text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
					{channel.unread}
				</span>
			)}
		</button>
	)
}
