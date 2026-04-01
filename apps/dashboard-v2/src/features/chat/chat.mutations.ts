import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ChatSessionDetail } from './chat.queries'

export interface CreateChatSessionInput {
	agentId: string
	message: string
	channelId?: string
}

export interface CreateChatSessionResult {
	sessionId: string
	channelId: string
	streamUrl: string
}

export interface ContinueChatSessionInput {
	sessionId: string
	message: string
}

export interface ContinueChatSessionResult {
	sessionId: string
	channelId?: string
	streamUrl: string
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
				throw new Error((body as { error?: string }).error ?? 'Failed to create session')
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
				json: { message: data.message },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error((body as { error?: string }).error ?? 'Failed to continue session')
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
							}
						: previous,
			)
			void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.root })
			void queryClient.invalidateQueries({ queryKey: queryKeys.messages.root })
		},
	})
}
