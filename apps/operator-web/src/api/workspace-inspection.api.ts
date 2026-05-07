import { ApiError } from '@/lib/api'
import type { ResourceListResult, ResourceStatResult, WorkspaceDiffResult } from './types'

function normalizePath(path: string | null | undefined): string {
	return (path ?? '').replace(/^\.\//, '').replace(/^\/+/, '')
}

function endpoint(
	path: string,
	runId: string,
	filePath?: string | null,
	extra?: Record<string, string>,
) {
	const params = new URLSearchParams({ run_id: runId })
	const normalized = normalizePath(filePath)
	if (normalized) params.set('path', normalized)
	for (const [key, value] of Object.entries(extra ?? {})) {
		params.set(key, value)
	}
	return `/api/workspace-inspection/${path}?${params.toString()}`
}

export interface WorkspaceInspectionReadResult {
	content: string
	contentType: string
	size: number | null
	isText: boolean
}

export function workspaceInspectionContentUrl(runId: string, path: string | null): string {
	return endpoint('read', runId, path)
}

export async function workspaceInspectionList(
	runId: string,
	path: string | null,
): Promise<ResourceListResult> {
	const res = await fetch(endpoint('list', runId, path), { credentials: 'include' })
	if (!res.ok) throw new ApiError(res.status, res.statusText)
	const data = (await res.json()) as ResourceListResult & {
		run_id: string
		path: string
	}
	return {
		entries: data.entries.map((entry) => ({ ...entry, path: normalizePath(entry.path) })),
	}
}

export async function workspaceInspectionStat(
	runId: string,
	path: string | null,
): Promise<ResourceStatResult> {
	const res = await fetch(endpoint('stat', runId, path), { credentials: 'include' })
	if (!res.ok) throw new ApiError(res.status, res.statusText)
	const data = (await res.json()) as ResourceStatResult & { run_id: string; path: string }
	return {
		type: data.type,
		size: data.size,
		mime_type: data.mime_type,
		writable: data.writable,
		etag: data.etag,
	}
}

export async function workspaceInspectionDiff(
	runId: string,
	path: string | null,
	includeDirty = true,
): Promise<WorkspaceDiffResult> {
	const res = await fetch(
		endpoint('diff', runId, path, { include_dirty: includeDirty ? 'true' : 'false' }),
		{ credentials: 'include' },
	)
	if (!res.ok) throw new ApiError(res.status, res.statusText)
	const data = (await res.json()) as WorkspaceDiffResult & {
		run_id: string
		path: string
	}
	return {
		base: data.base,
		head: data.head,
		files: data.files,
		stats: data.stats,
		git: data.git ?? null,
	}
}

export async function workspaceInspectionRead(
	runId: string,
	path: string,
): Promise<WorkspaceInspectionReadResult> {
	const res = await fetch(endpoint('read', runId, path), { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText)
	}
	const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
	const sizeHeader = res.headers.get('x-workspace-inspection-size')
	const size = sizeHeader ? Number(sizeHeader) : null
	const isText = res.headers.get('x-workspace-inspection-text') === 'true'
	const content = isText ? await res.text() : ''
	return { content, contentType, size, isText }
}
