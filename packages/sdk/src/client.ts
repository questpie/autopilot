import { hc } from 'hono/client'
import type { AppType } from '@questpie/autopilot-orchestrator/api'

export interface ClientOptions {
	/** Additional headers to send with every request (e.g. API key). */
	headers?: Record<string, string>
	/** Fetch init overrides. */
	init?: RequestInit
}

/**
 * Create a type-safe API client for QUESTPIE Autopilot.
 *
 * Uses Hono RPC client — types are inferred directly from the server
 * route definitions with zero code generation.
 *
 * @example
 * ```ts
 * const client = createClient('http://localhost:7778')
 * const res = await client.api.tasks.$get({ query: { status: 'active' } })
 * const tasks = await res.json() // fully typed
 * ```
 */
export function createClient(baseUrl: string, opts?: ClientOptions) {
	return hc<AppType>(baseUrl, {
		headers: opts?.headers,
		init: {
			credentials: 'include',
			...opts?.init,
		},
	})
}

/** The inferred client type — useful for typing function parameters. */
export type AutopilotClient = ReturnType<typeof createClient>
