import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

function getErrorMessage(body: unknown, fallback: string): string {
	if (typeof body !== 'object' || body === null || !('error' in body)) {
		return fallback
	}
	return typeof body.error === 'string' ? body.error : fallback
}

// ── Create channel ─────────────────────────────────────────────────────────

export function useCreateChannel() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { name: string }) => {
			const res = await api.api.channels.$post({
				json: { name: data.name, type: 'group' },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to create channel'))
			}
			return res.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
		},
	})
}

// ── Create / get DM ────────────────────────────────────────────────────────

export function useCreateDirectMessage() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { actorId: string; actorType: 'human' | 'agent' }) => {
			const res = await api.api.channels.$post({
				json: {
					name: `DM`,
					type: 'direct',
					members: [{ actor_id: data.actorId, actor_type: data.actorType }],
				},
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to create direct message'))
			}
			return res.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
		},
	})
}

// ── Send channel message ───────────────────────────────────────────────────

export interface SendChannelMessageInput {
	channelId: string
	content: string
	threadId?: string
	mentions?: string[]
}

export function useSendChannelMessage() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: SendChannelMessageInput) => {
			const res = await api.api.channels[':id'].messages.$post({
				param: { id: data.channelId },
				json: {
					content: data.content,
					...(data.threadId ? { thread_id: data.threadId } : {}),
					...(data.mentions?.length ? { mentions: data.mentions } : {}),
				},
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to send message'))
			}
			return res.json()
		},
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.messages.list({ channel: variables.channelId }),
			})
			void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
		},
	})
}

// ── Manage members ─────────────────────────────────────────────────────────

export function useManageChannelMembers() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: {
			channelId: string
			add?: Array<{ actor_id: string; actor_type: 'human' | 'agent'; role?: 'owner' | 'member' | 'readonly' }>
			remove?: string[]
		}) => {
			const res = await api.api.channels[':id'].members.$put({
				param: { id: data.channelId },
				json: { add: data.add, remove: data.remove },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to update members'))
			}
			return res.json()
		},
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.channels.detail(variables.channelId),
			})
			void queryClient.invalidateQueries({
				queryKey: queryKeys.channels.list({ members: variables.channelId }),
			})
		},
	})
}

// ── Invite to workspace ────────────────────────────────────────────────────

export function useCreateInvite() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { email: string; role?: 'owner' | 'admin' | 'member' | 'viewer' }) => {
			const res = await api.api.team.humans.invite.$post({
				json: { email: data.email, role: data.role ?? 'member' },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to send invite'))
			}
			return res.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
		},
	})
}

export function useDeleteInvite() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (data: { email: string }) => {
			const res = await api.api.team.humans.invite.$delete({
				json: { email: data.email },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => ({}))
				throw new Error(getErrorMessage(body, 'Failed to remove invite'))
			}
			return res.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.team.root })
		},
	})
}
