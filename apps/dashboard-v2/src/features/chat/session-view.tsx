import { useEffect } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { PageTransition } from '@/components/layouts/page-transition'
import { queryKeys } from '@/lib/query-keys'
import { Route as AppRoute } from '@/routes/_app'
import { useChatSeenStore } from '@/stores/chat-seen.store'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { useContinueChatSession } from './chat.mutations'
import { chatSessionDetailQuery, chatSessionMessagesQuery } from './chat.queries'
import { SessionHeader } from './session-header'
import { useSessionStream } from './use-session-stream'

interface SessionViewProps {
	sessionId: string
}

export function SessionView({ sessionId }: SessionViewProps): React.JSX.Element {
	const queryClient = useQueryClient()
	const markSessionSeen = useChatSeenStore((state) => state.markSessionSeen)
	const { user } = AppRoute.useRouteContext()
	const currentUserId = user?.id ?? 'human'
	const currentUserName = user?.name ?? user?.email ?? 'You'
	const { data: session } = useSuspenseQuery(chatSessionDetailQuery(sessionId))
	const { data: messages = [] } = useSuspenseQuery(chatSessionMessagesQuery(sessionId))
	const continueSession = useContinueChatSession()
	const wantsStream = session.status === 'running'
	// Always replay from the beginning — the agent's in-progress response
	// isn't in DB messages yet, so we need the full stream to render it.
	// The persisted offset is only used for server-side tracking.
	const stream = useSessionStream(wantsStream ? session.id : null)
	// Keep showing stream blocks until DB messages include the agent response.
	// Without this, the streaming row disappears before the DB catches up.
	const lastDbMessage = messages.length > 0 ? messages[messages.length - 1] : null
	const dbHasAgentResponse = !!lastDbMessage && !lastDbMessage.external
	const showStreamBlocks =
		wantsStream || (stream.state.blocks.length > 0 && !dbHasAgentResponse)
	const latestVisibleMessageAt =
		messages[messages.length - 1]?.at ?? session.lastMessageAt ?? session.startedAt

	useEffect(() => {
		markSessionSeen(sessionId, latestVisibleMessageAt)
	}, [latestVisibleMessageAt, markSessionSeen, sessionId])

	useEffect(() => {
		if (stream.state.status !== 'completed' && stream.state.status !== 'error') {
			return
		}

		// Small delay to let the backend persist session status before we refetch.
		const timer = setTimeout(() => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.detail(sessionId),
			})
			void queryClient.invalidateQueries({
				queryKey: queryKeys.sessions.root,
			})
			void queryClient.invalidateQueries({
				queryKey: queryKeys.messages.root,
			})
		}, 500)
		return () => clearTimeout(timer)
	}, [queryClient, sessionId, stream.state.status])

	return (
		<PageTransition className="flex min-h-0 flex-1 flex-col">
			<SessionHeader
				agentId={session.agentId}
				agentName={session.agentName}
				status={session.status}
				startedAt={session.startedAt}
				endedAt={session.endedAt}
				toolCalls={session.toolCalls}
			/>
			<MessageList
				messages={messages}
				currentUserId={currentUserId}
				currentUserName={currentUserName}
				sessionAgentId={session.agentId}
				sessionAgentName={session.agentName}
				streamingState={stream.state}
				streamingAgentId={showStreamBlocks ? session.agentId : undefined}
				streamingAgentName={session.agentName}
				onRetry={() => {
					const lastUserMessage = [...messages]
						.reverse()
						.find((m) => m.external)
					if (lastUserMessage) {
						void continueSession.mutateAsync({
							sessionId,
							message: lastUserMessage.content,
							attachments: lastUserMessage.attachments ?? [],
						})
					}
				}}
			/>
			<MessageComposer
				onSend={async ({ message, attachments }) => {
					await continueSession.mutateAsync({
						sessionId,
						message,
						attachments,
					})
				}}
				defaultAgentId={session.agentId}
				lockAgentId
				sessionId={session.id}
				agentName={session.agentName}
				disabled={continueSession.isPending || session.status === 'running'}
			/>
		</PageTransition>
	)
}
