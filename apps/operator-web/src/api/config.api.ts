import { ApiError, configFetch } from '@/lib/api'
import type {
	Agent,
	CapabilityProfileConfig,
	CompanyConfig,
	ConfigEntityType,
	ContextConfigRecord,
	EnvironmentConfig,
	ProjectConfig,
	ProviderConfig,
	Script,
	SkillConfig,
	Workflow,
} from './types'

export type ConfigRecord =
	| CompanyConfig
	| ProjectConfig
	| Agent
	| Workflow
	| EnvironmentConfig
	| ProviderConfig
	| CapabilityProfileConfig
	| SkillConfig
	| Script
	| ContextConfigRecord

export interface ConfigReloadStatus {
	available: boolean
	lastReloadAt?: string | null
	lastError?: string | null
	reloadCount?: number
}

export interface ConfigReloadResult {
	ok: boolean
	error?: string
}

export interface DefaultSkillCatalogEntry {
	id: string
	availability: 'built_in' | 'plugin_backed'
	name: string
	description: string
	tags: string[]
	roles: string[]
}

function buildConfigPath(type: ConfigEntityType, id?: string, projectId?: string | null): string {
	const path = id ? `/api/config/${type}/${encodeURIComponent(id)}` : `/api/config/${type}`
	if (!projectId) return path
	const query = new URLSearchParams({ project_id: projectId })
	return `${path}?${query.toString()}`
}

export async function getConfigRecords(
	type: ConfigEntityType,
	projectId?: string | null,
): Promise<ConfigRecord[]> {
	return configFetch<ConfigRecord[]>(buildConfigPath(type, undefined, projectId))
}

export async function saveConfigRecord(
	type: ConfigEntityType,
	id: string,
	data: unknown,
	projectId?: string | null,
): Promise<ConfigRecord> {
	const res = await fetch(buildConfigPath(type, id), {
		method: 'PUT',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			data,
			...(projectId ? { project_id: projectId } : {}),
		}),
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<ConfigRecord>
}

export async function getConfigReloadStatus(): Promise<ConfigReloadStatus> {
	return configFetch<ConfigReloadStatus>('/api/config/reload-status')
}

export async function getDefaultSkillCatalog(): Promise<DefaultSkillCatalogEntry[]> {
	return configFetch<DefaultSkillCatalogEntry[]>('/api/config/skills/_defaults')
}

export async function reloadConfig(): Promise<ConfigReloadResult> {
	const res = await fetch('/api/config/reload', {
		method: 'POST',
		credentials: 'include',
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<ConfigReloadResult>
}

export async function deleteConfigRecord(
	type: ConfigEntityType,
	id: string,
	projectId?: string | null,
): Promise<{ ok: boolean; deleted: string }> {
	const res = await fetch(buildConfigPath(type, id, projectId), {
		method: 'DELETE',
		credentials: 'include',
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<{ ok: boolean; deleted: string }>
}
