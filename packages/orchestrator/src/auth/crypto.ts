/**
 * Secrets encryption using AES-256-GCM (Web Crypto API).
 *
 * Master key can come from:
 * 1. AUTOPILOT_MASTER_KEY env var (preferred for production)
 * 2. secrets/.master-key file (for local development)
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'

const IV_LENGTH = 12

/**
 * Ensure a master key exists. Creates one if missing (dev mode).
 */
export async function ensureMasterKey(companyRoot: string): Promise<void> {
	if (process.env.AUTOPILOT_MASTER_KEY) {
		return
	}

	const keyPath = join(companyRoot, 'secrets', '.master-key')
	if (!existsSync(keyPath)) {
		const keyBytes = crypto.getRandomValues(new Uint8Array(32))
		await mkdir(join(companyRoot, 'secrets'), { recursive: true })
		await writeFile(keyPath, Buffer.from(keyBytes).toString('base64'), 'utf-8')
		await chmod(keyPath, 0o600)
		console.warn('[secrets] Master key generated at secrets/.master-key')
		console.warn('[secrets] For production, set AUTOPILOT_MASTER_KEY env variable instead')
	}
}

/**
 * Load the master key from env var or file and import as CryptoKey.
 */
export async function loadMasterKey(companyRoot: string): Promise<CryptoKey> {
	let keyBase64: string

	if (process.env.AUTOPILOT_MASTER_KEY) {
		keyBase64 = process.env.AUTOPILOT_MASTER_KEY
	} else {
		keyBase64 = await readFile(join(companyRoot, 'secrets', '.master-key'), 'utf-8')
	}

	return crypto.subtle.importKey(
		'raw',
		Buffer.from(keyBase64.trim(), 'base64'),
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns IV (12 bytes) + ciphertext concatenated.
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<Buffer> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv, tagLength: 128 },
		key,
		new TextEncoder().encode(plaintext),
	)
	const result = new Uint8Array(iv.length + ciphertext.byteLength)
	result.set(iv, 0)
	result.set(new Uint8Array(ciphertext), iv.length)
	return Buffer.from(result)
}

/**
 * Decrypt data encrypted with AES-256-GCM.
 * Expects IV (12 bytes) + ciphertext concatenated.
 */
export async function decrypt(encrypted: Buffer, key: CryptoKey): Promise<string> {
	const iv = encrypted.subarray(0, IV_LENGTH)
	const ciphertext = encrypted.subarray(IV_LENGTH)
	const decrypted = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: new Uint8Array(iv), tagLength: 128 },
		key,
		new Uint8Array(ciphertext),
	)
	return new TextDecoder().decode(decrypted)
}
