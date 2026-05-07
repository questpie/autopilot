import { ApiError } from '@/lib/api'
import type {
	KnowledgeDocument,
	KnowledgeDocumentRecord,
	ResourceListEntry,
	ResourceListResult,
	ResourceStatResult,
} from './types'

export interface KnowledgeScopeParams {
	projectId?: string | null
	taskId?: string | null
}

export interface KnowledgeReadResult {
	content: string
	contentType: string
	size: number | null
	isText: boolean
	document: KnowledgeDocument
}

function normalizePath(path: string | null): string | null {
	if (!path) return null
	return path.replace(/^\/+/, '').replace(/\/+$/, '') || null
}

function knowledgePath(path: string): string {
	return `/api/knowledge/${path.split('/').map(encodeURIComponent).join('/')}`
}

function appendScope(params: URLSearchParams, scope?: KnowledgeScopeParams) {
	if (scope?.projectId) params.set('project_id', scope.projectId)
	if (scope?.taskId) params.set('task_id', scope.taskId)
}

function scopedPath(path: string, scope?: KnowledgeScopeParams, extra?: Record<string, string>) {
	const params = new URLSearchParams(extra)
	appendScope(params, scope)
	const query = params.toString()
	return `${knowledgePath(path)}${query ? `?${query}` : ''}`
}

function isTextMime(mimeType: string): boolean {
	return /(^text\/)|markdown|yaml|json|xml|javascript|typescript|openapi|swagger/.test(mimeType)
}

function isTextPath(path: string): boolean {
	const lower = path.toLowerCase()
	return (
		lower.endsWith('.md') ||
		lower.endsWith('.markdown') ||
		lower.endsWith('.openapi') ||
		lower.endsWith('.openapi.json') ||
		lower.endsWith('.openapi.yaml') ||
		lower.endsWith('.openapi.yml') ||
		lower.endsWith('/openapi.json') ||
		lower.endsWith('/openapi.yaml') ||
		lower.endsWith('/openapi.yml') ||
		lower.endsWith('/swagger.json') ||
		lower.endsWith('/swagger.yaml') ||
		lower.endsWith('/swagger.yml')
	)
}

function inferContentType(path: string, browserType?: string): string {
	if (browserType && browserType !== 'application/octet-stream') return browserType
	const lower = path.toLowerCase()
	if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
	if (
		lower.endsWith('.openapi') ||
		lower.endsWith('.openapi.yaml') ||
		lower.endsWith('.openapi.yml') ||
		lower.endsWith('/openapi.yaml') ||
		lower.endsWith('/openapi.yml') ||
		lower.endsWith('/swagger.yaml') ||
		lower.endsWith('/swagger.yml')
	) {
		return 'application/vnd.oai.openapi+yaml'
	}
	if (
		lower.endsWith('.openapi.json') ||
		lower.endsWith('/openapi.json') ||
		lower.endsWith('/swagger.json')
	) {
		return 'application/vnd.oai.openapi+json'
	}
	if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml'
	if (lower.endsWith('.json')) return 'application/json'
	if (lower.endsWith('.txt')) return 'text/plain'
	return 'application/octet-stream'
}

function nameFromPath(path: string): string {
	return path.split('/').filter(Boolean).pop() ?? path
}

function toDirectoryEntries(
	docs: KnowledgeDocumentRecord[],
	path: string | null,
): ResourceListEntry[] {
	const prefix = normalizePath(path)
	const directories = new Map<string, ResourceListEntry>()
	const files = new Map<string, ResourceListEntry>()

	for (const doc of docs) {
		const normalized = normalizePath(doc.path)
		if (!normalized) continue
		const relative = prefix ? normalized.slice(prefix.length).replace(/^\/+/, '') : normalized
		if (!relative) continue
		const [name, ...rest] = relative.split('/')
		if (!name) continue
		const entryPath = prefix ? `${prefix}/${name}` : name
		if (rest.length > 0) {
			directories.set(entryPath, { name, path: entryPath, type: 'directory', mime_type: null })
		} else {
			files.set(entryPath, {
				name,
				path: entryPath,
				type: 'file',
				mime_type: doc.mime_type,
			})
		}
	}

	return [
		...Array.from(directories.values()).sort((a, b) => a.name.localeCompare(b.name)),
		...Array.from(files.values()).sort((a, b) => a.name.localeCompare(b.name)),
	]
}

export function knowledgeContentUrl(path: string, scope?: KnowledgeScopeParams): string {
	return scopedPath(path, scope, { raw: 'true' })
}

export async function knowledgeList(
	path: string | null,
	scope?: KnowledgeScopeParams,
): Promise<ResourceListResult> {
	const params = new URLSearchParams()
	const normalized = normalizePath(path)
	if (normalized) params.set('path', normalized)
	appendScope(params, scope)
	const res = await fetch(`/api/knowledge${params.size ? `?${params.toString()}` : ''}`, {
		credentials: 'include',
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	const docs = (await res.json()) as KnowledgeDocumentRecord[]
	return {
		entries: toDirectoryEntries(docs, normalized),
	}
}

export async function knowledgeRead(
	path: string,
	scope?: KnowledgeScopeParams,
): Promise<KnowledgeReadResult> {
	const res = await fetch(scopedPath(path, scope), { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	const document = (await res.json()) as KnowledgeDocument
	const content = document.content ?? ''
	return {
		content,
		contentType: document.mime_type,
		size: new TextEncoder().encode(content).length,
		isText: isTextMime(document.mime_type) || isTextPath(path),
		document,
	}
}

export async function knowledgeStat(
	path: string | null,
	scope?: KnowledgeScopeParams,
): Promise<ResourceStatResult> {
	const normalized = normalizePath(path)
	if (!normalized) {
		return {
			type: 'directory',
			size: 0,
			mime_type: null,
			writable: true,
			etag: null,
		}
	}

	const read = await fetch(scopedPath(normalized, scope), { credentials: 'include' })
	if (read.ok) {
		const doc = (await read.json()) as KnowledgeDocument
		return {
			type: 'file',
			size: new TextEncoder().encode(doc.content ?? '').length,
			mime_type: doc.mime_type,
			writable: true,
			etag: doc.content_hash,
		}
	}

	const list = await knowledgeList(normalized, scope)
	if (list.entries.length > 0) {
		return {
			type: 'directory',
			size: 0,
			mime_type: null,
			writable: true,
			etag: null,
		}
	}

	throw new ApiError(read.status, read.statusText, await read.json().catch(() => undefined))
}

export async function knowledgeWrite(
	path: string,
	content: string,
	contentType?: string,
	scope?: KnowledgeScopeParams,
): Promise<void> {
	const res = await fetch(scopedPath(path, scope), {
		method: 'PUT',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			content,
			mime_type: contentType,
			title: nameFromPath(path),
		}),
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
}

export async function knowledgeUpload(
	path: string,
	file: File,
	scope?: KnowledgeScopeParams,
): Promise<void> {
	const res = await fetch(scopedPath(path, scope), {
		method: 'PUT',
		credentials: 'include',
		headers: { 'Content-Type': inferContentType(path, file.type) },
		body: file,
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
}

export async function knowledgeDelete(path: string, scope?: KnowledgeScopeParams): Promise<void> {
	const res = await fetch(scopedPath(path, scope), {
		method: 'DELETE',
		credentials: 'include',
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
}

export async function knowledgeSearch(
	query: string,
	scope?: KnowledgeScopeParams,
): Promise<ResourceListResult> {
	const params = new URLSearchParams({ q: query })
	appendScope(params, scope)
	const res = await fetch(`/api/knowledge/search?${params.toString()}`, { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	const payload = (await res.json()) as { results: KnowledgeDocument[] }
	return {
		entries: payload.results.map((doc) => ({
			name: nameFromPath(doc.path),
			path: doc.path,
			type: 'file' as const,
			mime_type: doc.mime_type,
		})),
	}
}
