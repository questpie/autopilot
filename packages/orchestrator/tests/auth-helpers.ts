import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify as stringifyYaml } from 'yaml'
import { ensureAgentKeys } from '../src/auth/agent-keys'
import { loadRoles } from '../src/auth/roles'

const TEST_AGENT_ID = 'test-agent'

export async function setupTestApiKey(companyRoot: string): Promise<string> {
	await writeFile(
		join(companyRoot, 'team', 'roles.yaml'),
		stringifyYaml({
			roles: {
				member: {
					description: 'Test member role',
					permissions: '*',
				},
			},
		}),
	)

	await loadRoles(companyRoot)

	const keys = await ensureAgentKeys(companyRoot, [{ id: TEST_AGENT_ID }])
	const key = keys.get(TEST_AGENT_ID)
	if (!key) {
		throw new Error('Failed to generate test API key')
	}

	return key
}

export function withApiKey(init: RequestInit | undefined, apiKey: string): RequestInit {
	const headers = new Headers(init?.headers)
	headers.set('X-API-Key', apiKey)
	return {
		...(init ?? {}),
		headers,
	}
}
