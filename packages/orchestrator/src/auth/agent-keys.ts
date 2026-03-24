/**
 * Agent key management — independent of Better Auth.
 *
 * Keys are generated with crypto.randomBytes, hashed with SHA-256,
 * and stored in .auth/agent-keys.yaml. Raw keys exist only in memory.
 */
import { randomBytes, createHash } from 'node:crypto'
import { join } from 'node:path'
import { chmod } from 'node:fs/promises'
import { readYamlUnsafe, writeYaml, fileExists } from '../fs/yaml'
import type { AgentKeyEntry } from './types'

/**
 * Generate API keys for all agents at startup.
 * Keys are ephemeral — regenerated each time.
 * Only hashes are persisted to .auth/agent-keys.yaml.
 */
export async function ensureAgentKeys(
	companyRoot: string,
	agents: Array<{ id: string }>,
): Promise<Map<string, string>> {
	const keysPath = join(companyRoot, '.auth', 'agent-keys.yaml')
	const keyMap = new Map<string, string>()
	const entries: AgentKeyEntry[] = []

	for (const agent of agents) {
		const rawKey = `ap_${agent.id}_${randomBytes(24).toString('base64url')}`
		const keyHash = createHash('sha256').update(rawKey).digest('hex')

		keyMap.set(agent.id, rawKey)
		entries.push({
			agentId: agent.id,
			keyHash,
			createdAt: new Date().toISOString(),
		})

		console.log(`[auth] Generated API key for agent "${agent.id}"`)
	}

	await writeYaml(keysPath, { keys: entries })
	await chmod(keysPath, 0o600)
	return keyMap
}

/**
 * Verify an agent API key by comparing its SHA-256 hash
 * against stored hashes in .auth/agent-keys.yaml.
 */
export async function verifyAgentKey(
	companyRoot: string,
	rawKey: string,
): Promise<{ agentId: string } | null> {
	const keysPath = join(companyRoot, '.auth', 'agent-keys.yaml')

	const exists = await fileExists(keysPath)
	if (!exists) return null

	let data: { keys: AgentKeyEntry[] }
	try {
		data = (await readYamlUnsafe(keysPath)) as { keys: AgentKeyEntry[] }
	} catch {
		return null
	}

	if (!data?.keys) return null

	const keyHash = createHash('sha256').update(rawKey).digest('hex')
	const entry = data.keys.find((k) => k.keyHash === keyHash)
	return entry ? { agentId: entry.agentId } : null
}
