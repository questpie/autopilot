import { useEffect, useReducer, useRef } from 'react'
import { API_BASE } from '@/lib/api'

const INITIAL_OFFSET = '-1'

export interface ToolCallState {
	id: string
	tool: string
	toolCallId?: string
	params?: Record<string, unknown>
	status: 'running' | 'completed' | 'error'
	result?: string
	startedAt: number
	completedAt?: number
}

export interface SessionStreamState {
	status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error'
	text: string
	toolCalls: ToolCallState[]
	thinkingText: string | null
	error: string | null
	offset: string
}

interface StreamChunk {
	at: number
	type: 'thinking' | 'text' | 'text_delta' | 'tool_call' | 'tool_result' | 'error' | 'status'
	content?: string
	tool?: string
	toolCallId?: string
	params?: Record<string, unknown>
}

type StreamAction =
	| { type: 'hydrate'; state: SessionStreamState }
	| { type: 'connecting'; offset: string; retainState: boolean }
	| { type: 'chunk'; chunk: StreamChunk; offset: string }
	| { type: 'completed' }
	| { type: 'error'; error: string }
	| { type: 'reset' }

const INITIAL_STATE: SessionStreamState = {
	status: 'idle',
	text: '',
	toolCalls: [],
	thinkingText: null,
	error: null,
	offset: INITIAL_OFFSET,
}

function storageKey(sessionId: string): string {
	return `chat-stream-state:${sessionId}`
}

function readPersistedState(sessionId: string): SessionStreamState | null {
	if (typeof window === 'undefined') return null
	const raw = window.sessionStorage.getItem(storageKey(sessionId))
	if (!raw) return null

	try {
		const parsed = JSON.parse(raw) as Partial<SessionStreamState>
		return {
			...INITIAL_STATE,
			...parsed,
			offset: normalizeOffset(parsed.offset),
		}
	} catch {
		return null
	}
}

function normalizeOffset(value: unknown): string {
	if (typeof value !== 'string') {
		return INITIAL_OFFSET
	}

	const offset = value.trim()
	if (!offset || /^\d+$/.test(offset)) {
		return INITIAL_OFFSET
	}

	return offset
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

function persistState(sessionId: string, state: SessionStreamState): void {
	if (typeof window === 'undefined') return
	const persistedState =
		state.status === 'connecting' ||
		state.status === 'streaming' ||
		(state.status === 'error' &&
			(!!state.text || state.toolCalls.length > 0 || !!state.thinkingText))
			? state
			: {
					...INITIAL_STATE,
					offset: state.offset,
				}
	window.sessionStorage.setItem(storageKey(sessionId), JSON.stringify(persistedState))
}

function streamReducer(state: SessionStreamState, action: StreamAction): SessionStreamState {
	switch (action.type) {
		case 'hydrate':
			return action.state
		case 'connecting':
			if (action.retainState) {
				return {
					...state,
					status:
						state.offset !== INITIAL_OFFSET || state.text || state.toolCalls.length > 0
							? 'streaming'
							: 'connecting',
					offset: action.offset,
					error: null,
				}
			}
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
			}

			switch (action.chunk.type) {
				case 'text_delta':
					nextState.text = `${state.text}${action.chunk.content ?? ''}`
					return nextState
				case 'text':
					// Skip the final aggregated text event when we already have
					// incrementally-streamed content — avoids a visual "jump".
					if (state.text) return nextState
					nextState.text = action.chunk.content ?? state.text
					return nextState
				case 'thinking':
					nextState.thinkingText = action.chunk.content ?? null
					return nextState
				case 'tool_call':
					nextState.toolCalls = [
						...state.toolCalls,
						{
							id:
								action.chunk.toolCallId ??
								`tool-${action.offset}-${action.chunk.at}-${action.chunk.tool ?? 'unknown'}`,
							tool: action.chunk.tool ?? 'unknown',
							toolCallId: action.chunk.toolCallId,
							params: action.chunk.params,
							status: 'running',
							startedAt: action.chunk.at,
						},
					]
					return nextState
				case 'tool_result':
					nextState.toolCalls = state.toolCalls.map((toolCall) => {
						if (
							(action.chunk.toolCallId && toolCall.toolCallId === action.chunk.toolCallId) ||
							(!action.chunk.toolCallId &&
								toolCall.tool === action.chunk.tool &&
								toolCall.status === 'running')
						) {
							return {
								...toolCall,
								status: action.chunk.tool === 'error' ? 'error' : 'completed',
								result: action.chunk.content ?? '',
								completedAt: action.chunk.at,
							}
						}

						return toolCall
					})
					return nextState
				case 'status':
					if (action.chunk.content === 'started') {
						// New run started — reset per-run state so replayed history doesn't bleed in.
						return {
							...nextState,
							text: '',
							toolCalls: [],
							thinkingText: null,
							error: null,
						}
					}
					if (action.chunk.content === 'completed') {
						return { ...state, status: 'completed', thinkingText: null, offset: action.offset }
					}
					return nextState
				case 'error':
					nextState.status = 'error'
					nextState.error = action.chunk.content ?? 'Unknown error'
					return nextState
				default:
					return nextState
			}
		}
		case 'completed':
			return {
				...state,
				status: 'completed',
				thinkingText: null,
			}
		case 'error':
			return {
				...state,
				status: 'error',
				error: action.error,
			}
		case 'reset':
			return INITIAL_STATE
		default:
			return state
	}
}

export function useSessionStream(sessionId: string | null): {
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

		const hydrated = readPersistedState(sessionId)
		if (hydrated) {
			dispatch({ type: 'hydrate', state: hydrated })
		}

		const controller = new AbortController()
		abortRef.current = controller

		const offset = normalizeOffset(hydrated?.offset)
		const canResumeFromOffset = hydrated ? offset !== INITIAL_OFFSET : false
		const retainState =
			canResumeFromOffset &&
			(hydrated?.status === 'connecting' ||
				hydrated?.status === 'streaming' ||
				(hydrated?.status === 'error' &&
					(!!hydrated.text || hydrated.toolCalls.length > 0 || !!hydrated.thinkingText)))
		dispatch({ type: 'connecting', offset, retainState })

		const connect = async () => {
			let currentOffset = offset

			// Durable Streams servers periodically close SSE connections (~60s).
			// We reconnect transparently using the last streamNextOffset.
			// Only stop when the stream signals streamClosed or we're aborted.
			while (!controller.signal.aborted) {
				let streamClosed = false
				let nextOffset = currentOffset

				try {
					const response = await fetch(
						`${API_BASE}/api/agent-sessions/${encodeURIComponent(sessionId)}/stream?live=sse&offset=${currentOffset}`,
						{
							credentials: 'include',
							signal: controller.signal,
							headers: {
								Accept: 'text/event-stream',
							},
						},
					)

					if (!response.ok) {
						const body = await response.text().catch(() => '')
						throw new Error(body || `HTTP ${response.status}`)
					}

					const reader = response.body?.getReader()
					if (!reader) {
						throw new Error('No response body')
					}

					const decoder = new TextDecoder()
					let buffer = ''
					nextOffset = normalizeOffset(
						response.headers.get('Stream-Next-Offset') ?? currentOffset,
					)

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
							}

							if (parsedEvent.data.length === 0) continue

							// Handle control events from Durable Streams protocol.
							if (parsedEvent.eventType === 'control') {
								try {
									const ctrl = JSON.parse(
										parsedEvent.data.join('\n'),
									) as ControlEvent
									if (ctrl.streamNextOffset) {
										nextOffset = normalizeOffset(ctrl.streamNextOffset)
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
									dispatch({ type: 'chunk', chunk, offset: nextOffset })
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

					dispatch({
						type: 'error',
						error: error instanceof Error ? error.message : 'Stream error',
					})
					return
				}

				if (streamClosed) {
					dispatch({ type: 'completed' })
					return
				}

				// Server closed the SSE connection for rotation — reconnect from where we left off.
				currentOffset = nextOffset
			}
		}

		void connect()

		return () => {
			controller.abort()
		}
	}, [sessionId])

	useEffect(() => {
		if (!sessionId) return
		persistState(sessionId, state)
	}, [sessionId, state])

	return {
		state,
		cancel: () => abortRef.current?.abort(),
	}
}
