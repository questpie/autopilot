import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS, SecretSchema, secretPath as secretPathFromName } from '@questpie/autopilot-spec'
import type { Secret } from '@questpie/autopilot-spec'
import { decryptFromBase64, encryptToBase64, ensureMasterKey, loadMasterKey } from '../auth/crypto'
import { fileExists, readYamlUnsafe, writeYaml } from '../fs/yaml'

export interface SecretMetadata extends Omit<Secret, 'value'> {
	name: string
	hasValue: boolean
}

export interface SecretWriteInput {
	name: string
	value: string
	type?: string
	createdBy: string
	allowedAgents?: string[]
	usage?: string
}

function secretsDir(companyRoot: string): string {
	return join(companyRoot, PATHS.SECRETS_DIR.slice(1))
}

function secretFilePath(companyRoot: string, name: string): string {
	return join(companyRoot, secretPathFromName(name).slice(1))
}

function normalizeSecretRecord(name: string, raw: unknown): SecretMetadata | null {
	if (!raw || typeof raw !== 'object') return null
	const record = raw as Record<string, unknown>
	const parsed = SecretSchema.safeParse({
		service: typeof record.service === 'string' ? record.service : name,
		type: typeof record.type === 'string' ? record.type : 'api_token',
		created_at:
			typeof record.created_at === 'string'
				? record.created_at
				: typeof record.created === 'string'
					? record.created
					: new Date(0).toISOString(),
		created_by:
			typeof record.created_by === 'string'
				? record.created_by
				: typeof record.createdBy === 'string'
					? record.createdBy
					: 'system',
		value:
			typeof record.value === 'string'
				? record.value
				: typeof record.api_key === 'string'
					? record.api_key
					: '',
		allowed_agents: Array.isArray(record.allowed_agents)
			? record.allowed_agents.filter((value): value is string => typeof value === 'string')
			: Array.isArray(record.agents)
				? record.agents.filter((value): value is string => typeof value === 'string')
				: [],
		usage: typeof record.usage === 'string' ? record.usage : '',
		encrypted: record.encrypted === true,
	})

	if (!parsed.success) return null

	const { value, ...metadata } = parsed.data
	return {
		name,
		...metadata,
		hasValue: value.length > 0,
	}
}

export async function listSecrets(companyRoot: string): Promise<SecretMetadata[]> {
	let entries: string[]
	try {
		entries = await readdir(secretsDir(companyRoot))
	} catch {
		return []
	}

	const secrets: SecretMetadata[] = []
	for (const entry of entries) {
		if (!entry.endsWith('.yaml') || entry.startsWith('.')) continue
		const name = entry.replace(/\.ya?ml$/, '')
		try {
			const raw = await readYamlUnsafe(secretFilePath(companyRoot, name))
			const metadata = normalizeSecretRecord(name, raw)
			if (metadata) secrets.push(metadata)
		} catch {
			// Skip unreadable secret files from list view.
		}
	}

	return secrets.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readSecretRecord(companyRoot: string, name: string): Promise<Secret | null> {
	const path = secretFilePath(companyRoot, name)
	if (!(await fileExists(path))) return null

	const raw = (await readYamlUnsafe(path)) as Record<string, unknown>
	const parsed = SecretSchema.safeParse({
		service: typeof raw.service === 'string' ? raw.service : name,
		type: typeof raw.type === 'string' ? raw.type : 'api_token',
		created_at:
			typeof raw.created_at === 'string'
				? raw.created_at
				: typeof raw.created === 'string'
					? raw.created
					: new Date(0).toISOString(),
		created_by:
			typeof raw.created_by === 'string'
				? raw.created_by
				: typeof raw.createdBy === 'string'
					? raw.createdBy
					: 'system',
		value:
			typeof raw.value === 'string'
				? raw.value
				: typeof raw.api_key === 'string'
					? raw.api_key
					: '',
		allowed_agents: Array.isArray(raw.allowed_agents)
			? raw.allowed_agents.filter((value): value is string => typeof value === 'string')
			: Array.isArray(raw.agents)
				? raw.agents.filter((value): value is string => typeof value === 'string')
				: [],
		usage: typeof raw.usage === 'string' ? raw.usage : '',
		encrypted: raw.encrypted === true,
	})

	if (!parsed.success) {
		throw parsed.error
	}

	if (!parsed.data.encrypted) return parsed.data

	const masterKey = await loadMasterKey(companyRoot)
	return {
		...parsed.data,
		value: await decryptFromBase64(parsed.data.value, masterKey),
	}
}

export async function writeSecret(
	companyRoot: string,
	input: SecretWriteInput,
): Promise<SecretMetadata> {
	await ensureMasterKey(companyRoot)
	const masterKey = await loadMasterKey(companyRoot)
	const encryptedValue = await encryptToBase64(input.value, masterKey)

	const secret: Secret = {
		service: input.name,
		type: input.type ?? 'api_token',
		created_at: new Date().toISOString(),
		created_by: input.createdBy,
		value: encryptedValue,
		allowed_agents: input.allowedAgents ?? [],
		usage: input.usage ?? '',
		encrypted: true,
	}

	await writeYaml(secretFilePath(companyRoot, input.name), secret)

	return {
		name: input.name,
		service: secret.service,
		type: secret.type,
		created_at: secret.created_at,
		created_by: secret.created_by,
		allowed_agents: secret.allowed_agents,
		usage: secret.usage,
		encrypted: secret.encrypted,
		hasValue: true,
	}
}

export async function deleteSecret(companyRoot: string, name: string): Promise<boolean> {
	const path = secretFilePath(companyRoot, name)
	if (!(await fileExists(path))) return false
	await rm(path)
	return true
}
