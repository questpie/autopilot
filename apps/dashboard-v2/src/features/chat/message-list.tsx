import { useEffect, useMemo } from 'react'
import { ArrowClockwiseIcon, ArrowDownIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import { Button } from '@/components/ui/button'
import {
	getMessageRunError,
	getMessageToolCalls,
	summarizeErrorDetail,
} from './chat-message-metadata'
import { DayDivider } from './day-divider'
import { MessageRow } from './message-row'
import type { Message } from './chat.types'
import type { SessionStreamState, StreamErrorCode } from './use-session-stream'
import { useTranslation } from '@/lib/i18n'

interface MessageListProps {
	messages: Message[]
	currentUserId: string
	currentUserName: string
	sessionAgentId?: string
	sessionAgentName?: string
	streamingState?: SessionStreamState
	streamingAgentId?: string
	streamingAgentName?: string
	className?: string
	onRetry?: () => void
}

type MessageListItem =
	| { kind: 'day'; key: string; date: Date }
	| {
			kind: 'message'
			key: string
			message: Message
			isGroupStart: boolean
	  }

const ERROR_CODE_I18N_KEY: Record<StreamErrorCode, string> = {
	rate_limit: 'chat.error_rate_limit',
	auth: 'chat.error_auth',
	network: 'chat.error_network',
	provider: 'chat.error_provider',
	budget: 'chat.error_budget',
	unknown: 'chat.error_unknown',
}

function buildMessageList(messages: Message[]): MessageListItem[] {
	const sorted = [...messages].sort((left, right) => left.at.localeCompare(right.at))
	const items: MessageListItem[] = []
	let lastDay: string | null = null
	let lastSender: string | null = null
	let lastTimestamp = 0

	for (const message of sorted) {
		const timestamp = new Date(message.at)
		const dayKey = timestamp.toDateString()
		if (dayKey !== lastDay) {
			items.push({ kind: 'day', key: `day-${dayKey}`, date: timestamp })
			lastDay = dayKey
			lastSender = null
			lastTimestamp = 0
		}

		const time = timestamp.getTime()
		const isGroupStart = lastSender !== message.from || time - lastTimestamp > 5 * 60 * 1000

		items.push({
			kind: 'message',
			key: message.id,
			message,
			isGroupStart,
		})

		lastSender = message.from
		lastTimestamp = time
	}

	return items
}

// ── Scroll-to-bottom button (reads context from StickToBottom) ──────

function ScrollToBottomButton(): React.JSX.Element | null {
	const { isAtBottom, scrollToBottom } = useStickToBottomContext()
	const { t } = useTranslation()

	if (isAtBottom) return null

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
			<Button
				type="button"
				size="sm"
				className="pointer-events-auto"
				onClick={() => scrollToBottom()}
			>
				<ArrowDownIcon className="size-4" />
				{t('chat.scroll_to_bottom')}
			</Button>
		</div>
	)
}

// ── Force scroll on new user message ────────────────────────────────

function ScrollOnUserMessage({ messages }: { messages: Message[] }): null {
	const { scrollToBottom } = useStickToBottomContext()
	const lastUserMessageId = useMemo(
		() => [...messages].reverse().find((m) => m.external)?.id,
		[messages],
	)

	useEffect(() => {
		if (lastUserMessageId) {
			scrollToBottom()
		}
	}, [lastUserMessageId, scrollToBottom])

	return null
}

// ── Main component ──────────────────────────────────────────────────

export function MessageList({
	messages,
	currentUserId,
	currentUserName,
	sessionAgentId,
	sessionAgentName,
	streamingState,
	streamingAgentId,
	streamingAgentName,
	className,
	onRetry,
}: MessageListProps): React.JSX.Element {
	const { t } = useTranslation()

	const items = useMemo(() => buildMessageList(messages), [messages])

	const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
	const dbHasAgentResponse =
		streamingState?.status === 'completed' && !!lastMessage && !lastMessage.external

	const hasStreamingMessage =
		!!streamingAgentId &&
		!!streamingState &&
		!dbHasAgentResponse &&
		(streamingState.status === 'connecting' ||
			streamingState.status === 'streaming' ||
			streamingState.status === 'error' ||
			streamingState.status === 'completed') &&
		(streamingState.blocks.length > 0 ||
			streamingState.status === 'connecting' ||
			streamingState.status === 'error')
	const streamingErrorDetail = summarizeErrorDetail(streamingState?.error)
	const isStreamingLive =
		streamingState?.status === 'connecting' || streamingState?.status === 'streaming'

	return (
		<StickToBottom
			className={`relative flex min-h-0 flex-1 overflow-hidden ${className ?? ''}`}
			resize="smooth"
			initial="instant"
		>
			<StickToBottom.Content className="flex flex-col">
				{items.length === 0 && !hasStreamingMessage ? (
					<div className="flex flex-1 items-center justify-center px-6 py-10 text-sm text-muted-foreground">
						No messages yet.
					</div>
				) : null}

				{items.map((item) =>
					item.kind === 'day' ? (
						<DayDivider key={item.key} date={item.date} />
					) : (
						<MessageRow
							key={item.key}
							sender={{
								id: item.message.from,
								name:
									item.message.from === currentUserId
										? currentUserName
										: item.message.external
											? item.message.from
											: item.message.from === sessionAgentId
												? (sessionAgentName ?? item.message.from)
												: item.message.from,
								type: item.message.external ? 'human' : 'agent',
							}}
							content={item.message.content}
							timestamp={item.message.at}
							isGroupStart={item.isGroupStart}
							toolCalls={getMessageToolCalls(item.message)}
							attachments={item.message.attachments ?? []}
							runError={getMessageRunError(item.message)}
						/>
					),
				)}

				{hasStreamingMessage && streamingState && streamingAgentId ? (
					<>
						<MessageRow
							sender={{
								id: streamingAgentId,
								name: streamingAgentName ?? streamingAgentId,
								type: 'agent',
							}}
							content=""
							timestamp={new Date().toISOString()}
							isGroupStart
							isStreaming={isStreamingLive}
							streamBlocks={streamingState.blocks}
						/>
						{streamingState.status === 'error' ? (
							<div className="mx-4 mb-2 flex items-start gap-3 border border-destructive/30 bg-destructive/5 px-4 py-3">
								<WarningCircleIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<p className="text-sm font-medium text-destructive">
										{t(ERROR_CODE_I18N_KEY[streamingState.errorCode ?? 'unknown'])}
									</p>
									{streamingErrorDetail ? (
										<p className="text-xs text-muted-foreground">
											{streamingErrorDetail}
										</p>
									) : null}
								</div>
								{onRetry ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={onRetry}
										className="shrink-0"
									>
										<ArrowClockwiseIcon className="size-4" />
										{t('chat.error_retry')}
									</Button>
								) : null}
							</div>
						) : null}
					</>
				) : null}
			</StickToBottom.Content>

			<ScrollOnUserMessage messages={messages} />
			<ScrollToBottomButton />
		</StickToBottom>
	)
}
