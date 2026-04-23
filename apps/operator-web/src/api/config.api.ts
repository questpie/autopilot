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
	| Script
	| ContextConfigRecord

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
