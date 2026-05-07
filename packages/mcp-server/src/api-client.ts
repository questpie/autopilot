/**
 * Lightweight fetch client for the Autopilot orchestrator API.
 *
 * Keep this package independent from the orchestrator `AppType`: importing the
 * full Hono RPC type graph makes MCP typecheck slow and brittle while adding no
 * runtime value for the stdio/SSE server.
 */

import { env } from './env'

const DEFAULT_BASE = 'http://localhost:7778'

type Query = Record<string, string | undefined>
type Json = Record<string, unknown>

function getBaseUrl(): string {
	return env.AUTOPILOT_API_URL ?? DEFAULT_BASE
}

function authHeaders(): Record<string, string> {
	const headers: Record<string, string> = {}
	if (env.AUTOPILOT_LOCAL_DEV === 'true') {
		headers['X-Local-Dev'] = 'true'
	} else if (env.AUTOPILOT_API_KEY) {
		headers.Authorization = `Bearer ${env.AUTOPILOT_API_KEY}`
	}
	return headers
}

function withQuery(path: string, query?: Query): string {
	const url = new URL(`${getBaseUrl()}${path}`)
	for (const [key, value] of Object.entries(query ?? {})) {
		if (value) url.searchParams.set(key, value)
	}
	return url.toString()
}

function request(
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	path: string,
	opts?: { query?: Query; json?: unknown },
): Promise<Response> {
	const headers: Record<string, string> = {
		...authHeaders(),
	}
	if (opts?.json !== undefined) headers['Content-Type'] = 'application/json'
	return fetch(withQuery(path, opts?.query), {
		method,
		headers,
		...(opts?.json !== undefined ? { body: JSON.stringify(opts.json) } : {}),
	})
}

function encode(value: string): string {
	return encodeURIComponent(value)
}

export const tasks = {
	$get: (opts?: { query?: Query }) => request('GET', '/api/tasks', opts),
	$post: (opts: { json: unknown }) => request('POST', '/api/tasks', opts),
	':id': {
		$get: (opts: { param: { id: string } }) => request('GET', `/api/tasks/${encode(opts.param.id)}`),
		$patch: (opts: { param: { id: string }; json: unknown }) =>
			request('PATCH', `/api/tasks/${encode(opts.param.id)}`, opts),
		$delete: (opts: { param: { id: string }; query?: Query }) =>
			request('DELETE', `/api/tasks/${encode(opts.param.id)}`, opts),
		approve: {
			$post: (opts: { param: { id: string } }) =>
				request('POST', `/api/tasks/${encode(opts.param.id)}/approve`),
		},
		reject: {
			$post: (opts: { param: { id: string }; json: unknown }) =>
				request('POST', `/api/tasks/${encode(opts.param.id)}/reject`, opts),
		},
		reply: {
			$post: (opts: { param: { id: string }; json: unknown }) =>
				request('POST', `/api/tasks/${encode(opts.param.id)}/reply`, opts),
		},
		activity: {
			$get: (opts: { param: { id: string } }) =>
				request('GET', `/api/tasks/${encode(opts.param.id)}/activity`),
		},
	},
}

export const runs = {
	$get: (opts?: { query?: Query }) => request('GET', '/api/runs', opts),
	':id': {
		$get: (opts: { param: { id: string } }) => request('GET', `/api/runs/${encode(opts.param.id)}`),
		events: {
			$get: (opts: { param: { id: string } }) =>
				request('GET', `/api/runs/${encode(opts.param.id)}/events`),
		},
		artifacts: {
			$get: (opts: { param: { id: string } }) =>
				request('GET', `/api/runs/${encode(opts.param.id)}/artifacts`),
		},
	},
}

export const projectsApi = {
	$get: () => request('GET', '/api/projects'),
	$post: (opts: { json: Json }) => request('POST', '/api/projects', opts),
	':id': {
		$delete: (opts: { param: { id: string } }) =>
			request('DELETE', `/api/projects/${encode(opts.param.id)}`),
	},
}

export const schedulesApi = {
	$get: () => request('GET', '/api/schedules'),
	$post: (opts: { json: unknown }) => request('POST', '/api/schedules', opts),
	':id': {
		$get: (opts: { param: { id: string } }) =>
			request('GET', `/api/schedules/${encode(opts.param.id)}`),
		$patch: (opts: { param: { id: string }; json: unknown }) =>
			request('PATCH', `/api/schedules/${encode(opts.param.id)}`, opts),
		$delete: (opts: { param: { id: string } }) =>
			request('DELETE', `/api/schedules/${encode(opts.param.id)}`),
	},
}

export const searchApi = {
	$get: (opts: { query: { q: string; scope?: string } }) =>
		request('GET', '/api/search', { query: opts.query }),
}
