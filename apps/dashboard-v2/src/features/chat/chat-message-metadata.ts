import type { Message } from './chat.types'

export interface ToolCallState {
	id: string
	tool: string
	toolCallId?: string
	params?: Record<string, unknown>
	displayLabel?: string
	displayMeta?: string
	status: 'running' | 'completed' | 'error'
	result?: string
	startedAt: number
	completedAt?: number
}

export interface ToolCallDisplay {
	label: string
	detail?: string
	path?: string
	params?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getStringValue(record: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = record[key]
		if (typeof value === 'string') {
			const trimmed = value.trim()
			if (trimmed) {
				return trimmed
			}
		}
	}

	return undefined
}

function parseToolCallState(value: unknown): ToolCallState | null {
	if (!isRecord(value) || typeof value.id !== 'string' || typeof value.tool !== 'string') {
		return null
	}

	const status = value.status
	if (status !== 'running' && status !== 'completed' && status !== 'error') {
		return null
	}

	return {
		id: value.id,
		tool: value.tool,
		toolCallId: typeof value.toolCallId === 'string' ? value.toolCallId : undefined,
		params: isRecord(value.params) ? value.params : undefined,
		displayLabel: typeof value.displayLabel === 'string' ? value.displayLabel : undefined,
		displayMeta: typeof value.displayMeta === 'string' ? value.displayMeta : undefined,
		status,
		result: typeof value.result === 'string' ? value.result : undefined,
		startedAt: normalizeNumber(value.startedAt) ?? Date.now(),
		completedAt: normalizeNumber(value.completedAt),
	}
}

export function getMessageToolCalls(message: Pick<Message, 'metadata'>): ToolCallState[] {
	const rawToolCalls = message.metadata?.toolCalls
	if (!Array.isArray(rawToolCalls)) {
		return []
	}

	return rawToolCalls
		.map((toolCall) => parseToolCallState(toolCall))
		.filter((toolCall): toolCall is ToolCallState => !!toolCall)
}

export function getMessageRunError(message: Pick<Message, 'metadata'>): string | null {
	const value = message.metadata?.error
	return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const PATH_PARAM_KEYS = ['path', 'file_path', 'filePath', 'targetPath', 'target']
const QUERY_PARAM_KEYS = ['query', 'pattern', 'q', 'term', 'needle', 'text']
const COMMAND_PARAM_KEYS = ['command', 'cmd', 'script']

function normalizePath(path: string): string {
	return path.replace(/^\/+/, '').trim()
}

function getToolCallPath(params?: Record<string, unknown>): string | undefined {
	if (!params) return undefined
	return getStringValue(params, PATH_PARAM_KEYS)?.replace(/^\/+/, '')
}

function getToolCallQuery(params?: Record<string, unknown>): string | undefined {
	if (!params) return undefined
	return getStringValue(params, QUERY_PARAM_KEYS)
}

function getToolCallCommand(params?: Record<string, unknown>): string | undefined {
	if (!params) return undefined
	return getStringValue(params, COMMAND_PARAM_KEYS)
}

function truncateText(value: string, maxLength = 120): string {
	if (value.length <= maxLength) {
		return value
	}

	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function humanizeToken(value: string): string {
	return value
		.replace(/\.[a-z0-9]+$/i, '')
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function splitPath(path: string): string[] {
	return normalizePath(path)
		.split('/')
		.map((segment) => segment.trim())
		.filter(Boolean)
}

function describePathTarget(path: string): string {
	const segments = splitPath(path)
	if (segments.length === 0) {
		return 'file'
	}

	const [first, second] = segments
	const filename = segments[segments.length - 1] ?? ''
	const stem = humanizeToken(filename)

	if (normalizePath(path) === 'company.yaml') {
		return 'company config'
	}

	if (first === 'knowledge') {
		return 'knowledge document'
	}

	if (first === 'team' && second === 'agents') {
		return stem ? `${stem} agent config` : 'agent config'
	}

	if (first === 'team' && second === 'roles') {
		return stem ? `${stem} role description` : 'role description'
	}

	if ((first === 'team' && second === 'workflows') || first === 'workflows') {
		return stem ? `${stem} workflow` : 'workflow'
	}

	if (first === 'prompts' || second === 'prompts') {
		return stem ? `${stem} prompt` : 'prompt'
	}

	if (first === 'artifacts') {
		return stem ? `${stem} artifact` : 'artifact'
	}

	if (first === 'dashboard') {
		return stem ? `${stem} dashboard file` : 'dashboard file'
	}

	return stem ? `${stem} file` : 'file'
}

function describePathScope(path: string): string {
	const segments = splitPath(path)
	if (segments.length === 0) {
		return 'files'
	}

	const [first, second] = segments

	if (first === 'knowledge') return 'knowledge'
	if (first === 'team' && second === 'agents') return 'agents'
	if (first === 'team' && second === 'roles') return 'roles'
	if ((first === 'team' && second === 'workflows') || first === 'workflows') return 'workflows'
	if (first === 'artifacts') return 'artifacts'
	if (first === 'prompts' || second === 'prompts') return 'prompts'
	if (first === 'dashboard') return 'dashboard'

	return humanizeToken(first).toLowerCase()
}

export function formatToolCallParams(params?: Record<string, unknown>): string | undefined {
	if (!params) return undefined

	const entries = Object.entries(params).filter(
		([key, value]) =>
			key !== 'displayLabel' &&
			key !== 'displayMeta' &&
			value !== undefined &&
			value !== null &&
			(!(typeof value === 'string') || value.trim().length > 0),
	)

	if (entries.length === 0) {
		return undefined
	}

	return entries
		.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
		.join(' · ')
}

export function getToolCallDisplay(toolCall: Pick<ToolCallState, 'tool' | 'params' | 'displayLabel' | 'displayMeta'>): ToolCallDisplay {
	const explicitLabel = toolCall.displayLabel?.trim()
	const explicitMeta = toolCall.displayMeta?.trim()
	const path = getToolCallPath(toolCall.params)
	const query = getToolCallQuery(toolCall.params)
	const command = getToolCallCommand(toolCall.params)

	if (explicitLabel) {
		return {
			label: explicitLabel,
			detail: explicitMeta,
			path,
			params: formatToolCallParams(toolCall.params),
		}
	}

	switch (toolCall.tool) {
		case 'read':
		case 'read_file':
			return {
				label: `Read ${path ? describePathTarget(path) : 'file'}`,
				detail: explicitMeta ?? path,
				path,
				params: formatToolCallParams(toolCall.params),
			}
		case 'write':
		case 'write_file':
		case 'edit':
		case 'edit_file':
			return {
				label: `Update ${path ? describePathTarget(path) : 'file'}`,
				detail: explicitMeta ?? path,
				path,
				params: formatToolCallParams(toolCall.params),
			}
		case 'search': {
			const searchDetail = explicitMeta ?? [path, query].filter(Boolean).join(' · ')
			return {
				label: `Search ${path ? describePathScope(path) : 'files'}`,
				detail: searchDetail || undefined,
				path,
				params: formatToolCallParams(toolCall.params),
			}
		}
		case 'web_search':
			return {
				label: 'Search the web',
				detail: explicitMeta ?? query,
				params: formatToolCallParams(toolCall.params),
			}
		case 'bash':
			return {
				label: 'Run shell command',
				detail: explicitMeta ?? (command ? truncateText(command) : undefined),
				params: formatToolCallParams(toolCall.params),
			}
		case 'message': {
			const recipient = toolCall.params
				? getStringValue(toolCall.params, ['agentId', 'agent', 'recipient', 'channel', 'to'])
				: undefined
			return {
				label: recipient ? `Message ${recipient}` : 'Send message',
				detail: explicitMeta ?? getStringValue(toolCall.params ?? {}, ['content', 'message']),
				params: formatToolCallParams(toolCall.params),
			}
		}
		default:
			return {
				label: humanizeToken(toolCall.tool),
				detail: explicitMeta ?? path ?? query ?? (command ? truncateText(command) : undefined),
				path,
				params: formatToolCallParams(toolCall.params),
			}
	}
}

function extractErrorField(value: unknown): string | undefined {
	if (typeof value === 'string') {
		const trimmed = value.trim()
		return trimmed || undefined
	}

	if (isRecord(value)) {
		return getStringValue(value, ['message', 'error', 'detail', 'reason', 'title'])
	}

	return undefined
}

export function summarizeErrorDetail(error: string | null | undefined): string | undefined {
	if (!error) return undefined

	const trimmed = error.trim()
	if (!trimmed) return undefined

	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		try {
			const parsed = JSON.parse(trimmed)
			const extracted = extractErrorField(parsed)
			if (extracted) {
				return truncateText(extracted, 200)
			}
		} catch {
			// Fall through to line-based parsing.
		}
	}

	const line = trimmed
		.split('\n')
		.map((entry) => entry.trim())
		.find((entry) => entry.length > 0 && !entry.startsWith('at '))

	if (!line) {
		return undefined
	}

	const cleaned = line.replace(/^error:\s*/i, '').replace(/^unexpected error:\s*/i, '').trim()
	if (!cleaned) {
		return undefined
	}

	const normalized = cleaned.toLowerCase()
	if (normalized === 'unknown error' || normalized === 'unexpected error') {
		return undefined
	}

	return truncateText(cleaned, 200)
}

export function formatAttachmentSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
