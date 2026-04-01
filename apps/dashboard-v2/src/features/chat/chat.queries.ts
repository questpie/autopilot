import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { MessageSchema } from '@questpie/autopilot-spec/schemas'
import { queryOptions } from '@tanstack/react-query'
import type { Message } from './chat.types'

const MessagesSchema = MessageSchema.array()

export interface ChatSessionSummary {
	id: string
	agentId: string
	agentName: string
	status: string
	startedAt: string
	endedAt: string | null
	channelId: string | null
	firstMessage: string | null
	toolCalls: number
	tokensUsed: number
}

export interface ChatSessionDetail extends ChatSessionSummary {
	streamUrl: string
}

export interface ChatSessionsResponse {
	sessions: ChatSessionSummary[]
}

export interface StatusResponse {
	company: string
	userCount: number
	setupCompleted: boolean
	onboardingChatCompleted: boolean
	agentCount: number
	activeTasks: number
	runningSessions: number
	pendingApprovals: number
}

export const statusQuery = queryOptions({
	queryKey: queryKeys.status.root,
	queryFn: async (): Promise<StatusResponse> => {
		const res = await api.api.status.$get()
		if (!res.ok) throw new Error('Failed to fetch status')
		return res.json()
	},
})

export function chatSessionsQuery(limit = 20, offset = 0) {
	return queryOptions({
		queryKey: queryKeys.sessions.list({ limit, offset }),
		queryFn: async (): Promise<ChatSessionsResponse> => {
			const res = await api.api['chat-sessions'].$get({
				query: {
					limit: String(limit),
					offset: String(offset),
				},
			})
			if (!res.ok) throw new Error('Failed to fetch chat sessions')
			return res.json()
		},
	})
}

export function chatSessionDetailQuery(sessionId: string) {
	return queryOptions({
		queryKey: queryKeys.sessions.detail(sessionId),
		queryFn: async (): Promise<ChatSessionDetail> => {
			const res = await api.api['chat-sessions'][':id'].$get({
				param: { id: sessionId },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error((body as { error?: string }).error ?? 'Failed to fetch chat session')
			}
			return res.json()
		},
		enabled: !!sessionId,
	})
}

export function chatSessionMessagesQuery(sessionId: string, limit = 200, offset = 0) {
	return queryOptions({
		queryKey: queryKeys.messages.list({ session: sessionId, limit, offset }),
		queryFn: async (): Promise<Message[]> => {
			const res = await api.api['chat-sessions'][':id'].messages.$get({
				param: { id: sessionId },
				query: {
					limit: String(limit),
					offset: String(offset),
				},
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(
					(body as { error?: string }).error ?? 'Failed to fetch session messages',
				)
			}
			return MessagesSchema.parse(await res.json())
		},
		enabled: !!sessionId,
	})
}
