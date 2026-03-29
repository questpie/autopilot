import { MarkdownRenderer } from '@/components/markdown-renderer'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ArrowClockwiseIcon, ChatTeardropIcon } from '@phosphor-icons/react'
import { lazy, memo, Suspense, useCallback } from 'react'
import type { Message } from './chat.types'
import { useAddReaction, useEditMessage } from './chat.mutations'
import { useChatUIStore } from './chat-ui.store'
import { ReactionsRow } from './reactions-row'
import { ReplyReference } from './reply-reference'
import { MessageAvatar } from './message-avatar'
import { MessageHeader } from './message-header'
import { HoverActionBar } from './hover-action-bar'
import { MessageEmbedsSection } from './message-embeds'
import { formatAbsoluteTimestamp, formatRelativeTime, formatTimestamp } from './message-time'

const MessageEditor = lazy(() => import('./message-editor').then((m) => ({ default: m.MessageEditor })))

interface MessageBlockProps {
	message: Message
	channelId?: string
	isGroupStart: boolean
	isSending?: boolean
	isFailed?: boolean
	onRetry?: () => void
	onReply?: (message: Message) => void
	onThread?: (message: Message) => void
	onReact?: (message: Message, emoji: string) => void
	onPin?: (message: Message) => void
	compact?: boolean
	parentMessage?: Message | null
	threadReplyCount?: number
	lastThreadReplyAt?: string
	isPinned?: boolean
	currentUserId?: string
}

function SystemMessage({ message }: { message: Message }) {
	return (
		<div className="flex justify-center px-4 py-2">
			<span className="font-heading text-[11px] text-muted-foreground">{message.content}</span>
		</div>
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

	const isAgent = !message.external
	const showActions = !isSending && !isFailed && !isEditing
	const isOwn = message.from === currentUserId
	const hasReplyRef = !!message.thread_id

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
					<MessageAvatar from={message.from} size={compact ? 28 : 32} />
				) : (
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
				{hasReplyRef && (
					<ReplyReference parentMessage={parentMessage ?? null} compact={compact} />
				)}

				{isGroupStart && (
					<MessageHeader
						from={message.from}
						timestamp={message.at}
						isAgent={isAgent}
						editedAt={message.edited_at}
					/>
				)}

				{/* Message body */}
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
							{message.edited_at && !isGroupStart && (
								<span
									className="ml-1 text-[10px] text-muted-foreground/40"
									title={`Edited ${formatAbsoluteTimestamp(message.edited_at)}`}
								>
									(edited)
								</span>
							)}
						</div>

						{message.references.length > 0 && (
							<MessageEmbedsSection references={message.references} />
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
