import { createServerFn } from '@tanstack/react-start'
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

const getServerCookieHeader = createServerFn({ method: 'GET' }).handler(async () => {
	const { getRequest } = await import('@tanstack/react-start/server')
	return getRequest().headers.get('cookie') ?? ''
})

const apiFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const headers = new Headers(init?.headers)

	if (import.meta.env.SSR && !headers.has('cookie')) {
		const cookie = await getServerCookieHeader()
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
