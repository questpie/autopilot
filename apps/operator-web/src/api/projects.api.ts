import { ApiError } from '@/lib/api'
import type { ProjectRegistration } from './types'

export async function getProjects(): Promise<ProjectRegistration[]> {
	const res = await fetch('/api/projects', { credentials: 'include' })
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<ProjectRegistration[]>
}

export async function registerProject(input: {
	name?: string
	path: string
	git_remote?: string
	default_branch?: string
}): Promise<ProjectRegistration> {
	const res = await fetch('/api/projects', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input),
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<ProjectRegistration>
}

export async function deleteProject(id: string): Promise<{ ok: boolean; deleted: string }> {
	const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
		method: 'DELETE',
		credentials: 'include',
	})
	if (!res.ok) {
		throw new ApiError(res.status, res.statusText, await res.json().catch(() => undefined))
	}
	return res.json() as Promise<{ ok: boolean; deleted: string }>
}
