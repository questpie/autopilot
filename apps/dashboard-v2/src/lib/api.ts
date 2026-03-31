import { hc } from 'hono/client'
import type { AppType } from '../../../../packages/orchestrator/src/api/app'
import { env, getPublicApiBase } from './env'

function getApiBase(): string {
	if (import.meta.env.SSR) {
		return env.API_INTERNAL_URL
	}

	return getPublicApiBase()
}

export const API_BASE = getApiBase()

const apiFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const headers = new Headers(init?.headers)

	if (import.meta.env.SSR && !headers.has('cookie')) {
		const { getRequest } = await import('@tanstack/react-start/server')
		const request = getRequest()
		const cookie = request.headers.get('cookie')
		if (cookie) {
			headers.set('cookie', cookie)
		}
	}

	return fetch(input, {
		...init,
		headers,
		credentials: 'include',
	})
}) as typeof fetch

export const api = hc<AppType>(API_BASE, {
	fetch: apiFetch,
	init: {
		credentials: 'include',
	},
})
