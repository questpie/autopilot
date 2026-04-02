import { useEffect, useReducer, useRef } from 'react'
import { api } from '@/lib/api'
import { connectAgentStream } from './transport'
import {
	INITIAL_OFFSET,
	INITIAL_STATE,
	getTerminalStatus,
	normalizeOffset,
	streamReducer,
	type SessionStreamState,
	type StreamChunk,
	type TerminalStatus,
} from './reducer'
import { createOffsetManager, sessionOffsetMemory } from './offset'

// Re-export public types — barrel (index.ts) uses these.
export type { SessionStreamState, StreamBlock, StreamErrorCode } from './reducer'

const SESSION_POLL_INTERVAL_MS = 5_000

// ── Helpers ──────────────────────────────────────────────────────────

function parseSseEvent(raw: string): {
	eventType: string | null
	data: string[]
	id: string | null
} {
	const data: string[] = []
	let id: string | null = null
	let eventType: string | null = null

	for (const line of raw.split('\n')) {
		if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
		else if (line.startsWith('id:')) id = line.slice(3).trimStart()
		else if (line.startsWith('event:')) eventType = line.slice(6).trimStart()
	}

	return { eventType, data, id }
}

interface ControlEvent {
	streamNextOffset?: string
	streamClosed?: boolean
}

async function checkSessionCompleted(sessionId: string): Promise<TerminalStatus | null> {
	try {
		const res = await api.api['chat-sessions'][':id'].$get({ param: { id: sessionId } })
		if (!res.ok) return null
		const session = await res.json()
		if (session.status === 'completed') return 'completed'
		if (session.status === 'failed') return 'error'
		return null
	} catch {
		return null
	}
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useSessionStream(
	sessionId: string | null,
	initialOffset = INITIAL_OFFSET,
): {
	state: SessionStreamState
	cancel: () => void
} {
	const [state, dispatch] = useReducer(streamReducer, INITIAL_STATE)
	const abortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		if (!sessionId) {
			dispatch({ type: 'reset' })
			return
		}

		const controller = new AbortController()
		abortRef.current = controller

		const normalized = normalizeOffset(initialOffset)
		const startOffset =
			normalized !== INITIAL_OFFSET
				? normalized
				: sessionOffsetMemory.get(sessionId) ?? INITIAL_OFFSET

		sessionOffsetMemory.set(sessionId, startOffset)
		dispatch({ type: 'connecting', offset: startOffset })

		const offset = createOffsetManager(sessionId, startOffset)

		// ── SSE connection loop ───────────────────────────────────

		const connect = async () => {
			let currentOffset = startOffset

			while (!controller.signal.aborted) {
				let streamClosed = false
				let nextOffset = currentOffset
				let terminal: TerminalStatus | null = null

				try {
					const { reader, streamNextOffset } = await connectAgentStream(
						sessionId,
						currentOffset,
						controller.signal,
					)

					const decoder = new TextDecoder()
					let buffer = ''
					let lastDataAt = Date.now()
					nextOffset = normalizeOffset(streamNextOffset ?? currentOffset)
					offset.queuePersist(nextOffset)

					// Heartbeat: periodically check session status while SSE is
					// alive but idle — the durable stream may have the completed
					// event but the live SSE push can miss it.
					const heartbeat = setInterval(async () => {
						if (Date.now() - lastDataAt < SESSION_POLL_INTERVAL_MS) return
						const status = await checkSessionCompleted(sessionId)
						if (status) {
							terminal = status
							reader.cancel().catch(() => {})
						}
					}, SESSION_POLL_INTERVAL_MS)

					try {
						while (true) {
							const { done, value } = await reader.read()
							if (done) break

							buffer += decoder.decode(value, { stream: true })
							const events = buffer.split('\n\n')
							buffer = events.pop() ?? ''

							for (const event of events) {
								const parsed = parseSseEvent(event)
								if (parsed.id) {
									nextOffset = normalizeOffset(parsed.id)
									offset.queuePersist(nextOffset)
								}

								if (parsed.data.length === 0) continue

								if (parsed.eventType === 'control') {
									try {
										const ctrl = JSON.parse(parsed.data.join('\n')) as ControlEvent
										if (ctrl.streamNextOffset) {
											nextOffset = normalizeOffset(ctrl.streamNextOffset)
											offset.queuePersist(nextOffset, terminal !== null)
										}
										if (ctrl.streamClosed) streamClosed = true
									} catch { /* malformed control */ }
									continue
								}

								lastDataAt = Date.now()

								try {
									const raw = JSON.parse(parsed.data.join('\n')) as StreamChunk | StreamChunk[]
									const chunks = Array.isArray(raw) ? raw : [raw]
									for (const chunk of chunks) {
										if (chunk.type === 'status' && chunk.content === 'started') {
											terminal = null
										}
										dispatch({ type: 'chunk', chunk, offset: nextOffset })
										terminal = getTerminalStatus(chunk) ?? terminal
									}
								} catch { /* malformed data */ }
							}
						}
					} finally {
						clearInterval(heartbeat)
					}
				} catch (error) {
					if ((error as Error).name === 'AbortError') return

					if (terminal) {
						offset.queuePersist(nextOffset, true)
						return
					}

					// On reconnect failure, retry once after a delay.
					if (currentOffset !== startOffset) {
						await new Promise((r) => setTimeout(r, 1000))
						if (controller.signal.aborted) return
						currentOffset = nextOffset
						continue
					}

					dispatch({ type: 'error', error: error instanceof Error ? error.message : 'Stream error' })
					return
				}

				if (terminal) {
					offset.queuePersist(nextOffset, true)
					dispatch(
						terminal === 'error'
							? { type: 'error', error: 'Session failed' }
							: { type: 'completed' },
					)
					return
				}

				if (streamClosed) {
					offset.queuePersist(nextOffset, true)
					dispatch({ type: 'completed' })
					return
				}

				if (controller.signal.aborted) return

				// Before reconnecting, check if session already completed.
				const polledStatus = await checkSessionCompleted(sessionId)
				if (polledStatus) {
					offset.queuePersist(nextOffset, true)
					if (polledStatus === 'error') {
						dispatch({ type: 'error', error: 'Session failed' })
					} else {
						dispatch({ type: 'completed' })
					}
					return
				}

				currentOffset = nextOffset
			}
		}

		void connect()

		return () => {
			offset.cleanup()
			controller.abort()
		}
	}, [sessionId])

	return {
		state,
		cancel: () => abortRef.current?.abort(),
	}
}
