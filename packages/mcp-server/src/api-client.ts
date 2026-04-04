/**
 * Type-safe Hono RPC client for the Autopilot orchestrator API.
 */

import { hc } from 'hono/client'
import type { AppType } from '@questpie/autopilot-orchestrator'
import { env } from './env'

const DEFAULT_BASE = 'http://localhost:7778'

function getBaseUrl(): string {
	return env.AUTOPILOT_API_URL ?? DEFAULT_BASE
}

function authHeaders(): Record<string, string> {
	const headers: Record<string, string> = {}
	if (env.AUTOPILOT_API_KEY) {
		headers.Authorization = `Bearer ${env.AUTOPILOT_API_KEY}`
	}
	return headers
}

const client = hc<AppType>(getBaseUrl(), { headers: authHeaders() })

export const tasks = client.api.tasks
export const runs = client.api.runs
