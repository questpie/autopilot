import type { ChatAttachment } from '@/api/types'

export type ChatContextRefType = 'task' | 'file' | 'directory' | 'run' | 'session' | 'artifact'

export interface ChatContextSearch {
	contextRefType?: ChatContextRefType
	contextRefId?: string
	contextPath?: string
	contextRunId?: string
	contextLabel?: string
}

export function getChatContextSearch(search: Record<string, unknown>): ChatContextSearch {
	return {
		contextRefType: isChatContextRefType(search.contextRefType) ? search.contextRefType : undefined,
		contextRefId: typeof search.contextRefId === 'string' ? search.contextRefId : undefined,
		contextPath: typeof search.contextPath === 'string' ? search.contextPath : undefined,
		contextRunId: typeof search.contextRunId === 'string' ? search.contextRunId : undefined,
		contextLabel: typeof search.contextLabel === 'string' ? search.contextLabel : undefined,
	}
}

export function buildChatContextAttachment(search: ChatContextSearch): ChatAttachment | null {
	if (!search.contextRefType) return null

	const refId = search.contextRefId ?? search.contextPath ?? search.contextRunId
	if (!refId) return null

	return {
		type: 'ref',
		source: 'page',
		label: search.contextLabel ?? buildFallbackLabel(search.contextRefType, refId),
		refType: search.contextRefType,
		refId,
		metadata: {
			contextRefType: search.contextRefType,
			contextRefId: search.contextRefId,
			contextPath: search.contextPath,
			contextRunId: search.contextRunId,
		},
	}
}

export function buildChatContextSearch(input: {
	refType: ChatContextRefType
	refId?: string
	path?: string | null
	runId?: string | null
	label?: string
}): ChatContextSearch {
	return {
		contextRefType: input.refType,
		contextRefId: input.refId,
		contextPath: input.path ?? undefined,
		contextRunId: input.runId ?? undefined,
		contextLabel: input.label,
	}
}

export function clearChatContextSearch(search: ChatContextSearch): ChatContextSearch {
	return {
		...search,
		contextRefType: undefined,
		contextRefId: undefined,
		contextPath: undefined,
		contextRunId: undefined,
		contextLabel: undefined,
	}
}

function isChatContextRefType(value: unknown): value is ChatContextRefType {
	return value === 'task' || value === 'file' || value === 'directory' || value === 'run' || value === 'session' || value === 'artifact'
}

function buildFallbackLabel(refType: ChatContextRefType, refId: string): string {
	if (refType === 'task') return `Task ${refId.slice(0, 8)}`
	if (refType === 'run') return `Run ${refId.slice(0, 8)}`
	if (refType === 'session') return `Session ${refId.slice(0, 8)}`
	return refId
}
