import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { useRef, useEffect, useMemo } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { ChannelSelector, type Channel } from '@/components/chat/channel-selector'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { useChat, useSendMessage } from '@/hooks/use-chat'
import { useAgents } from '@/hooks/use-agents'

export const Route = createFileRoute('/chat')({
	component: ChatPage,
	validateSearch: (search: Record<string, unknown>) => ({
		channel: (search.channel as Channel) ?? 'general',
	}),
})

function ChatPage() {
	const { channel } = useSearch({ from: '/chat' })
	const navigate = useNavigate()
	const { data: messages, isLoading } = useChat(channel)
	const { data: agents } = useAgents()
	const sendMessage = useSendMessage()
	const scrollRef = useRef<HTMLDivElement>(null)

	const agentRoleMap = useMemo(() => {
		const map: Record<string, string> = {}
		if (agents) {
			for (const a of agents) {
				map[a.id] = a.role
				map[a.name] = a.role
			}
		}
		return map
	}, [agents])

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages])

	const handleSend = (message: string) => {
		sendMessage.mutate({ message, channel })
	}

	const handleChannelChange = (ch: Channel) => {
		navigate({ to: '/chat', search: { channel: ch }, replace: true })
	}

	return (
		<ErrorBoundary>
			<TopBar title="Chat" />
			<ChannelSelector active={channel} onChange={handleChannelChange} />
			<div className="flex flex-col flex-1 overflow-hidden">
				<div
					ref={scrollRef}
					className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
				>
					{isLoading ? (
						<div className="space-y-4 py-4">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-16 w-3/4" />
							))}
						</div>
					) : !messages || messages.length === 0 ? (
						<EmptyState
							title="No messages yet"
							description={`Start a conversation in #${channel}`}
						/>
					) : (
						messages.map((msg) => (
							<ChatBubble
								key={msg.id}
								message={msg}
								agentRole={agentRoleMap[msg.sender]}
							/>
						))
					)}
				</div>
				<ChatInput
					channel={channel}
					onSend={handleSend}
					isLoading={sendMessage.isPending}
				/>
			</div>
		</ErrorBoundary>
	)
}
