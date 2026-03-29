import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ResourceLinker } from '@/components/resource-linker'
import { useTranslation } from '@/lib/i18n'
import { cn, stringToColor } from '@/lib/utils'
import {
	ArrowBendUpLeftIcon,
	ArrowClockwiseIcon,
	ChatTeardropIcon,
	DotsThreeOutlineIcon,
	PushPinIcon,
	SmileySticker,
} from '@phosphor-icons/react'
import { lazy, memo, Suspense, useCallback, useMemo } from 'react'
import type { Message } from './chat.types'
import { ReactionsRow } from './reactions-row'
import { EmojiPicker } from './emoji-picker'
import { useAddReaction, useEditMessage, usePinMessage, useUnpinMessage } from './chat.mutations'
import { ReplyReference } from './reply-reference'
import { FileEmbeds, type FileAttachment } from './file-embed'
import { MessageActionsMenu } from './message-context-menu'
import { useChatUIStore } from './chat-ui.store'

// Lazy-loaded heavy components (only needed on user interaction)
const SessionReplay = lazy(() => import('./session-replay').then((m) => ({ default: m.SessionReplay })))
const MessageEditor = lazy(() => import('./message-editor').then((m) => ({ default: m.MessageEditor })))

interface MessageBlockProps {
	message: Message
	/** Channel ID for reaction queries */
	channelId?: string
	/** Whether this is the first message in a group (shows avatar + name + timestamp) */
	isGroupStart: boolean
	/** Whether the message is still sending (optimistic) */
	isSending?: boolean
	/** Whether sending failed */
	isFailed?: boolean
	/** Retry callback for failed messages */
	onRetry?: () => void
	/** Reply callback */
	onReply?: (message: Message) => void
	/** Thread callback */
	onThread?: (message: Message) => void
	/** React callback */
	onReact?: (message: Message, emoji: string) => void
	/** Pin callback */
	onPin?: (message: Message) => void
	/** Compact mode for sidebar panel */
	compact?: boolean
	/** Parent message for reply reference (when message has thread_id) */
	parentMessage?: Message | null
	/** Number of thread replies to this message */
	threadReplyCount?: number
	/** Timestamp of last thread reply */
	lastThreadReplyAt?: string
	/** Whether this message is pinned */
	isPinned?: boolean
	/** Current user ID for ownership checks */
	currentUserId?: string
}

function formatTimestamp(iso: string): string {
	const date = new Date(iso)
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})
}

function formatAbsoluteTimestamp(iso: string): string {
	const date = new Date(iso)
	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})
}

function formatRelativeTime(iso: string): string {
	const now = Date.now()
	const then = new Date(iso).getTime()
	const diffMs = now - then
	const diffMin = Math.floor(diffMs / 60000)
	if (diffMin < 1) return 'just now'
	if (diffMin < 60) return `${diffMin}m ago`
	const diffHr = Math.floor(diffMin / 60)
	if (diffHr < 24) return `${diffHr}h ago`
	const diffDays = Math.floor(diffHr / 24)
	return `${diffDays}d ago`
}

function SystemMessage({ message }: { message: Message }) {
	return (
		<div className="flex justify-center px-4 py-2">
			<span className="font-heading text-[11px] text-muted-foreground">{message.content}</span>
		</div>
	)
}

function HoverActionBar({
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
}: {
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
}) {
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

export const MessageBlock = memo(function MessageBlock({
	message,
	channelId,
	isGroupStart,
	isSending,
	isFailed,
	onRetry,
	onReply,
	onThread,
	onReact,
	onPin,
	compact = false,
	parentMessage,
	threadReplyCount,
	lastThreadReplyAt,
	isPinned = false,
	currentUserId = 'human',
}: MessageBlockProps) {
	const { t } = useTranslation()
	const addReaction = useAddReaction(channelId ?? '', message.id)
	const editMessage = useEditMessage(channelId ?? '')
	const editingMessageId = useChatUIStore((s) => s.editingMessageId)
	const setEditingMessageId = useChatUIStore((s) => s.setEditingMessageId)
	const setDeletingMessageId = useChatUIStore((s) => s.setDeletingMessageId)

	const isEditing = editingMessageId === message.id

	const handleReact = useCallback((_msg: Message, emoji: string) => {
		if (!channelId || !emoji) return
		addReaction.mutate(emoji)
	}, [channelId, addReaction])

	const handleEdit = useCallback(() => {
		setEditingMessageId(message.id)
	}, [message.id, setEditingMessageId])

	const handleDelete = useCallback(() => {
		setDeletingMessageId(message.id)
	}, [message.id, setDeletingMessageId])

	const handleSaveEdit = useCallback((content: string) => {
		if (!channelId) return
		editMessage.mutate(
			{ messageId: message.id, content },
			{ onSuccess: () => setEditingMessageId(null) },
		)
	}, [channelId, message.id, editMessage, setEditingMessageId])

	const handleCancelEdit = useCallback(() => {
		setEditingMessageId(null)
	}, [setEditingMessageId])

	// System messages render centered
	if (message.from === 'system') {
		return <SystemMessage message={message} />
	}

	const avatarColor = stringToColor(message.from)
	const initial = message.from.charAt(0).toUpperCase()
	const isAgent = !message.external
	const showActions = !isSending && !isFailed && !isEditing
	const isOwn = message.from === currentUserId

	const hasReplyRef = !!message.thread_id

	// Extract file attachments from references (paths that look like files)
	const fileAttachments = useMemo<FileAttachment[]>(() => {
		return message.references
			.filter((ref) => ref.includes('.') && !ref.startsWith('session-'))
			.map((ref) => ({ path: ref }))
	}, [message.references])

	return (
		<div
			data-message-id={message.id}
			className={cn(
				'group relative flex gap-3 px-4 py-0.5 transition-colors hover:bg-white/[0.02]',
				'reply-highlight-target',
				isGroupStart && 'mt-2',
				compact && 'gap-2 px-3',
				isSending && 'opacity-60',
				isEditing && 'bg-primary/[0.03]',
			)}
		>
			{/* Avatar column */}
			<div className={cn('w-10 shrink-0', compact && 'w-7')}>
				{isGroupStart ? (
					<div
						className={cn(
							'flex items-center justify-center rounded-full font-heading text-xs font-bold',
							compact ? 'size-7 text-[10px]' : 'size-8 text-xs',
							avatarColor,
						)}
						title={message.from}
					>
						{initial}
					</div>
				) : (
					/* Compact timestamp on hover where avatar would be */
					<span
						className="hidden text-[10px] leading-[22px] text-muted-foreground/50 group-hover:inline"
						title={formatAbsoluteTimestamp(message.at)}
					>
						{formatTimestamp(message.at)}
					</span>
				)}
			</div>

			{/* Content column */}
			<div className="min-w-0 flex-1">
				{/* Reply reference — shown when this message is a reply */}
				{hasReplyRef && (
					<ReplyReference
						parentMessage={parentMessage ?? null}
						compact={compact}
					/>
				)}

				{/* Header: name + bot badge + timestamp + edited */}
				{isGroupStart && (
					<div className="flex items-baseline gap-2">
						<span className="text-sm font-semibold text-foreground">
							{message.from}
						</span>
						{isAgent && (
							<span className="rounded bg-primary/20 px-1.5 py-px text-[10px] font-medium text-primary">
								BOT
							</span>
						)}
						<span
							className="text-xs text-muted-foreground/60"
							title={formatAbsoluteTimestamp(message.at)}
						>
							{formatTimestamp(message.at)}
						</span>
						{message.edited_at && (
							<span
								className="text-[10px] text-muted-foreground/40"
								title={`Edited ${formatAbsoluteTimestamp(message.edited_at)}`}
							>
								(edited)
							</span>
						)}
					</div>
				)}

				{/* Message body — either editor or rendered content */}
				{isEditing ? (
					<Suspense fallback={<div className="h-10 animate-pulse rounded bg-muted/20" />}>
						<MessageEditor
							initialContent={message.content}
							onSave={handleSaveEdit}
							onCancel={handleCancelEdit}
							isSaving={editMessage.isPending}
						/>
					</Suspense>
				) : (
					<>
						<div className="text-sm leading-relaxed">
							<MarkdownRenderer content={message.content} mode="inline" />
							{/* Show (edited) inline when not group start (no header) */}
							{message.edited_at && !isGroupStart && (
								<span
									className="ml-1 text-[10px] text-muted-foreground/40"
									title={`Edited ${formatAbsoluteTimestamp(message.edited_at)}`}
								>
									(edited)
								</span>
							)}
						</div>

						{/* File / image / code embeds for attachment references */}
						{fileAttachments.length > 0 && (
							<FileEmbeds attachments={fileAttachments} />
						)}

						{/* Session replay for session references, ResourceLinker for non-file refs */}
						{message.references.length > 0 && (
							<div className="mt-1">
								{message.references.map((ref) => {
									// Skip file attachments (already rendered above)
									if (ref.includes('.') && !ref.startsWith('session-')) return null
									if (ref.startsWith('session-')) {
										return (
											<Suspense key={ref} fallback={<div className="h-6 animate-pulse rounded bg-muted/20" />}>
												<SessionReplay sessionId={ref} />
											</Suspense>
										)
									}
									return <ResourceLinker key={ref} text={ref} className="text-xs" />
								})}
							</div>
						)}
					</>
				)}

				{/* Reactions */}
				{channelId && !isSending && !isFailed && (
					<ReactionsRow channelId={channelId} messageId={message.id} />
				)}

				{/* Thread indicator */}
				{threadReplyCount != null && threadReplyCount > 0 && onThread && (
					<button
						type="button"
						onClick={() => onThread(message)}
						className="mt-1 flex items-center gap-1.5 text-[11px] text-primary/80 transition-colors hover:text-primary hover:underline"
					>
						<ChatTeardropIcon size={12} />
						<span className="font-medium">
							{threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
						</span>
						{lastThreadReplyAt && (
							<span className="text-muted-foreground/60">
								· Last reply {formatRelativeTime(lastThreadReplyAt)}
							</span>
						)}
					</button>
				)}

				{/* Sending / failed state */}
				{isSending && (
					<span className="text-[10px] text-muted-foreground">{t('chat.sending')}</span>
				)}
				{isFailed && onRetry && (
					<button
						type="button"
						onClick={onRetry}
						className="mt-1 flex items-center gap-1 text-[10px] text-destructive hover:underline"
					>
						<ArrowClockwiseIcon size={10} />
						{t('chat.retry_send')}
					</button>
				)}
			</div>

			{/* Hover action bar */}
			{showActions && (
				<HoverActionBar
					message={message}
					channelId={channelId}
					currentUserId={currentUserId}
					isPinned={isPinned}
					onReply={onReply}
					onThread={onThread}
					onReact={channelId ? handleReact : onReact}
					onPin={onPin}
					onEdit={isOwn ? handleEdit : undefined}
					onDelete={isOwn ? handleDelete : undefined}
				/>
			)}
		</div>
	)
})
