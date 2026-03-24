/**
 * Type-safe Hono RPC client for QUESTPIE Autopilot.
 *
 * Import from '@questpie/autopilot-orchestrator/client':
 *
 * ```ts
 * import { createClient } from '@questpie/autopilot-orchestrator/client'
 * const client = createClient('http://localhost:7778')
 * const res = await client.api.tasks.$get({ query: { status: 'backlog' } })
 * const tasks = await res.json() // fully typed
 * ```
 */
import { hc } from 'hono/client'
import type { AppType } from './api/app'

export interface ClientOptions {
	headers?: Record<string, string>
	init?: RequestInit
}

export type AutopilotClient = ReturnType<typeof hc<AppType>>

export function createClient(baseUrl: string, opts?: ClientOptions): AutopilotClient {
	return hc<AppType>(baseUrl, {
		headers: opts?.headers,
		init: {
			credentials: 'include',
			...opts?.init,
		},
	})
}
