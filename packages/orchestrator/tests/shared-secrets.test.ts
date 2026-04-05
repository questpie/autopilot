/**
 * Tests for shared secret store and distribution.
 *
 * Covers:
 * - SecretRef schema parsing (shared + local)
 * - Encryption/decryption roundtrip
 * - Missing master key fails clearly
 * - SecretService CRUD
 * - Provider-side shared secret resolution
 * - Worker-scoped delivery (only worker/provider scope, never orchestrator_only)
 * - Existing local secret ref modes still work
 * - SharedSecretInput validation
 */
import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test'
import { randomBytes } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
	SecretRefSchema,
	SharedSecretInputSchema,
	SharedSecretMetadataSchema,
	ClaimedRunSchema,
} from '@questpie/autopilot-spec'
import { encrypt, decrypt, getMasterKey, MasterKeyError, hasMasterKey } from '../src/crypto'
import { SecretService } from '../src/services/secrets'
import { resolveSecrets } from '../src/providers/handler-runtime'
import { resolveSecretRefs as workerResolve } from '../../worker/src/secrets'
import { createCompanyDb, type CompanyDbResult } from '../src/db'

// ─── Test Setup ──────────────────────────────────────────────────────────────

let testDir: string
let dbResult: CompanyDbResult
let secretService: SecretService

const TEST_MASTER_KEY = randomBytes(32).toString('hex')

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-secrets-test-${Date.now()}`)
	await mkdir(testDir, { recursive: true })

	// Set master key for tests
	process.env.AUTOPILOT_MASTER_KEY = TEST_MASTER_KEY

	dbResult = await createCompanyDb(testDir)
	secretService = new SecretService(dbResult.db)
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
	delete process.env.AUTOPILOT_MASTER_KEY
})

// ─── Schema Parsing ─────────────────────────────────────────────────────────

describe('SecretRef Schema', () => {
	test('parses local env ref', () => {
		const result = SecretRefSchema.safeParse({
			name: 'my-token',
			source: 'env',
			key: 'MY_TOKEN',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.source).toBe('env')
			expect(result.data.name).toBe('my-token')
		}
	})

	test('parses local file ref', () => {
		const result = SecretRefSchema.safeParse({
			name: 'key-file',
			source: 'file',
			key: '/path/to/key',
		})
		expect(result.success).toBe(true)
	})

	test('parses local exec ref', () => {
		const result = SecretRefSchema.safeParse({
			name: 'dynamic-token',
			source: 'exec',
			key: 'vault read secret/token',
		})
		expect(result.success).toBe(true)
	})

	test('parses shared ref', () => {
		const result = SecretRefSchema.safeParse({
			name: 'TELEGRAM_BOT_TOKEN',
			source: 'shared',
			description: 'Bot token stored in orchestrator',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.source).toBe('shared')
			expect(result.data.name).toBe('TELEGRAM_BOT_TOKEN')
		}
	})

	test('shared ref does not require key field', () => {
		const result = SecretRefSchema.safeParse({
			name: 'MY_SECRET',
			source: 'shared',
		})
		expect(result.success).toBe(true)
	})

	test('local ref requires key field', () => {
		const result = SecretRefSchema.safeParse({
			name: 'MY_SECRET',
			source: 'env',
		})
		expect(result.success).toBe(false)
	})

	test('rejects invalid source', () => {
		const result = SecretRefSchema.safeParse({
			name: 'bad',
			source: 'magic',
			key: 'something',
		})
		expect(result.success).toBe(false)
	})

	test('array of mixed refs parses correctly', () => {
		const refs = [
			{ name: 'local-env', source: 'env', key: 'TOKEN' },
			{ name: 'shared-token', source: 'shared' },
			{ name: 'local-file', source: 'file', key: '/path' },
		]
		for (const ref of refs) {
			expect(SecretRefSchema.safeParse(ref).success).toBe(true)
		}
	})
})

describe('SharedSecretInput Schema', () => {
	test('validates correct input', () => {
		const result = SharedSecretInputSchema.safeParse({
			name: 'TELEGRAM_BOT_TOKEN',
			scope: 'provider',
			value: 'abc123',
			description: 'Bot token',
		})
		expect(result.success).toBe(true)
	})

	test('rejects name with spaces', () => {
		const result = SharedSecretInputSchema.safeParse({
			name: 'bad name',
			scope: 'provider',
			value: 'abc123',
		})
		expect(result.success).toBe(false)
	})

	test('rejects invalid scope', () => {
		const result = SharedSecretInputSchema.safeParse({
			name: 'VALID_NAME',
			scope: 'everyone',
			value: 'abc123',
		})
		expect(result.success).toBe(false)
	})

	test('accepts all valid scopes', () => {
		for (const scope of ['worker', 'provider', 'orchestrator_only']) {
			const result = SharedSecretInputSchema.safeParse({
				name: 'TEST',
				scope,
				value: 'abc123',
			})
			expect(result.success).toBe(true)
		}
	})
})

describe('ClaimedRun resolved_shared_secrets', () => {
	test('ClaimedRunSchema accepts resolved_shared_secrets field', () => {
		const result = ClaimedRunSchema.safeParse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
			resolved_shared_secrets: { TELEGRAM_BOT_TOKEN: 'abc123' },
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.resolved_shared_secrets).toEqual({ TELEGRAM_BOT_TOKEN: 'abc123' })
		}
	})

	test('defaults to empty object if not provided', () => {
		const result = ClaimedRunSchema.safeParse({
			id: 'run-1',
			agent_id: 'dev',
			task_id: null,
			runtime: 'claude-code',
			status: 'claimed',
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.resolved_shared_secrets).toEqual({})
		}
	})
})

// ─── Encryption ─────────────────────────────────────────────────────────────

describe('Encryption', () => {
	test('roundtrip encrypt/decrypt', () => {
		const plaintext = 'super-secret-token-value-12345'
		const payload = encrypt(plaintext)
		const result = decrypt(payload)
		expect(result).toBe(plaintext)
	})

	test('encrypts unicode strings', () => {
		const plaintext = 'token-with-unicode-\u{1F600}-\u{1F30D}'
		const result = decrypt(encrypt(plaintext))
		expect(result).toBe(plaintext)
	})

	test('encrypts empty-ish strings', () => {
		const result = decrypt(encrypt('x'))
		expect(result).toBe('x')
	})

	test('different encryptions produce different ciphertexts (random IV)', () => {
		const plaintext = 'same-input'
		const a = encrypt(plaintext)
		const b = encrypt(plaintext)
		expect(a.ciphertext).not.toBe(b.ciphertext)
		expect(a.iv).not.toBe(b.iv)
	})

	test('tampered ciphertext fails to decrypt', () => {
		const payload = encrypt('secret')
		payload.ciphertext = Buffer.from('tampered').toString('base64')
		expect(() => decrypt(payload)).toThrow()
	})

	test('tampered auth tag fails to decrypt', () => {
		const payload = encrypt('secret')
		payload.auth_tag = randomBytes(16).toString('base64')
		expect(() => decrypt(payload)).toThrow()
	})

	test('missing master key fails clearly', () => {
		const saved = process.env.AUTOPILOT_MASTER_KEY
		delete process.env.AUTOPILOT_MASTER_KEY
		try {
			expect(() => getMasterKey()).toThrow(MasterKeyError)
			expect(() => getMasterKey()).toThrow(/AUTOPILOT_MASTER_KEY is not set/)
			expect(hasMasterKey()).toBe(false)
		} finally {
			process.env.AUTOPILOT_MASTER_KEY = saved
		}
	})

	test('malformed master key fails clearly', () => {
		const saved = process.env.AUTOPILOT_MASTER_KEY
		process.env.AUTOPILOT_MASTER_KEY = 'too-short'
		try {
			expect(() => getMasterKey()).toThrow(MasterKeyError)
			expect(() => getMasterKey()).toThrow(/64 hex characters/)
		} finally {
			process.env.AUTOPILOT_MASTER_KEY = saved
		}
	})

	test('hasMasterKey returns true when set', () => {
		expect(hasMasterKey()).toBe(true)
	})
})

// ─── SecretService CRUD ─────────────────────────────────────────────────────

describe('SecretService', () => {
	test('set and get a secret', async () => {
		const meta = await secretService.set({
			name: 'TEST_TOKEN',
			scope: 'provider',
			value: 'my-secret-value',
			description: 'Test token',
		})
		expect(meta.name).toBe('TEST_TOKEN')
		expect(meta.scope).toBe('provider')
		expect(meta.description).toBe('Test token')

		const value = await secretService.getValue('TEST_TOKEN')
		expect(value).toBe('my-secret-value')
	})

	test('update existing secret', async () => {
		await secretService.set({
			name: 'UPDATE_ME',
			scope: 'worker',
			value: 'original',
		})
		expect(await secretService.getValue('UPDATE_ME')).toBe('original')

		await secretService.set({
			name: 'UPDATE_ME',
			scope: 'orchestrator_only',
			value: 'updated',
		})
		expect(await secretService.getValue('UPDATE_ME')).toBe('updated')

		const meta = await secretService.getMetadata('UPDATE_ME')
		expect(meta?.scope).toBe('orchestrator_only')
	})

	test('list returns metadata without values', async () => {
		await secretService.set({ name: 'LIST_A', scope: 'worker', value: 'a-val' })
		await secretService.set({ name: 'LIST_B', scope: 'provider', value: 'b-val' })

		const list = await secretService.list()
		const names = list.map((s) => s.name)
		expect(names).toContain('LIST_A')
		expect(names).toContain('LIST_B')

		// No raw values in list output
		for (const item of list) {
			const parsed = SharedSecretMetadataSchema.safeParse(item)
			expect(parsed.success).toBe(true)
			expect((item as Record<string, unknown>).value).toBeUndefined()
			expect((item as Record<string, unknown>).encrypted_value).toBeUndefined()
		}
	})

	test('get non-existent secret returns null', async () => {
		expect(await secretService.getValue('DOES_NOT_EXIST')).toBe(null)
		expect(await secretService.getMetadata('DOES_NOT_EXIST')).toBe(null)
	})

	test('delete a secret', async () => {
		await secretService.set({ name: 'DELETE_ME', scope: 'worker', value: 'gone-soon' })
		expect(await secretService.getValue('DELETE_ME')).toBe('gone-soon')

		const deleted = await secretService.delete('DELETE_ME')
		expect(deleted).toBe(true)

		expect(await secretService.getValue('DELETE_ME')).toBe(null)
	})

	test('delete non-existent returns false', async () => {
		const deleted = await secretService.delete('NEVER_EXISTED')
		expect(deleted).toBe(false)
	})
})

// ─── Scoped Resolution ──────────────────────────────────────────────────────

describe('Scoped Resolution', () => {
	beforeEach(async () => {
		// Set up secrets with different scopes
		await secretService.set({ name: 'WORKER_SECRET', scope: 'worker', value: 'worker-val' })
		await secretService.set({ name: 'PROVIDER_SECRET', scope: 'provider', value: 'provider-val' })
		await secretService.set({ name: 'ORCH_ONLY_SECRET', scope: 'orchestrator_only', value: 'orch-val' })
	})

	test('worker delivery excludes orchestrator_only secrets', async () => {
		const resolved = await secretService.resolveForScopes(
			['WORKER_SECRET', 'PROVIDER_SECRET', 'ORCH_ONLY_SECRET'],
			['worker', 'provider'],
		)
		expect(resolved.get('WORKER_SECRET')).toBe('worker-val')
		expect(resolved.get('PROVIDER_SECRET')).toBe('provider-val')
		expect(resolved.has('ORCH_ONLY_SECRET')).toBe(false)
	})

	test('orchestrator can access all scopes', async () => {
		const resolved = await secretService.resolveForScopes(
			['WORKER_SECRET', 'PROVIDER_SECRET', 'ORCH_ONLY_SECRET'],
			['worker', 'provider', 'orchestrator_only'],
		)
		expect(resolved.get('WORKER_SECRET')).toBe('worker-val')
		expect(resolved.get('PROVIDER_SECRET')).toBe('provider-val')
		expect(resolved.get('ORCH_ONLY_SECRET')).toBe('orch-val')
	})

	test('missing secret names are silently skipped', async () => {
		const resolved = await secretService.resolveForScopes(
			['WORKER_SECRET', 'NONEXISTENT'],
			['worker', 'provider'],
		)
		expect(resolved.get('WORKER_SECRET')).toBe('worker-val')
		expect(resolved.has('NONEXISTENT')).toBe(false)
	})

	test('empty names list returns empty map', async () => {
		const resolved = await secretService.resolveForScopes([], ['worker'])
		expect(resolved.size).toBe(0)
	})
})

// ─── Provider-Side Resolution ───────────────────────────────────────────────

describe('Provider-Side Resolution (resolveSecrets)', () => {
	test('resolves shared refs via secretService', async () => {
		await secretService.set({ name: 'BOT_TOKEN', scope: 'provider', value: 'bot-123' })

		const refs = [
			{ name: 'BOT_TOKEN', source: 'shared' as const },
		]
		const resolved = await resolveSecrets(refs, secretService)
		expect(resolved.get('BOT_TOKEN')).toBe('bot-123')
	})

	test('resolves local env refs alongside shared refs', async () => {
		await secretService.set({ name: 'SHARED_ONE', scope: 'provider', value: 'shared-val' })
		process.env.TEST_LOCAL_SECRET = 'local-val'

		try {
			const refs = [
				{ name: 'SHARED_ONE', source: 'shared' as const },
				{ name: 'local-env', source: 'env' as const, key: 'TEST_LOCAL_SECRET' },
			]
			const resolved = await resolveSecrets(refs, secretService)
			expect(resolved.get('SHARED_ONE')).toBe('shared-val')
			expect(resolved.get('local-env')).toBe('local-val')
		} finally {
			delete process.env.TEST_LOCAL_SECRET
		}
	})

	test('shared refs without secretService are skipped', async () => {
		const refs = [
			{ name: 'ORPHAN', source: 'shared' as const },
		]
		const resolved = await resolveSecrets(refs)
		expect(resolved.has('ORPHAN')).toBe(false)
	})
})

// ─── Worker-Side Secret Resolution ──────────────────────────────────────────

describe('Worker-Side Secret Resolution', () => {
	test('resolves shared ref from preResolved map', () => {
		const refs = [{ name: 'MY_SHARED', source: 'shared' as const }]
		const preResolved = { MY_SHARED: 'delivered-value' }
		const { resolved, errors } = workerResolve(refs, preResolved)
		expect(resolved.get('MY_SHARED')).toBe('delivered-value')
		expect(errors).toHaveLength(0)
	})

	test('shared ref fails if not in preResolved', () => {
		const refs = [{ name: 'MISSING', source: 'shared' as const }]
		const { resolved, errors } = workerResolve(refs, {})
		expect(resolved.has('MISSING')).toBe(false)
		expect(errors).toHaveLength(1)
		expect(errors[0]).toContain('Shared secret not delivered')
	})

	test('local env ref still works', () => {
		process.env.TEST_WORKER_ENV = 'env-value'
		try {
			const refs = [{ name: 'local', source: 'env' as const, key: 'TEST_WORKER_ENV' }]
			const { resolved, errors } = workerResolve(refs)
			expect(resolved.get('local')).toBe('env-value')
			expect(errors).toHaveLength(0)
		} finally {
			delete process.env.TEST_WORKER_ENV
		}
	})

	test('mixed local and shared refs resolve together', () => {
		process.env.TEST_MIX_ENV = 'env-val'
		try {
			const refs = [
				{ name: 'env-ref', source: 'env' as const, key: 'TEST_MIX_ENV' },
				{ name: 'shared-ref', source: 'shared' as const },
			]
			const preResolved = { 'shared-ref': 'shared-val' }
			const { resolved, errors } = workerResolve(refs, preResolved)
			expect(resolved.get('env-ref')).toBe('env-val')
			expect(resolved.get('shared-ref')).toBe('shared-val')
			expect(errors).toHaveLength(0)
		} finally {
			delete process.env.TEST_MIX_ENV
		}
	})
})
