import {
	type KnowledgeScopeParams,
	knowledgeList,
	knowledgeRead,
	knowledgeSearch,
	knowledgeStat,
} from '@/api/knowledge.api'
import { vfsList, vfsRead, vfsStat } from '@/api/vfs.api'
import { buildWorkspaceUri } from '@/features/files/lib/file-paths'
import { useQuery } from '@tanstack/react-query'

export const filesSourceKeys = {
	all: ['files-source'] as const,
	list: (runId: string | null, path: string | null, projectId?: string | null) =>
		['files-source', 'list', runId ?? 'knowledge', projectId ?? 'company', path ?? '.'] as const,
	stat: (runId: string | null, path: string | null, projectId?: string | null) =>
		['files-source', 'stat', runId ?? 'knowledge', projectId ?? 'company', path ?? '.'] as const,
	read: (runId: string | null, path: string | null, projectId?: string | null) =>
		['files-source', 'read', runId ?? 'knowledge', projectId ?? 'company', path ?? '.'] as const,
	search: (query: string, projectId?: string | null) =>
		['files-source', 'search', projectId ?? 'company', query] as const,
}

function scope(projectId?: string | null): KnowledgeScopeParams {
	return { projectId }
}

export function filesList(runId: string | null, path: string | null, projectId?: string | null) {
	return runId ? vfsList(buildWorkspaceUri(runId, path)) : knowledgeList(path, scope(projectId))
}

export function filesStat(runId: string | null, path: string | null, projectId?: string | null) {
	return runId ? vfsStat(buildWorkspaceUri(runId, path)) : knowledgeStat(path, scope(projectId))
}

export function filesRead(runId: string | null, path: string | null, projectId?: string | null) {
	if (!path) throw new Error('path is required')
	return runId ? vfsRead(buildWorkspaceUri(runId, path)) : knowledgeRead(path, scope(projectId))
}

export function useFilesList(runId: string | null, path: string | null, projectId?: string | null) {
	return useQuery({
		queryKey: filesSourceKeys.list(runId, path, projectId),
		queryFn: () => filesList(runId, path, projectId),
	})
}

export function useFilesStat(runId: string | null, path: string | null, projectId?: string | null) {
	return useQuery({
		queryKey: filesSourceKeys.stat(runId, path, projectId),
		queryFn: () => filesStat(runId, path, projectId),
	})
}

export function useFilesRead(runId: string | null, path: string | null, projectId?: string | null) {
	return useQuery({
		queryKey: filesSourceKeys.read(runId, path, projectId),
		queryFn: () => filesRead(runId, path, projectId),
		enabled: path !== null,
	})
}

export function useKnowledgeSearch(query: string, projectId?: string | null) {
	return useQuery({
		queryKey: filesSourceKeys.search(query, projectId),
		queryFn: () => knowledgeSearch(query, scope(projectId)),
		enabled: query.trim().length > 0,
	})
}
