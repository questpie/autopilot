import { toast } from '@/hooks/use-toast'
import { REFETCH, apiFetch, apiPost, queryKeys } from '@/lib/api'
import type { ChannelInfo } from '@/lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface FsEntry {
	name: string
	type: string
}

async function fetchChannels(): Promise<ChannelInfo[]> {
	try {
		const dirs = await apiFetch<FsEntry[]>('/fs/comms/channels')
		return dirs
			.filter((d) => d.type === 'directory')
			.map((d) => ({
				id: d.name,
				name: d.name,
				type: d.name.includes('--') ? ('direct' as const) : ('channel' as const),
				unread: 0,
			}))
	} catch {
		return [
			{ id: 'general', name: 'general', type: 'channel', unread: 0 },
			{ id: 'dev', name: 'dev', type: 'channel', unread: 0 },
			{ id: 'ops', name: 'ops', type: 'channel', unread: 0 },
		]
	}
}

export function useChannels() {
	return useQuery({
		queryKey: queryKeys.channels,
		queryFn: fetchChannels,
		refetchInterval: REFETCH.channels,
	})
}

export function useCreateChannel() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (name: string) => apiPost<{ ok: boolean }>('/api/channels', { name }),
		onSuccess: () => {
			toast('Channel created', 'success')
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.channels })
		},
	})
}
