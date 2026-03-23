const API_BASE = 'http://localhost:7778'

/**
 * Smart fetch — tries JSON first, falls back to text.
 * /api/* endpoints always return JSON.
 * /fs/* endpoints return JSON for directories, raw text for files.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			...init?.headers,
		},
	})
	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`)
	}

	const text = await res.text()

	// Try to parse as JSON first
	try {
		return JSON.parse(text) as T
	} catch {
		// Not JSON — return raw text (for .md, .yaml, .txt files)
		return text as T
	}
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
	return apiFetch<T>(path, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
}

export async function apiDelete<T>(path: string): Promise<T> {
	return apiFetch<T>(path, { method: 'DELETE' })
}

export async function apiUpload<T>(path: string, file: File, targetDir?: string): Promise<T> {
	const formData = new FormData()
	formData.append('file', file)
	if (targetDir) formData.append('path', targetDir)
	const res = await fetch(`http://localhost:7778${path}`, {
		method: 'POST',
		body: formData,
	})
	if (!res.ok) throw new Error(`Upload error: ${res.status}`)
	return res.json() as Promise<T>
}

export async function apiFetchText(path: string): Promise<string> {
	const res = await fetch(`${API_BASE}${path}`)
	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`)
	}
	return res.text()
}

// Query keys
export const queryKeys = {
	status: ['status'] as const,
	tasks: ['tasks'] as const,
	task: (id: string) => ['task', id] as const,
	agents: ['agents'] as const,
	pins: ['pins'] as const,
	groups: ['groups'] as const,
	inbox: ['inbox'] as const,
	artifacts: ['artifacts'] as const,
	skills: ['skills'] as const,
	channels: ['channels'] as const,
	activity: (agent?: string) => ['activity', agent] as const,
	file: (path: string) => ['file', path] as const,
	directory: (path: string) => ['directory', path] as const,
	chat: (channel: string) => ['chat', channel] as const,
	dashboardLayout: ['dashboard-layout'] as const,
	dashboardWidgets: ['dashboard-widgets'] as const,
	dashboardPages: ['dashboard-pages'] as const,
}

// Auto-refresh intervals
export const REFETCH = {
	status: 10_000,
	tasks: 5_000,
	agents: 10_000,
	pins: 5_000,
	activity: 3_000,
	chat: 2_000,
	inbox: 5_000,
	artifacts: 10_000,
	channels: 10_000,
} as const
