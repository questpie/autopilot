import { hc } from 'hono/client'
import type { AppType } from '@questpie/autopilot-orchestrator'
import { getAuthHeaders, loadCredentials } from '../commands/auth'

export function getBaseUrl(port?: number): string {
	const creds = loadCredentials()
	if (creds?.url) return creds.url
	const p = port ?? creds?.port ?? 7778
	return `http://localhost:${p}`
}

export function createApiClient(baseUrl?: string) {
	const headers = getAuthHeaders()
	// If no auth credentials are configured, use local dev bypass
	if (Object.keys(headers).length === 0) {
		headers['X-Local-Dev'] = 'true'
	}
	return hc<AppType>(baseUrl ?? getBaseUrl(), {
		headers,
	})
}

/** Client without auth headers -- for login/setup before credentials exist. */
export function createBareClient(portOrUrl: number | string) {
	const baseUrl =
		typeof portOrUrl === 'string' ? portOrUrl : `http://localhost:${portOrUrl}`
	return hc<AppType>(baseUrl)
}
