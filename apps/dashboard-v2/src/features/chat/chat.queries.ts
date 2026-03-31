import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import {
	ChannelMemberSchema,
	MessageSchema,
	PinnedMessageSchema,
	ReactionSchema,
} from '@questpie/autopilot-spec/schemas'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type { ChannelMember, Message, PinnedMessage, Reaction } from './chat.types'

const MessagesSchema = MessageSchema.array()
const ChannelMembersSchema = ChannelMemberSchema.array()
const PinnedMessagesSchema = PinnedMessageSchema.array()
const ReactionsSchema = ReactionSchema.array()

export const channelsQuery = queryOptions({
	queryKey: queryKeys.channels.list(),
	queryFn: async () => {
		const res = await api.api.channels.$get()
		if (!res.ok) throw new Error('Failed to fetch channels')
		return res.json()
	},
})

export function channelDetailQuery(id: string) {
	return queryOptions({
		queryKey: queryKeys.channels.detail(id),
		queryFn: async () => {
			const res = await api.api.channels[':id'].$get({
				param: { id },
			})
			if (!res.ok) throw new Error('Failed to fetch channel')
			return res.json()
		},
		enabled: !!id,
	})
}

export function messagesQuery(channelId: string, limit = 50) {
	return queryOptions({
		queryKey: queryKeys.messages.list({ channel: channelId, limit }),
		queryFn: async (): Promise<Message[]> => {
			const res = await api.api.channels[':id'].messages.$get({
				param: { id: channelId },
				query: { limit: limit.toString() },
			})
			if (!res.ok) throw new Error('Failed to fetch messages')
			return MessagesSchema.parse(await res.json())
		},
		enabled: !!channelId,
	})
}

/**
 * Infinite query for cursor-based pagination of channel messages.
 * Each page fetches `PAGE_SIZE` messages; uses the oldest message ID as cursor for the next page.
 */
const PAGE_SIZE = 50

export function messagesInfiniteQuery(channelId: string) {
	return infiniteQueryOptions({
		queryKey: [...queryKeys.messages.list({ channel: channelId }), 'infinite'] as const,
		queryFn: async ({ pageParam }): Promise<Message[]> => {
			const query: Record<string, string> = { limit: PAGE_SIZE.toString() }
			if (pageParam) {
				query.before = pageParam as string
			}
			const res = await api.api.channels[':id'].messages.$get({
				param: { id: channelId },
				query,
			})
			if (!res.ok) throw new Error('Failed to fetch messages')
			return MessagesSchema.parse(await res.json())
		},
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => {
			// If we got fewer messages than requested, there are no more pages
			if (lastPage.length < PAGE_SIZE) return undefined
			// Use the oldest message ID as cursor
			return lastPage[0]?.id
		},
		enabled: !!channelId,
	})
}

export function threadMessagesQuery(channelId: string, threadId: string) {
	return queryOptions({
		queryKey: queryKeys.messages.list({ channel: channelId, thread_id: threadId }),
		queryFn: async (): Promise<Message[]> => {
			const res = await api.api.channels[':id'].messages.$get({
				param: { id: channelId },
				query: { limit: '100', thread_id: threadId },
			})
			if (!res.ok) throw new Error('Failed to fetch thread messages')
			return MessagesSchema.parse(await res.json())
		},
		enabled: !!channelId && !!threadId,
	})
}

export function channelMembersQuery(channelId: string) {
	return queryOptions({
		queryKey: queryKeys.channels.detail(`${channelId}-members`),
		queryFn: async (): Promise<ChannelMember[]> => {
			const res = await api.api.channels[':id'].members.$get({
				param: { id: channelId },
			})
			if (!res.ok) throw new Error('Failed to fetch members')
			return ChannelMembersSchema.parse(await res.json())
		},
		enabled: !!channelId,
	})
}

export function pinnedMessagesQuery(channelId: string) {
	return queryOptions({
		queryKey: queryKeys.pins.list({ channel: channelId }),
		queryFn: async (): Promise<PinnedMessage[]> => {
			const res = await api.api.channels[':id'].pins.$get({
				param: { id: channelId },
			})
			if (!res.ok) throw new Error('Failed to fetch pinned messages')
			return PinnedMessagesSchema.parse(await res.json())
		},
		enabled: !!channelId,
	})
}

export function reactionsQuery(channelId: string, messageId: string) {
	return queryOptions({
		queryKey: queryKeys.reactions.detail(`${channelId}:${messageId}`),
		queryFn: async (): Promise<Reaction[]> => {
			const res = await api.api.channels[':id'].messages[':msgId'].reactions.$get({
				param: { id: channelId, msgId: messageId },
			})
			if (!res.ok) throw new Error('Failed to fetch reactions')
			return ReactionsSchema.parse(await res.json())
		},
		enabled: !!channelId && !!messageId,
	})
}
