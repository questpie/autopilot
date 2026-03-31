import { api } from '@/lib/api'
import { useTranslation } from '@/lib/i18n'
import { queryKeys } from '@/lib/query-keys'
import { MessageSchema, ReactionSchema } from '@questpie/autopilot-spec/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Message as MessageData, Reaction as ReactionData } from './chat.types'

const MessageResponseSchema = MessageSchema.extend({
	routed_to: MessageSchema.shape.from.optional(),
	route_reason: MessageSchema.shape.content.optional(),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canonical query key for a message list (with default limit). */
function messagesListKey(channelId: string) {
	return queryKeys.messages.list({ channel: channelId, limit: 50 })
}

/** Canonical query key for reactions on a specific message. */
function reactionKey(channelId: string, messageId: string) {
	return queryKeys.reactions.detail(`${channelId}:${messageId}`)
}

export function useSendMessage(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (data: {
			content: string
			thread?: string
			thread_id?: string
			mentions?: string[]
			references?: string[]
		}) => {
			const res = await api.api.channels[':id'].messages.$post({
				param: { id: channelId },
				json: {
					content: data.content,
					thread: data.thread,
					thread_id: data.thread_id,
					mentions: data.mentions,
					references: data.references,
				},
			})
			if (!res.ok) throw new Error('Failed to send message')
			return MessageResponseSchema.parse(await res.json())
		},
		onMutate: async (data) => {
			const listKey = messagesListKey(channelId)
			await queryClient.cancelQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})

			const previousMessages = queryClient.getQueryData(listKey)

			// Optimistic message
			const optimisticMessage: MessageData = {
				id: `temp-${Date.now()}`,
				from: 'human',
				channel: channelId,
				at: new Date().toISOString(),
				content: data.content,
				mentions: data.mentions ?? [],
				references: data.references ?? [],
				reactions: [],
				thread: data.thread ?? null,
				thread_id: data.thread_id ?? undefined,
				external: true,
			}

			queryClient.setQueryData(listKey, (old: MessageData[] | undefined) => {
				if (!old) return [optimisticMessage]
				return [...old, optimisticMessage]
			})

			return { previousMessages }
		},
		onError: (_err, _vars, context) => {
			if (context?.previousMessages) {
				queryClient.setQueryData(messagesListKey(channelId), context.previousMessages)
			}
			toast.error(t('chat.send_failed'))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})
			void queryClient.invalidateQueries({
				queryKey: queryKeys.channels.root,
			})
		},
	})
}

export function useCreateChannel() {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (data: {
			name: string
			type?: 'group' | 'direct' | 'broadcast'
			description?: string
			members?: Array<{ actor_id: string; actor_type: 'human' | 'agent' }>
		}) => {
			const res = await api.api.channels.$post({
				json: {
					name: data.name,
					type: data.type ?? 'group',
					description: data.description,
					members: data.members,
				},
			})
			if (!res.ok) throw new Error('Failed to create channel')
			return res.json()
		},
		onSuccess: () => {
			toast.success(t('chat.channel_created'))
			void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
		},
		onError: () => {
			toast.error(t('common.error'))
		},
	})
}

export function useAddReaction(channelId: string, messageId: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (emoji: string) => {
			const res = await api.api.channels[':id'].messages[':msgId'].reactions.$post({
				param: { id: channelId, msgId: messageId },
				json: { emoji },
			})
			if (!res.ok) throw new Error('Failed to add reaction')
			return ReactionSchema.parse(await res.json())
		},
		onMutate: async (emoji) => {
			const qk = reactionKey(channelId, messageId)
			await queryClient.cancelQueries({ queryKey: qk })

			const previous = queryClient.getQueryData<ReactionData[]>(qk)

			const optimistic: ReactionData = {
				id: `temp-${Date.now()}`,
				message_id: messageId,
				emoji,
				user_id: 'human',
				created_at: new Date().toISOString(),
			}

			queryClient.setQueryData<ReactionData[]>(qk, (old) =>
				old ? [...old, optimistic] : [optimistic],
			)

			return { previous }
		},
		onError: (_err, _emoji, context) => {
			if (context?.previous) {
				queryClient.setQueryData(reactionKey(channelId, messageId), context.previous)
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: reactionKey(channelId, messageId),
			})
		},
	})
}

export function useRemoveReaction(channelId: string, messageId: string) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (emoji: string) => {
			const res = await api.api.channels[':id'].messages[':msgId'].reactions.$delete({
				param: { id: channelId, msgId: messageId },
				json: { emoji },
			})
			if (!res.ok) throw new Error('Failed to remove reaction')
			return res.json()
		},
		onMutate: async (emoji) => {
			const qk = reactionKey(channelId, messageId)
			await queryClient.cancelQueries({ queryKey: qk })

			const previous = queryClient.getQueryData<ReactionData[]>(qk)

			queryClient.setQueryData<ReactionData[]>(qk, (old) =>
				old ? old.filter((r) => !(r.emoji === emoji && r.user_id === 'human')) : [],
			)

			return { previous }
		},
		onError: (_err, _emoji, context) => {
			if (context?.previous) {
				queryClient.setQueryData(reactionKey(channelId, messageId), context.previous)
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: reactionKey(channelId, messageId),
			})
		},
	})
}

export function useEditMessage(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
			const res = await api.api.channels[':id'].messages[':msgId'].$patch({
				param: { id: channelId, msgId: messageId },
				json: { content },
			})
			if (!res.ok) throw new Error('Failed to edit message')
			return res.json()
		},
		onMutate: async ({ messageId, content }) => {
			const listKey = messagesListKey(channelId)
			await queryClient.cancelQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})

			const previousMessages = queryClient.getQueryData(listKey)

			queryClient.setQueryData(listKey, (old: MessageData[] | undefined) => {
				if (!old) return old
				return old.map((m) =>
					m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m,
				)
			})

			return { previousMessages }
		},
		onError: (_err, _vars, context) => {
			if (context?.previousMessages) {
				queryClient.setQueryData(messagesListKey(channelId), context.previousMessages)
			}
			toast.error(t('common.error'))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})
		},
	})
}

export function useDeleteMessage(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (messageId: string) => {
			const res = await api.api.channels[':id'].messages[':msgId'].$delete({
				param: { id: channelId, msgId: messageId },
			})
			if (!res.ok) throw new Error('Failed to delete message')
			return res.json()
		},
		onMutate: async (messageId) => {
			const listKey = messagesListKey(channelId)
			await queryClient.cancelQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})

			const previousMessages = queryClient.getQueryData(listKey)

			queryClient.setQueryData(listKey, (old: MessageData[] | undefined) => {
				if (!old) return old
				return old.filter((m) => m.id !== messageId)
			})

			return { previousMessages }
		},
		onError: (_err, _vars, context) => {
			if (context?.previousMessages) {
				queryClient.setQueryData(messagesListKey(channelId), context.previousMessages)
			}
			toast.error(t('common.error'))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.messages.list({ channel: channelId }),
			})
		},
	})
}

export function usePinMessage(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (messageId: string) => {
			const res = await api.api.channels[':id'].messages[':msgId'].pin.$post({
				param: { id: channelId, msgId: messageId },
			})
			if (!res.ok) throw new Error('Failed to pin message')
			return res.json()
		},
		onSuccess: () => {
			toast.success(t('chat.message_pinned'))
		},
		onError: () => {
			toast.error(t('common.error'))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.pins.list({ channel: channelId }),
			})
		},
	})
}

export function useUnpinMessage(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (messageId: string) => {
			const res = await api.api.channels[':id'].messages[':msgId'].pin.$delete({
				param: { id: channelId, msgId: messageId },
			})
			if (!res.ok) throw new Error('Failed to unpin message')
			return res.json()
		},
		onSuccess: () => {
			toast.success(t('chat.message_unpinned'))
		},
		onError: () => {
			toast.error(t('common.error'))
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.pins.list({ channel: channelId }),
			})
		},
	})
}

export function useManageMembers(channelId: string) {
	const queryClient = useQueryClient()
	const { t } = useTranslation()

	return useMutation({
		mutationFn: async (data: {
			add?: Array<{
				actor_id: string
				actor_type: 'human' | 'agent'
				role?: 'owner' | 'member' | 'readonly'
			}>
			remove?: string[]
		}) => {
			const res = await api.api.channels[':id'].members.$put({
				param: { id: channelId },
				json: data,
			})
			if (!res.ok) throw new Error('Failed to manage members')
			return res.json()
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.channels.detail(channelId),
			})
			void queryClient.invalidateQueries({
				queryKey: queryKeys.channels.detail(`${channelId}-members`),
			})
		},
		onError: () => {
			toast.error(t('common.error'))
		},
	})
}
