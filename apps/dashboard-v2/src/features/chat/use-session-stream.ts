import { useEffect, useReducer, useRef } from 'react'
import { api } from '@/lib/api'
import { connectAgentStream } from '@/lib/sse-transport'
import type { ToolCallState } from './chat-message-metadata'

const INITIAL_OFFSET = '-1'
const STREAM_OFFSET_PERSIST_DEBOUNCE_MS = 250
const sessionOffsetMemory = new Map<string, string>()

export type StreamErrorCode = 'rate_limit' | 'auth' | 'network' | 'provider' | 'budget' | 'unknown'

// ── Chronological block model ────────────────────────────────────────

export type StreamBlock =
	| { kind: 'text'; content: string }
	| { kind: 'thinking'; content: string }
	| { kind: 'tool_call'; toolCall: ToolCallState }

export interface SessionStreamState {
	status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error'
	blocks: StreamBlock[]
	error: string | null
	errorCode: StreamErrorCode | null
	offset: string
}

interface StreamChunk {
	at: number
	type: 'thinking' | 'text' | 'text_delta' | 'tool_call' | 'tool_result' | 'error' | 'status'
	content?: string
	tool?: string
	toolCallId?: string
	params?: Record<string, unknown>
	displayLabel?: string
	displayMeta?: string
	errorCode?: StreamErrorCode
}

type TerminalStreamStatus = Extract<SessionStreamState['status'], 'completed' | 'error'>

type StreamAction =
	| { type: 'connecting'; offset: string }
	| { type: 'chunk'; chunk: StreamChunk; offset: string }
	| { type: 'completed' }
	| { type: 'error'; error: string }
	| { type: 'reset' }

const INITIAL_STATE: SessionStreamState = {
	status: 'idle',
	blocks: [],
	error: null,
	errorCode: null,
	offset: INITIAL_OFFSET,
}

function normalizeOffset(value: unknown): string {
	if (typeof value !== 'string') {
		return INITIAL_OFFSET
	}

	const offset = value.trim()
	if (!offset || offset === '0') {
		return INITIAL_OFFSET
	}

	return offset
}

async function persistSessionOffset(
	sessionId: string,
	offset: string,
	_keepalive = false,
): Promise<string | null> {
	try {
		const response = await api.api['chat-sessions'][':id']['stream-offset'].$patch({
			param: { id: sessionId },
			json: { offset },
		})

		if (!response.ok) {
			return null
		}

		const body = await response.json().catch(() => null)
		return normalizeOffset((body as { streamOffset?: string } | null)?.streamOffset ?? offset)
	} catch {
		return null
	}
}

function getResumeOffset(sessionId: string, initialOffset: string): string {
	if (initialOffset !== INITIAL_OFFSET) {
		return initialOffset
	}

	return sessionOffsetMemory.get(sessionId) ?? INITIAL_OFFSET
}

function parseSseEvent(event: string): {
	eventType: string | null
	data: string[]
	id: string | null
} {
	const data: string[] = []
	let id: string | null = null
	let eventType: string | null = null

	for (const line of event.split('\n')) {
		if (line.startsWith('data:')) {
			data.push(line.slice(5).trimStart())
			continue
		}

		if (line.startsWith('id:')) {
			id = line.slice(3).trimStart()
			continue
		}

		if (line.startsWith('event:')) {
			eventType = line.slice(6).trimStart()
		}
	}

	return { eventType, data, id }
}

interface ControlEvent {
	streamNextOffset?: string
	streamCursor?: string
	upToDate?: boolean
	streamClosed?: boolean
}

function getTerminalStreamStatus(chunk: StreamChunk): TerminalStreamStatus | null {
	if (chunk.type === 'error') {
		return 'error'
	}

	if (
		chunk.type === 'status' &&
		(chunk.content === 'completed' || chunk.content === 'error')
	) {
		return chunk.content
	}

	return null
}

// ── Block helpers ────────────────────────────────────────────────────

function lastBlock(blocks: StreamBlock[]): StreamBlock | undefined {
	return blocks[blocks.length - 1]
}

function appendTextDelta(blocks: StreamBlock[], delta: string): StreamBlock[] {
	const last = lastBlock(blocks)
	if (last?.kind === 'text') {
		const updated = [...blocks]
		updated[updated.length - 1] = { kind: 'text', content: last.content + delta }
		return updated
	}
	return [...blocks, { kind: 'text', content: delta }]
}

function setFullText(blocks: StreamBlock[], text: string): StreamBlock[] {
	// If we already have text blocks from deltas, don't overwrite
	if (blocks.some((b) => b.kind === 'text')) return blocks
	return [...blocks, { kind: 'text', content: text }]
}

function appendOrUpdateThinking(blocks: StreamBlock[], content: string | null): StreamBlock[] {
	if (!content) return blocks
	const last = lastBlock(blocks)
	if (last?.kind === 'thinking') {
		const updated = [...blocks]
		updated[updated.length - 1] = { kind: 'thinking', content }
		return updated
	}
	return [...blocks, { kind: 'thinking', content }]
}

function appendToolCall(blocks: StreamBlock[], toolCall: ToolCallState): StreamBlock[] {
	return [...blocks, { kind: 'tool_call', toolCall }]
}

function updateToolCall(
	blocks: StreamBlock[],
	chunk: StreamChunk,
): StreamBlock[] {
	return blocks.map((block) => {
		if (block.kind !== 'tool_call') return block
		const tc = block.toolCall
		const matches =
			(chunk.toolCallId && tc.toolCallId === chunk.toolCallId) ||
			(!chunk.toolCallId && tc.tool === chunk.tool && tc.status === 'running')
		if (!matches) return block
		return {
			kind: 'tool_call' as const,
			toolCall: {
				...tc,
				displayLabel: chunk.displayLabel ?? tc.displayLabel,
				displayMeta: chunk.displayMeta ?? tc.displayMeta,
				status: chunk.tool === 'error' ? 'error' as const : 'completed' as const,
				result: chunk.content ?? '',
				completedAt: chunk.at,
			},
		}
	})
}

// ── Reducer ──────────────────────────────────────────────────────────

function streamReducer(state: SessionStreamState, action: StreamAction): SessionStreamState {
	switch (action.type) {
		case 'connecting':
			return {
				...INITIAL_STATE,
				status: 'connecting',
				offset: action.offset,
			}
		case 'chunk': {
			const nextState: SessionStreamState = {
				...state,
				status: 'streaming',
				offset: action.offset,
				error: null,
				errorCode: null,
			}

			switch (action.chunk.type) {
				case 'text_delta':
					return { ...nextState, blocks: appendTextDelta(state.blocks, action.chunk.content ?? '') }
				case 'text':
					return { ...nextState, blocks: setFullText(state.blocks, action.chunk.content ?? '') }
				case 'thinking':
					return { ...nextState, blocks: appendOrUpdateThinking(state.blocks, action.chunk.content ?? null) }
				case 'tool_call':
					return {
						...nextState,
						blocks: appendToolCall(state.blocks, {
							id:
								action.chunk.toolCallId ??
								`tool-${action.offset}-${action.chunk.at}-${action.chunk.tool ?? 'unknown'}`,
							tool: action.chunk.tool ?? 'unknown',
							toolCallId: action.chunk.toolCallId,
							params: action.chunk.params,
							displayLabel: action.chunk.displayLabel,
							displayMeta: action.chunk.displayMeta,
							status: 'running',
							startedAt: action.chunk.at,
						}),
					}
				case 'tool_result':
					return { ...nextState, blocks: updateToolCall(state.blocks, action.chunk) }
				case 'status':
					if (action.chunk.content === 'started') {
						return {
							...nextState,
							blocks: [],
							error: null,
						}
					}
					if (action.chunk.content === 'completed') {
						return { ...state, status: 'completed', offset: action.offset }
					}
					if (action.chunk.content === 'error') {
						return {
							...state,
							status: 'error',
							error: state.error ?? 'Unknown error',
							errorCode: state.errorCode ?? 'unknown',
							offset: action.offset,
						}
					}
					return nextState
				case 'error':
					return {
						...nextState,
						status: 'error',
						error: action.chunk.content ?? 'Unknown error',
						errorCode: action.chunk.errorCode ?? 'unknown',
					}
				default:
					return nextState
			}
		}
		case 'completed':
			return {
				...state,
				status: 'completed',
			}
		case 'error':
			return {
				...state,
				status: 'error',
				error: action.error,
				errorCode: 'unknown',
			}
		case 'reset':
			return INITIAL_STATE
		default:
			return state
	}
}

export function useSessionStream(
	sessionId: string | null,
	initialOffset = INITIAL_OFFSET,
): {
	state: SessionStreamState
	cancel: () => void
} {
	const [state, dispatch] = useReducer(streamReducer, INITIAL_STATE)
	const abortRef = useRef<AbortController | null>(null)
	const offsetPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingOffsetRef = useRef<string | null>(null)
	const persistedOffsetRef = useRef(INITIAL_OFFSET)

	useEffect(() => {
		if (!sessionId) {
			if (offsetPersistTimerRef.current) {
				clearTimeout(offsetPersistTimerRef.current)
				offsetPersistTimerRef.current = null
			}
			pendingOffsetRef.current = null
			persistedOffsetRef.current = INITIAL_OFFSET
			dispatch({ type: 'reset' })
			return
		}

		const controller = new AbortController()
		abortRef.current = controller

		const offset = getResumeOffset(sessionId, normalizeOffset(initialOffset))
		sessionOffsetMemory.set(sessionId, offset)
		persistedOffsetRef.current = offset
		pendingOffsetRef.current = null
		dispatch({ type: 'connecting', offset })

		const flushPendingOffset = async (keepalive = false): Promise<void> => {
			const nextOffset = pendingOffsetRef.current
			if (!nextOffset || nextOffset === persistedOffsetRef.current) {
				pendingOffsetRef.current = null
				return
			}

			const confirmedOffset = await persistSessionOffset(sessionId, nextOffset, keepalive)
			if (!confirmedOffset) {
				return
			}

			persistedOffsetRef.current = confirmedOffset
			sessionOffsetMemory.set(sessionId, confirmedOffset)
			if (pendingOffsetRef.current === nextOffset) {
				pendingOffsetRef.current = null
			}

			if (
				pendingOffsetRef.current &&
				pendingOffsetRef.current !== persistedOffsetRef.current &&
				!offsetPersistTimerRef.current
			) {
				offsetPersistTimerRef.current = setTimeout(() => {
					offsetPersistTimerRef.current = null
					void flushPendingOffset()
				}, STREAM_OFFSET_PERSIST_DEBOUNCE_MS)
			}
		}

		const queueOffsetPersist = (offsetValue: string, immediate = false): void => {
			const normalizedOffset = normalizeOffset(offsetValue)
			if (
				normalizedOffset === INITIAL_OFFSET ||
				normalizedOffset === persistedOffsetRef.current
			) {
				return
			}

			pendingOffsetRef.current = normalizedOffset
			sessionOffsetMemory.set(sessionId, normalizedOffset)

			if (immediate) {
				if (offsetPersistTimerRef.current) {
					clearTimeout(offsetPersistTimerRef.current)
					offsetPersistTimerRef.current = null
				}
				void flushPendingOffset(true)
				return
			}

			if (offsetPersistTimerRef.current) {
				return
			}

			offsetPersistTimerRef.current = setTimeout(() => {
				offsetPersistTimerRef.current = null
				void flushPendingOffset()
			}, STREAM_OFFSET_PERSIST_DEBOUNCE_MS)
		}

		const handlePageHide = (): void => {
			if (pendingOffsetRef.current && pendingOffsetRef.current !== persistedOffsetRef.current) {
				void flushPendingOffset(true)
			}
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('pagehide', handlePageHide)
		}

		const connect = async () => {
			let currentOffset = offset

			while (!controller.signal.aborted) {
				let streamClosed = false
				let nextOffset = currentOffset
				let terminalStatus: TerminalStreamStatus | null = null

				try {
					const { reader, streamNextOffset } = await connectAgentStream(
						sessionId,
						currentOffset,
						controller.signal,
					)

					const decoder = new TextDecoder()
					let buffer = ''
					nextOffset = normalizeOffset(streamNextOffset ?? currentOffset)
					queueOffsetPersist(nextOffset)

					while (true) {
						const { done, value } = await reader.read()
						if (done) break

						buffer += decoder.decode(value, { stream: true })
						const events = buffer.split('\n\n')
						buffer = events.pop() ?? ''

						for (const event of events) {
							const parsedEvent = parseSseEvent(event)
							if (parsedEvent.id) {
								nextOffset = normalizeOffset(parsedEvent.id)
								queueOffsetPersist(nextOffset)
							}

							if (parsedEvent.data.length === 0) continue

							if (parsedEvent.eventType === 'control') {
								try {
									const ctrl = JSON.parse(
										parsedEvent.data.join('\n'),
									) as ControlEvent
									if (ctrl.streamNextOffset) {
										nextOffset = normalizeOffset(ctrl.streamNextOffset)
										queueOffsetPersist(
											nextOffset,
											terminalStatus !== null,
										)
									}
									if (ctrl.streamClosed) {
										streamClosed = true
									}
								} catch {
									// Malformed control event — ignore.
								}
								continue
							}

							try {
								const raw = JSON.parse(parsedEvent.data.join('\n')) as
									| StreamChunk
									| StreamChunk[]
									const chunks = Array.isArray(raw) ? raw : [raw]
									for (const chunk of chunks) {
										if (chunk.type === 'status' && chunk.content === 'started') {
											terminalStatus = null
										}
										dispatch({ type: 'chunk', chunk, offset: nextOffset })

										const nextTerminalStatus = getTerminalStreamStatus(chunk)
										if (nextTerminalStatus) {
											terminalStatus = nextTerminalStatus
										}
									}
							} catch {
								// Ignore malformed data chunks.
							}
						}
					}
				} catch (error) {
					if ((error as Error).name === 'AbortError') {
						return
					}
					// If the stream previously delivered a terminal status chunk,
					// we're done regardless of the connection error.
					if (terminalStatus) {
						queueOffsetPersist(nextOffset, true)
						return
					}

					// Connection error on reconnect — don't immediately give up.
					// The agent may have completed and the durable stream closed.
					// Try one more reconnect; if that also fails, report error.
					if (currentOffset !== offset) {
						// We've already received data — this is a reconnect failure.
						// Wait briefly and retry once more before giving up.
						await new Promise((r) => setTimeout(r, 1000))
						if (controller.signal.aborted) return
						currentOffset = nextOffset
						continue
					}

					dispatch({
						type: 'error',
						error: error instanceof Error ? error.message : 'Stream error',
					})
					return
				}

				// Stream reader finished (done=true).
				// If we saw a terminal status chunk, we're done.
				if (terminalStatus) {
					queueOffsetPersist(nextOffset, true)
					return
				}

				// If the server signaled stream closed (no more data ever), complete.
				if (streamClosed) {
					queueOffsetPersist(nextOffset, true)
					dispatch({ type: 'completed' })
					return
				}

				if (controller.signal.aborted) {
					return
				}

				// Server closed the SSE connection for rotation — reconnect from where we left off.
				currentOffset = nextOffset
			}
		}

		void connect()

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('pagehide', handlePageHide)
			}
			if (offsetPersistTimerRef.current) {
				clearTimeout(offsetPersistTimerRef.current)
				offsetPersistTimerRef.current = null
			}
			if (pendingOffsetRef.current && pendingOffsetRef.current !== persistedOffsetRef.current) {
				void flushPendingOffset(true)
			}
			controller.abort()
		}
	}, [sessionId])

	return {
		state,
		cancel: () => abortRef.current?.abort(),
	}
}
