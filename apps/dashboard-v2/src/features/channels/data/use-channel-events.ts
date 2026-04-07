import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

interface ChannelEvent {
	type: string
	channel?: string
	channelId?: string
	from?: string
	content?: string
}

/**
 * Subscribe to the global SSE /events stream and invalidate channel-specific
 * queries when relevant events arrive.
 */
export function useChannelEvents(channelId: string | null): void {
	const queryClient = useQueryClient()
	const channelIdRef = useRef(channelId)
	channelIdRef.current = channelId

	useEffect(() => {
		if (!channelId) return

		const eventSource = new EventSource(`${API_BASE}/api/events`, {
			withCredentials: true,
		})

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as ChannelEvent
				if (data.type === 'heartbeat') return

				const eventChannel = data.channel ?? data.channelId
				if (!eventChannel) return

				if (data.type === 'message' && eventChannel === channelIdRef.current) {
					void queryClient.invalidateQueries({
						queryKey: queryKeys.messages.list({ channel: channelIdRef.current }),
					})
				}

				if (data.type === 'channel_member_changed' && eventChannel === channelIdRef.current) {
					void queryClient.invalidateQueries({
						queryKey: queryKeys.channels.detail(channelIdRef.current),
					})
					void queryClient.invalidateQueries({
						queryKey: queryKeys.channels.list({ members: channelIdRef.current }),
					})
				}

				if (data.type === 'channel_created' || data.type === 'channel_deleted') {
					void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
				}

				if (data.type === 'channel_deleted' && eventChannel === channelIdRef.current) {
					// Channel was deleted while viewing — sidebar will handle redirect
					void queryClient.invalidateQueries({ queryKey: queryKeys.channels.root })
				}
			} catch {
				// Ignore malformed events
			}
		}

		// On reconnect, refetch to catch missed events
		eventSource.onerror = () => {
			// EventSource auto-reconnects. On reconnect, onopen fires.
		}

		eventSource.onopen = () => {
			if (channelIdRef.current) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.messages.list({ channel: channelIdRef.current }),
				})
			}
		}

		return () => {
			eventSource.close()
		}
	}, [channelId, queryClient])
}
