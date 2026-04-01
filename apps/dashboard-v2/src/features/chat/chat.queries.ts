import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { queryOptions } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { Message } from './chat.types'

type StatusGetResponse = InferResponseType<typeof api.api.status.$get, 200>
type ChatSessionsGetResponse = InferResponseType<(typeof api.api)['chat-sessions']['$get'], 200>
type ChatSessionGetResponse = InferResponseType<
	(typeof api.api)['chat-sessions'][':id']['$get'],
	200
>

export type StatusResponse = StatusGetResponse
export type ChatSessionsResponse = ChatSessionsGetResponse
export type ChatSessionSummary = ChatSessionsResponse['sessions'][number]
export type ChatSessionDetail = ChatSessionGetResponse

function getErrorMessage(body: unknown, fallback: string): string {
	if (typeof body !== 'object' || body === null || !('error' in body)) {
		return fallback
	}

	return typeof body.error === 'string' ? body.error : fallback
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
				throw new Error(getErrorMessage(body, 'Failed to fetch chat session'))
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
				throw new Error(getErrorMessage(body, 'Failed to fetch session messages'))
			}
			return res.json()
		},
		enabled: !!sessionId,
	})
}
