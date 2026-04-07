import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InferResponseType } from 'hono/client'
import type { ChatSessionDetail } from './chat.queries'
import type { MessageAttachment } from './chat.types'

export interface CreateChatSessionInput {
	agentId: string
	message: string
	attachments?: MessageAttachment[]
	channelId?: string
}

export interface ContinueChatSessionInput {
	sessionId: string
	message: string
	attachments?: MessageAttachment[]
}

type CreateChatSessionResult = InferResponseType<(typeof api.api)['chat-sessions']['$post'], 200>
type ContinueChatSessionResult = InferResponseType<
	(typeof api.api)['chat-sessions'][':id']['messages']['$post'],
	200
>

function getErrorMessage(body: unknown, fallback: string): string {
	if (typeof body !== 'object' || body === null || !('error' in body)) {
		return fallback
	}

	return typeof body.error === 'string' ? body.error : fallback
}

export function useCreateChatSession() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: CreateChatSessionInput): Promise<CreateChatSessionResult> => {
			const res = await api.api['chat-sessions'].$post({
				json: data,
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to create session'))
			}
			return res.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.root })
			void queryClient.invalidateQueries({ queryKey: queryKeys.status.root })
		},
	})
}

export function useContinueChatSession() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (
			data: ContinueChatSessionInput,
		): Promise<ContinueChatSessionResult> => {
			const res = await api.api['chat-sessions'][':id'].messages.$post({
				param: { id: data.sessionId },
				json: { message: data.message, attachments: data.attachments },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to continue session'))
			}
			return res.json()
		},
		onSuccess: (data, variables) => {
			queryClient.setQueryData(
				queryKeys.sessions.detail(variables.sessionId),
				(previous: ChatSessionDetail | undefined) =>
					previous
						? {
								...previous,
								status: 'running',
								endedAt: null,
								streamUrl: data.streamUrl,
								streamOffset: data.streamOffset,
							}
						: previous,
			)
			void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.root })
			void queryClient.invalidateQueries({ queryKey: queryKeys.messages.root })
		},
	})
}
