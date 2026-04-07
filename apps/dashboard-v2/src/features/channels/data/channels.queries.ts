import { queryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

// ── Types (manually defined — Hono describeRoute doesn't flow types) ───────

export interface Channel {
	id: string
	name: string
	type: 'group' | 'direct' | 'broadcast'
	description?: string | null
	created_by: string
	created_at: string
	updated_at: string
	metadata: Record<string, unknown>
}

export interface ChannelDetail extends Channel {
	members: ChannelMember[]
}

export interface ChannelMessage {
	id: string
	from: string
	to?: string | null
	channel?: string | null
	at: string
	content: string
	mentions: string[]
	references: string[]
	reactions: string[]
	thread: string | null
	thread_id?: string
	transport?: string | null
	external: boolean
	metadata?: Record<string, unknown>
	attachments?: Array<{
		id: string
		filename: string
		size: number
		mime_type: string
		url: string
	}>
	edited_at?: string | null
}

export interface ChannelMember {
	id?: number
	channel_id: string
	actor_id: string
	actor_type: 'human' | 'agent'
	role: 'owner' | 'member' | 'readonly'
	joined_at: string
}

// ── Queries ────────────────────────────────────────────────────────────────

function getErrorMessage(body: unknown, fallback: string): string {
	if (typeof body !== 'object' || body === null || !('error' in body)) {
		return fallback
	}
	return typeof body.error === 'string' ? body.error : fallback
}

export function channelsListQuery() {
	return queryOptions({
		queryKey: queryKeys.channels.list(),
		queryFn: async (): Promise<Channel[]> => {
			const res = await api.api.channels.$get()
			if (!res.ok) throw new Error('Failed to fetch channels')
			return res.json() as Promise<Channel[]>
		},
	})
}

export function channelDetailQuery(channelId: string) {
	return queryOptions({
		queryKey: queryKeys.channels.detail(channelId),
		queryFn: async (): Promise<ChannelDetail> => {
			const res = await api.api.channels[':id'].$get({
				param: { id: channelId },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to fetch channel'))
			}
			return res.json() as Promise<ChannelDetail>
		},
		enabled: !!channelId,
	})
}

export function channelMessagesQuery(channelId: string, limit = 50, threadId?: string) {
	return queryOptions({
		queryKey: queryKeys.messages.list({ channel: channelId, limit, threadId }),
		queryFn: async (): Promise<ChannelMessage[]> => {
			const res = await api.api.channels[':id'].messages.$get({
				param: { id: channelId },
				query: {
					limit: String(limit),
					...(threadId ? { thread_id: threadId } : {}),
				},
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to fetch messages'))
			}
			return res.json() as Promise<ChannelMessage[]>
		},
		enabled: !!channelId,
	})
}

export function channelMembersQuery(channelId: string) {
	return queryOptions({
		queryKey: queryKeys.channels.list({ members: channelId }),
		queryFn: async (): Promise<ChannelMember[]> => {
			const res = await api.api.channels[':id'].members.$get({
				param: { id: channelId },
			})
			if (!res.ok) throw new Error('Failed to fetch channel members')
			return res.json() as Promise<ChannelMember[]>
		},
		enabled: !!channelId,
	})
}
