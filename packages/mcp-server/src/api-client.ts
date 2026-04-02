/**
 * Thin HTTP client for the Autopilot orchestrator API.
 * MCP tools are HTTP wrappers — no direct DB access.
 */

import { env } from './env'

const DEFAULT_BASE = 'http://localhost:7778'

export function getBaseUrl(): string {
	return env.AUTOPILOT_API_URL ?? DEFAULT_BASE
}

function authHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}
	if (env.AUTOPILOT_API_KEY) {
		headers['Authorization'] = `Bearer ${env.AUTOPILOT_API_KEY}`
	}
	return headers
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		headers: authHeaders(),
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'POST',
		headers: authHeaders(),
		body: body ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'PATCH',
		headers: authHeaders(),
		body: body ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'DELETE',
		headers: authHeaders(),
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}
