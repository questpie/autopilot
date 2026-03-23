import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { CreateChannelDialog } from '@/components/chat/create-channel-dialog'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { TopBar } from '@/components/layout/top-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgents } from '@/hooks/use-agents'
import { useChannels } from '@/hooks/use-channels'
import { useChat, useSendMessage } from '@/hooks/use-chat'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

export const Route = createFileRoute('/chat')({
	component: ChatPage,
	validateSearch: (search: Record<string, unknown>) => ({
		channel: (search.channel as string) ?? 'general',
	}),
})

function ChatPage() {
	const { channel } = useSearch({ from: '/chat' })
	const navigate = useNavigate()
	const { data: messages, isLoading } = useChat(channel)
	const { data: agents } = useAgents()
	const { data: channels } = useChannels()
	const sendMessage = useSendMessage()
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showCreateChannel, setShowCreateChannel] = useState(false)

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

	const handleChannelChange = (ch: string) => {
		navigate({ to: '/chat', search: { channel: ch }, replace: true })
	}

	return (
		<ErrorBoundary>
			<TopBar title="Chat" />
			<div className="flex flex-1 overflow-hidden">
				{/* Channel Sidebar */}
				<ChatSidebar
					channels={channels ?? []}
					activeChannel={channel}
					onSelect={handleChannelChange}
					onCreateChannel={() => setShowCreateChannel(true)}
				/>

				{/* Chat Area */}
				<div className="flex flex-col flex-1 overflow-hidden">
					<div className="px-4 py-2 border-b border-border shrink-0 flex items-center gap-2">
						<span className="font-mono text-[12px] font-bold">#{channel}</span>
					</div>
					<div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
								<ChatBubble key={msg.id} message={msg} agentRole={agentRoleMap[msg.sender]} />
							))
						)}
					</div>
					<ChatInput channel={channel} onSend={handleSend} isLoading={sendMessage.isPending} />
				</div>
			</div>

			{showCreateChannel && <CreateChannelDialog onClose={() => setShowCreateChannel(false)} />}
		</ErrorBoundary>
	)
}
