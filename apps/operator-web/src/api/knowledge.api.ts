import { ApiError } from '@/lib/api'
import type {
	KnowledgeDocument,
	KnowledgeDocumentRecord,
	VfsListEntry,
	VfsListResult,
	VfsStatResult,
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
	return /(^text\/)|markdown|yaml|json|xml|javascript|typescript/.test(mimeType)
}

function nameFromPath(path: string): string {
	return path.split('/').filter(Boolean).pop() ?? path
}

function toDirectoryEntries(docs: KnowledgeDocumentRecord[], path: string | null): VfsListEntry[] {
	const prefix = normalizePath(path)
	const directories = new Map<string, VfsListEntry>()
	const files = new Map<string, VfsListEntry>()

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
): Promise<VfsListResult> {
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
		uri: normalized ? `knowledge:${normalized}` : 'knowledge:',
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
		isText: isTextMime(document.mime_type),
		document,
	}
}

export async function knowledgeStat(
	path: string | null,
	scope?: KnowledgeScopeParams,
): Promise<VfsStatResult> {
	const normalized = normalizePath(path)
	if (!normalized) {
		return {
			uri: 'knowledge:',
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
			uri: `knowledge:${normalized}`,
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
			uri: `knowledge:${normalized}`,
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
		headers: { 'Content-Type': file.type || 'application/octet-stream' },
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
): Promise<VfsListResult> {
	const params = new URLSearchParams({ q: query })
	appendScope(params, scope)
	const res = await fetch(`/api/knowledge/search?${params.toString()}`, { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	const payload = (await res.json()) as { results: KnowledgeDocument[] }
	return {
		uri: `knowledge-search:${query}`,
		entries: payload.results.map((doc) => ({
			name: nameFromPath(doc.path),
			path: doc.path,
			type: 'file' as const,
			mime_type: doc.mime_type,
		})),
	}
}
