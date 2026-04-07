import type { ToolCallState } from '../chat.types'

export const INITIAL_OFFSET = '-1'

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

export interface StreamChunk {
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

export type TerminalStatus = 'completed' | 'error'

type StreamAction =
	| { type: 'connecting'; offset: string }
	| { type: 'chunk'; chunk: StreamChunk; offset: string }
	| { type: 'completed' }
	| { type: 'error'; error: string }
	| { type: 'reset' }

export const INITIAL_STATE: SessionStreamState = {
	status: 'idle',
	blocks: [],
	error: null,
	errorCode: null,
	offset: INITIAL_OFFSET,
}

// ── Helpers ──────────────────────────────────────────────────────────

export function normalizeOffset(value: unknown): string {
	if (typeof value !== 'string') return INITIAL_OFFSET
	const trimmed = value.trim()
	return !trimmed || trimmed === '0' ? INITIAL_OFFSET : trimmed
}

export function getTerminalStatus(chunk: StreamChunk): TerminalStatus | null {
	if (chunk.type === 'error') return 'error'
	if (chunk.type === 'status' && (chunk.content === 'completed' || chunk.content === 'error')) {
		return chunk.content
	}
	return null
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

export function streamReducer(state: SessionStreamState, action: StreamAction): SessionStreamState {
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
