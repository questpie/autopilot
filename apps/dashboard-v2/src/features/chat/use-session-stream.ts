import { useEffect, useReducer, useRef } from 'react'
import { api } from '@/lib/api'
import { connectAgentStream } from '@/lib/sse-transport'
import type { ToolCallState } from './chat-message-metadata'

const INITIAL_OFFSET = '-1'
const OFFSET_PERSIST_DEBOUNCE_MS = 250
const SESSION_POLL_INTERVAL_MS = 5_000
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

type TerminalStatus = 'completed' | 'error'

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

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeOffset(value: unknown): string {
	if (typeof value !== 'string') return INITIAL_OFFSET
	const trimmed = value.trim()
	return !trimmed || trimmed === '0' ? INITIAL_OFFSET : trimmed
}

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

function getTerminalStatus(chunk: StreamChunk): TerminalStatus | null {
	if (chunk.type === 'error') return 'error'
	if (chunk.type === 'status' && (chunk.content === 'completed' || chunk.content === 'error')) {
		return chunk.content
	}
	return null
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

async function persistOffset(sessionId: string, offset: string): Promise<string | null> {
	try {
		const res = await api.api['chat-sessions'][':id']['stream-offset'].$patch({
			param: { id: sessionId },
			json: { offset },
		})
		if (!res.ok) return null
		const body = await res.json().catch(() => null)
		return normalizeOffset((body as { streamOffset?: string } | null)?.streamOffset ?? offset)
	} catch {
		return null
	}
}

// ── Block helpers ────────────────────────────────────────────────────

function appendTextDelta(blocks: StreamBlock[], delta: string): StreamBlock[] {
	const last = blocks[blocks.length - 1]
	if (last?.kind === 'text') {
		const updated = [...blocks]
		updated[updated.length - 1] = { kind: 'text', content: last.content + delta }
		return updated
	}
	return [...blocks, { kind: 'text', content: delta }]
}

function setFullText(blocks: StreamBlock[], text: string): StreamBlock[] {
	if (blocks.some((b) => b.kind === 'text')) return blocks
	return [...blocks, { kind: 'text', content: text }]
}

function appendOrUpdateThinking(blocks: StreamBlock[], content: string | null): StreamBlock[] {
	if (!content) return blocks
	const last = blocks[blocks.length - 1]
	if (last?.kind === 'thinking') {
		const updated = [...blocks]
		updated[updated.length - 1] = { kind: 'thinking', content }
		return updated
	}
	return [...blocks, { kind: 'thinking', content }]
}

function updateToolCall(blocks: StreamBlock[], chunk: StreamChunk): StreamBlock[] {
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
				status: chunk.tool === 'error' ? ('error' as const) : ('completed' as const),
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
			return { ...INITIAL_STATE, status: 'connecting', offset: action.offset }

		case 'chunk': {
			const base: SessionStreamState = {
				...state,
				status: 'streaming',
				offset: action.offset,
				error: null,
				errorCode: null,
			}

			switch (action.chunk.type) {
				case 'text_delta':
					return { ...base, blocks: appendTextDelta(state.blocks, action.chunk.content ?? '') }
				case 'text':
					return { ...base, blocks: setFullText(state.blocks, action.chunk.content ?? '') }
				case 'thinking':
					return { ...base, blocks: appendOrUpdateThinking(state.blocks, action.chunk.content ?? null) }
				case 'tool_call':
					return {
						...base,
						blocks: [
							...state.blocks,
							{
								kind: 'tool_call',
								toolCall: {
									id: action.chunk.toolCallId ?? `tool-${action.offset}-${action.chunk.at}-${action.chunk.tool ?? 'unknown'}`,
									tool: action.chunk.tool ?? 'unknown',
									toolCallId: action.chunk.toolCallId,
									params: action.chunk.params,
									displayLabel: action.chunk.displayLabel,
									displayMeta: action.chunk.displayMeta,
									status: 'running',
									startedAt: action.chunk.at,
								},
							},
						],
					}
				case 'tool_result':
					return { ...base, blocks: updateToolCall(state.blocks, action.chunk) }
				case 'status':
					if (action.chunk.content === 'started') {
						return { ...base, blocks: [], error: null }
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
					return base
				case 'error':
					return {
						...base,
						status: 'error',
						error: action.chunk.content ?? 'Unknown error',
						errorCode: action.chunk.errorCode ?? 'unknown',
					}
				default:
					return base
			}
		}

		case 'completed':
			return { ...state, status: 'completed' }
		case 'error':
			return { ...state, status: 'error', error: action.error, errorCode: 'unknown' }
		case 'reset':
			return INITIAL_STATE
		default:
			return state
	}
}

// ── Hook ─────────────────────────────────────────────────────────────

interface ControlEvent {
	streamNextOffset?: string
	streamClosed?: boolean
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
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingOffsetRef = useRef<string | null>(null)
	const persistedOffsetRef = useRef(INITIAL_OFFSET)

	useEffect(() => {
		if (!sessionId) {
			if (persistTimerRef.current) {
				clearTimeout(persistTimerRef.current)
				persistTimerRef.current = null
			}
			pendingOffsetRef.current = null
			persistedOffsetRef.current = INITIAL_OFFSET
			dispatch({ type: 'reset' })
			return
		}

		const controller = new AbortController()
		abortRef.current = controller

		const startOffset = normalizeOffset(initialOffset) !== INITIAL_OFFSET
			? normalizeOffset(initialOffset)
			: sessionOffsetMemory.get(sessionId) ?? INITIAL_OFFSET

		sessionOffsetMemory.set(sessionId, startOffset)
		persistedOffsetRef.current = startOffset
		pendingOffsetRef.current = null
		dispatch({ type: 'connecting', offset: startOffset })

		// ── Offset persistence (debounced) ────────────────────────

		const flushOffset = async (_keepalive = false): Promise<void> => {
			const next = pendingOffsetRef.current
			if (!next || next === persistedOffsetRef.current) {
				pendingOffsetRef.current = null
				return
			}

			const confirmed = await persistOffset(sessionId, next)
			if (!confirmed) return

			persistedOffsetRef.current = confirmed
			sessionOffsetMemory.set(sessionId, confirmed)
			if (pendingOffsetRef.current === next) pendingOffsetRef.current = null

			// If more offsets queued while we were persisting, schedule another flush.
			if (pendingOffsetRef.current && pendingOffsetRef.current !== persistedOffsetRef.current && !persistTimerRef.current) {
				persistTimerRef.current = setTimeout(() => {
					persistTimerRef.current = null
					void flushOffset()
				}, OFFSET_PERSIST_DEBOUNCE_MS)
			}
		}

		const queuePersist = (value: string, immediate = false): void => {
			const normalized = normalizeOffset(value)
			if (normalized === INITIAL_OFFSET || normalized === persistedOffsetRef.current) return

			pendingOffsetRef.current = normalized
			sessionOffsetMemory.set(sessionId, normalized)

			if (immediate) {
				if (persistTimerRef.current) {
					clearTimeout(persistTimerRef.current)
					persistTimerRef.current = null
				}
				void flushOffset(true)
				return
			}

			if (!persistTimerRef.current) {
				persistTimerRef.current = setTimeout(() => {
					persistTimerRef.current = null
					void flushOffset()
				}, OFFSET_PERSIST_DEBOUNCE_MS)
			}
		}

		// ── Pagehide flush ────────────────────────────────────────

		const handlePageHide = (): void => {
			if (pendingOffsetRef.current && pendingOffsetRef.current !== persistedOffsetRef.current) {
				void flushOffset(true)
			}
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('pagehide', handlePageHide)
		}

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
					queuePersist(nextOffset)

					// Heartbeat: periodically check session status while SSE is
					// alive but idle — the durable stream may have the completed
					// event but the live SSE push can miss it.
					const heartbeat = setInterval(async () => {
						if (Date.now() - lastDataAt < SESSION_POLL_INTERVAL_MS) return
						const status = await checkSessionCompleted(sessionId)
						if (status) {
							terminal = status
							// Reader.cancel() will cause reader.read() to return done=true.
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
									queuePersist(nextOffset)
								}

								if (parsed.data.length === 0) continue

								if (parsed.eventType === 'control') {
									try {
										const ctrl = JSON.parse(parsed.data.join('\n')) as ControlEvent
										if (ctrl.streamNextOffset) {
											nextOffset = normalizeOffset(ctrl.streamNextOffset)
											queuePersist(nextOffset, terminal !== null)
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
						queuePersist(nextOffset, true)
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
					queuePersist(nextOffset, true)
					if (terminal === 'error') {
						dispatch({ type: 'error', error: 'Session failed' })
					}
					return
				}

				if (streamClosed) {
					queuePersist(nextOffset, true)
					dispatch({ type: 'completed' })
					return
				}

				if (controller.signal.aborted) return

				// Before reconnecting, check if session already completed.
				const polledStatus = await checkSessionCompleted(sessionId)
				if (polledStatus) {
					queuePersist(nextOffset, true)
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
			if (typeof window !== 'undefined') {
				window.removeEventListener('pagehide', handlePageHide)
			}
			if (persistTimerRef.current) {
				clearTimeout(persistTimerRef.current)
				persistTimerRef.current = null
			}
			if (pendingOffsetRef.current && pendingOffsetRef.current !== persistedOffsetRef.current) {
				void flushOffset(true)
			}
			controller.abort()
		}
	}, [sessionId])

	return {
		state,
		cancel: () => abortRef.current?.abort(),
	}
}
