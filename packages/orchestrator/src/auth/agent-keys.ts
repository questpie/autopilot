/**
 * Agent key management — independent of Better Auth.
 *
 * Keys are generated with crypto.randomBytes, hashed with SHA-256,
 * and stored in .auth/agent-keys.yaml. Raw keys are encrypted with the
 * master key so they survive restarts without being regenerated.
 */
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { chmod } from 'node:fs/promises'
import { readYamlUnsafe, writeYaml, fileExists } from '../fs/yaml'
import { logger } from '../logger'
import { ensureMasterKey, loadMasterKey, encryptToBase64, decryptFromBase64, hashApiKey } from './crypto'
import type { AgentKeyEntry } from './types'

/**
 * Generate API keys for all agents at startup.
 * Keys are persisted — if an agent already has an encryptedKey in the YAML file,
 * it is decrypted and reused. Only agents without an entry get a new key generated.
 */
export async function ensureAgentKeys(
	companyRoot: string,
	agents: Array<{ id: string }>,
): Promise<Map<string, string>> {
	const keysPath = join(companyRoot, '.auth', 'agent-keys.yaml')
	const keyMap = new Map<string, string>()

	// Ensure master key exists and load it for encryption/decryption
	await ensureMasterKey(companyRoot)
	const masterKey = await loadMasterKey(companyRoot)

	// Load existing entries from disk (if any)
	let existingEntries: AgentKeyEntry[] = []
	if (await fileExists(keysPath)) {
		try {
			const data = (await readYamlUnsafe(keysPath)) as { keys: AgentKeyEntry[] }
			if (data?.keys) {
				existingEntries = data.keys
			}
		} catch {
			// Corrupted file — start fresh
		}
	}

	const existingByAgentId = new Map<string, AgentKeyEntry>(
		existingEntries.map((e) => [e.agentId, e]),
	)

	const entries: AgentKeyEntry[] = []

	for (const agent of agents) {
		const existing = existingByAgentId.get(agent.id)

		if (existing?.encryptedKey) {
			// Decrypt and reuse the persisted key
			try {
				const rawKey = await decryptFromBase64(existing.encryptedKey, masterKey)
				keyMap.set(agent.id, rawKey)
				entries.push(existing)
				logger.info('auth', `loaded persisted API key for agent "${agent.id}"`)
				continue
			} catch {
				// Decryption failed (e.g. master key rotated) — fall through to regenerate
				logger.warn('auth', `failed to decrypt existing key for agent "${agent.id}", regenerating`)
			}
		}

		// Generate a new key
		const rawKey = `ap_${agent.id}_${randomBytes(24).toString('base64url')}`
		const keyHash = hashApiKey(rawKey)
		const encryptedKey = await encryptToBase64(rawKey, masterKey)

		keyMap.set(agent.id, rawKey)
		entries.push({
			agentId: agent.id,
			keyHash,
			encryptedKey,
			createdAt: new Date().toISOString(),
		})

		logger.info('auth', `generated API key for agent "${agent.id}"`)
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

	const keyHash = hashApiKey(rawKey)
	const entry = data.keys.find((k) => k.keyHash === keyHash)
	return entry ? { agentId: entry.agentId } : null
}
