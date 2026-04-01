import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { DayDivider } from './day-divider'
import { MessageRow } from './message-row'
import type { Message } from './chat.types'
import type { SessionStreamState } from './use-session-stream'
import { useTranslation } from '@/lib/i18n'

interface MessageListProps {
	messages: Message[]
	currentUserId: string
	currentUserName: string
	streamingState?: SessionStreamState
	streamingAgentId?: string
	streamingAgentName?: string
	className?: string
}

type MessageListItem =
	| { kind: 'day'; key: string; date: Date }
	| {
			kind: 'message'
			key: string
			message: Message
			isGroupStart: boolean
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

export function MessageList({
	messages,
	currentUserId,
	currentUserName,
	streamingState,
	streamingAgentId,
	streamingAgentName,
	className,
}: MessageListProps): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const previousCountRef = useRef(0)
	const [showScrollButton, setShowScrollButton] = useState(false)
	const { t } = useTranslation()

	const items = useMemo(() => buildMessageList(messages), [messages])
	// After stream completion, check whether the DB already contains the agent response.
	// If it does, suppress the streaming row to avoid showing a duplicate.
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
		(!!streamingState.text ||
			streamingState.toolCalls.length > 0 ||
			streamingState.status === 'connecting')

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
		const count = messages.length + (hasStreamingMessage ? 1 : 0)

		if (isNearBottom || count <= previousCountRef.current) {
			container.scrollTop = container.scrollHeight
			setShowScrollButton(false)
		} else {
			setShowScrollButton(true)
		}

		previousCountRef.current = count
	}, [messages.length, hasStreamingMessage, streamingState?.text, streamingState?.toolCalls.length])

	return (
		<div className="relative flex min-h-0 flex-1">
			<div
				ref={containerRef}
				className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${className ?? ''}`}
				onScroll={(event) => {
					const target = event.currentTarget
					const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 120
					setShowScrollButton(!isNearBottom)
				}}
			>
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
											: item.message.from,
								type: item.message.external ? 'human' : 'agent',
							}}
							content={item.message.content}
							timestamp={item.message.at}
							isGroupStart={item.isGroupStart}
						/>
					),
				)}

				{hasStreamingMessage && streamingState && streamingAgentId ? (
					<MessageRow
						sender={{
							id: streamingAgentId,
							name: streamingAgentName ?? streamingAgentId,
							type: 'agent',
						}}
						content={
							streamingState.status === 'error' && !streamingState.text
								? (streamingState.error ?? '')
								: streamingState.text
						}
						timestamp={new Date().toISOString()}
						isGroupStart
						isStreaming={streamingState.status !== 'error'}
						toolCalls={streamingState.toolCalls}
					/>
				) : null}
			</div>

			{showScrollButton ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
					<Button
						type="button"
						size="sm"
						className="pointer-events-auto"
						onClick={() => {
							if (!containerRef.current) return
							containerRef.current.scrollTop = containerRef.current.scrollHeight
							setShowScrollButton(false)
						}}
					>
						<ArrowDownIcon className="size-4" />
						{t('chat.scroll_to_bottom')}
					</Button>
				</div>
			) : null}
		</div>
	)
}
