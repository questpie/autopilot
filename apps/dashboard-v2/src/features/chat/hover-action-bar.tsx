import {
	ArrowBendUpLeftIcon,
	ChatTeardropIcon,
	DotsThreeOutlineIcon,
	PushPinIcon,
	SmileySticker,
} from '@phosphor-icons/react'
import type { Message } from './chat.types'
import { EmojiPicker } from './emoji-picker'
import { MessageActionsMenu } from './message-context-menu'
import { usePinMessage, useUnpinMessage } from './chat.mutations'

interface HoverActionBarProps {
	message: Message
	channelId?: string
	currentUserId: string
	isPinned: boolean
	onReply?: (message: Message) => void
	onThread?: (message: Message) => void
	onReact?: (message: Message, emoji: string) => void
	onPin?: (message: Message) => void
	onEdit?: () => void
	onDelete?: () => void
}

export function HoverActionBar({
	message,
	channelId,
	currentUserId,
	isPinned,
	onReply,
	onThread,
	onReact,
	onPin,
	onEdit,
	onDelete,
}: HoverActionBarProps) {
	const pinMessage = usePinMessage(channelId ?? '')
	const unpinMessage = useUnpinMessage(channelId ?? '')

	return (
		<div className="absolute -top-3 right-4 z-10 hidden items-center gap-0.5 rounded-md border border-border bg-background px-0.5 py-0.5 shadow-sm group-hover:flex">
			{onReact && (
				<EmojiPicker
					onSelect={(emoji) => onReact(message, emoji)}
					trigger={
						<span
							className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
							title="Add reaction"
						>
							<SmileySticker size={14} />
						</span>
					}
				/>
			)}
			{onReply && (
				<ActionButton
					icon={<ArrowBendUpLeftIcon size={14} />}
					label="Reply"
					onClick={() => onReply(message)}
				/>
			)}
			{onThread && (
				<ActionButton
					icon={<ChatTeardropIcon size={14} />}
					label="Start thread"
					onClick={() => onThread(message)}
				/>
			)}
			{onPin && (
				<ActionButton
					icon={<PushPinIcon size={14} />}
					label="Pin message"
					onClick={() => onPin(message)}
				/>
			)}
			{/* More actions dropdown */}
			{channelId && (
				<MessageActionsMenu
					trigger={
						<span
							className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
							title="More actions"
						>
							<DotsThreeOutlineIcon size={14} weight="fill" />
						</span>
					}
					messageId={message.id}
					messageContent={message.content}
					messageFrom={message.from}
					currentUserId={currentUserId}
					isPinned={isPinned}
					onReply={onReply ? () => onReply(message) : undefined}
					onThread={onThread ? () => onThread(message) : undefined}
					onEdit={onEdit}
					onDelete={onDelete}
					onPin={!isPinned && channelId ? () => pinMessage.mutate(message.id) : undefined}
					onUnpin={isPinned && channelId ? () => unpinMessage.mutate(message.id) : undefined}
					onBookmark={() => {
						const key = `bookmarks:${currentUserId}`
						const existing = JSON.parse(localStorage.getItem(key) ?? '[]') as string[]
						if (!existing.includes(message.id)) {
							localStorage.setItem(key, JSON.stringify([...existing, message.id]))
						}
					}}
					side="bottom"
					align="end"
				/>
			)}
		</div>
	)
}

function ActionButton({
	icon,
	label,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={label}
			className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
		>
			{icon}
		</button>
	)
}
