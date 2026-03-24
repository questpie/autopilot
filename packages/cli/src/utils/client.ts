import { createClient, type AutopilotClient } from '@questpie/autopilot-orchestrator/client'
import { getAuthHeaders, loadCredentials } from '../commands/auth'

export function getBaseUrl(port?: number): string {
	const creds = loadCredentials()
	if (creds?.url) return creds.url
	const p = port ?? creds?.port ?? 7778
	return `http://localhost:${p}`
}

export function getClient(): AutopilotClient {
	return createClient(getBaseUrl(), {
		headers: getAuthHeaders(),
	})
}

/** Client without auth headers — for login/setup before credentials exist. */
export function getBareClient(portOrUrl: number | string): AutopilotClient {
	const baseUrl = typeof portOrUrl === 'string' ? portOrUrl : `http://localhost:${portOrUrl}`
	return createClient(baseUrl)
}
