/**
 * Orchestrator-side secret encryption using AES-256-GCM.
 *
 * Master key is sourced from the AUTOPILOT_MASTER_KEY environment variable.
 * The key must be a 64-character hex string (32 bytes).
 *
 * If the key is missing or malformed, all encrypt/decrypt operations fail loudly.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16

export class MasterKeyError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'MasterKeyError'
	}
}

/**
 * Resolve and validate the master key from environment.
 * Returns the raw 32-byte key buffer.
 */
export function getMasterKey(): Buffer {
	const hex = process.env.AUTOPILOT_MASTER_KEY
	if (!hex) {
		throw new MasterKeyError(
			'AUTOPILOT_MASTER_KEY is not set. ' +
			'Shared secret storage requires a 64-character hex master key. ' +
			'Generate one with: openssl rand -hex 32',
		)
	}

	if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
		throw new MasterKeyError(
			'AUTOPILOT_MASTER_KEY must be exactly 64 hex characters (32 bytes). ' +
			'Generate one with: openssl rand -hex 32',
		)
	}

	return Buffer.from(hex, 'hex')
}

export interface EncryptedPayload {
	/** Base64-encoded ciphertext. */
	ciphertext: string
	/** Base64-encoded 12-byte IV. */
	iv: string
	/** Base64-encoded 16-byte GCM auth tag. */
	auth_tag: string
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns ciphertext, IV, and auth tag as base64 strings.
 */
export function encrypt(plaintext: string): EncryptedPayload {
	const key = getMasterKey()
	const iv = randomBytes(IV_LENGTH)
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf-8'),
		cipher.final(),
	])

	return {
		ciphertext: encrypted.toString('base64'),
		iv: iv.toString('base64'),
		auth_tag: cipher.getAuthTag().toString('base64'),
	}
}

/**
 * Decrypt an AES-256-GCM encrypted payload back to plaintext.
 * Throws if the auth tag doesn't match (tampered data) or key is wrong.
 */
export function decrypt(payload: EncryptedPayload): string {
	const key = getMasterKey()
	const iv = Buffer.from(payload.iv, 'base64')
	const authTag = Buffer.from(payload.auth_tag, 'base64')
	const ciphertext = Buffer.from(payload.ciphertext, 'base64')

	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
	decipher.setAuthTag(authTag)

	const decrypted = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	])

	return decrypted.toString('utf-8')
}

/**
 * Check whether the master key is available without throwing.
 * Use this for startup validation / health checks.
 */
export function hasMasterKey(): boolean {
	try {
		getMasterKey()
		return true
	} catch {
		return false
	}
}
