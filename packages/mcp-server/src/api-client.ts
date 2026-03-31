/**
 * Thin HTTP client for the Autopilot orchestrator API.
 * MCP tools are HTTP wrappers — no direct DB access.
 */

import { env } from './env'

const DEFAULT_BASE = 'http://localhost:7778'

export function getBaseUrl(): string {
	return env.AUTOPILOT_API_URL ?? DEFAULT_BASE
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		headers: { 'Content-Type': 'application/json' },
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.json() as Promise<T>
}

/** Fetch SSE stream as text. */
export async function apiStream(path: string): Promise<string> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		headers: { Accept: 'text/event-stream' },
	})
	if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
	return res.text()
}
