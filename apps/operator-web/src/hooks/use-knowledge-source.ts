import {
	type KnowledgeScopeParams,
	knowledgeList,
	knowledgeRead,
	knowledgeSearch,
	knowledgeStat,
} from '@/api/knowledge.api'
import {
	workspaceInspectionList,
	workspaceInspectionRead,
	workspaceInspectionStat,
} from '@/api/workspace-inspection.api'
import { useQuery } from '@tanstack/react-query'

export const knowledgeSourceKeys = {
	all: ['knowledge-source'] as const,
	list: (runId: string | null, path: string | null, projectId?: string | null) =>
		[
			'knowledge-source',
			'list',
			runId ?? 'knowledge',
			projectId ?? 'company',
			path ?? '.',
		] as const,
	stat: (runId: string | null, path: string | null, projectId?: string | null) =>
		[
			'knowledge-source',
			'stat',
			runId ?? 'knowledge',
			projectId ?? 'company',
			path ?? '.',
		] as const,
	read: (runId: string | null, path: string | null, projectId?: string | null) =>
		[
			'knowledge-source',
			'read',
			runId ?? 'knowledge',
			projectId ?? 'company',
			path ?? '.',
		] as const,
	search: (query: string, projectId?: string | null) =>
		['knowledge-source', 'search', projectId ?? 'company', query] as const,
}

function scope(projectId?: string | null): KnowledgeScopeParams {
	return { projectId }
}

export function knowledgeSourceList(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	return runId ? workspaceInspectionList(runId, path) : knowledgeList(path, scope(projectId))
}

export function knowledgeSourceStat(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	return runId ? workspaceInspectionStat(runId, path) : knowledgeStat(path, scope(projectId))
}

export function knowledgeSourceRead(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	if (!path) throw new Error('path is required')
	return runId ? workspaceInspectionRead(runId, path) : knowledgeRead(path, scope(projectId))
}

export function useKnowledgeList(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	return useQuery({
		queryKey: knowledgeSourceKeys.list(runId, path, projectId),
		queryFn: () => knowledgeSourceList(runId, path, projectId),
	})
}

export function useKnowledgeStat(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	return useQuery({
		queryKey: knowledgeSourceKeys.stat(runId, path, projectId),
		queryFn: () => knowledgeSourceStat(runId, path, projectId),
	})
}

export function useKnowledgeRead(
	runId: string | null,
	path: string | null,
	projectId?: string | null,
) {
	return useQuery({
		queryKey: knowledgeSourceKeys.read(runId, path, projectId),
		queryFn: () => knowledgeSourceRead(runId, path, projectId),
		enabled: path !== null,
	})
}

export function useKnowledgeSearch(query: string, projectId?: string | null) {
	return useQuery({
		queryKey: knowledgeSourceKeys.search(query, projectId),
		queryFn: () => knowledgeSearch(query, scope(projectId)),
		enabled: query.trim().length > 0,
	})
}
