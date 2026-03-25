import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const EVENT_TO_QUERY_KEY: Record<string, string[]> = {
	task_changed: ['tasks', 'task', 'inbox', 'status'],
	message: ['chat', 'channels'],
	activity: ['activity'],
	pin_changed: ['pins', 'inbox'],
	agent_session: ['agents', 'status'],
	workflow_advanced: ['tasks', 'task'],
}

export function useRealtime() {
	const queryClient = useQueryClient()
	const abortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		const controller = new AbortController()
		abortRef.current = controller

		async function connect() {
			try {
				const response = await fetch('http://localhost:7778/api/events', {
					signal: controller.signal,
					credentials: 'include',
					headers: { 'Accept': 'text/event-stream' },
				})

				if (!response.ok || !response.body) return

				const reader = response.body.getReader()
				const decoder = new TextDecoder()
				let buffer = ''

				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() ?? ''

					for (const line of lines) {
						if (!line.startsWith('data: ')) continue
						try {
							const event = JSON.parse(line.slice(6))
							const keys = EVENT_TO_QUERY_KEY[event.type] ?? []
							for (const key of keys) {
								queryClient.invalidateQueries({ queryKey: [key] })
							}
						} catch {
							// skip malformed
						}
					}
				}
			} catch (err) {
				if ((err as Error).name === 'AbortError') return
				// Reconnect after 5s on error
				setTimeout(connect, 5000)
			}
		}

		connect()

		return () => {
			controller.abort()
			abortRef.current = null
		}
	}, [queryClient])
}
