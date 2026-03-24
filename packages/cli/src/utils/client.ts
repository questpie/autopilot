import { createClient, type AutopilotClient } from '@questpie/autopilot-orchestrator/client'
import { getAuthHeaders, loadCredentials } from '../commands/auth'

export function getBaseUrl(port?: number): string {
	const p = port ?? loadCredentials()?.port ?? 7778
	return `http://localhost:${p}`
}

export function getClient(): AutopilotClient {
	const creds = loadCredentials()
	const port = creds?.port ?? 7778
	return createClient(`http://localhost:${port}`, {
		headers: getAuthHeaders(),
	})
}

/** Client without auth headers — for login/setup before credentials exist. */
export function getBareClient(port: number): AutopilotClient {
	return createClient(`http://localhost:${port}`)
}
