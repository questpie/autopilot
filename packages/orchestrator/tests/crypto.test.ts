import { describe, test, expect } from 'bun:test'
import { encrypt, decrypt, ensureMasterKey, loadMasterKey } from '../src/auth/crypto'
import { createTestCompany } from './helpers'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

describe('crypto', () => {
	test('encrypt and decrypt roundtrip', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const plaintext = 'super-secret-api-key-12345'
			const encrypted = await encrypt(plaintext, key)

			expect(encrypted).toBeInstanceOf(Buffer)
			expect(encrypted.length).toBeGreaterThan(12)

			const decrypted = await decrypt(encrypted, key)
			expect(decrypted).toBe(plaintext)
		} finally {
			await cleanup()
		}
	})

	test('different encryptions of same text produce different ciphertext', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const plaintext = 'test-data'
			const enc1 = await encrypt(plaintext, key)
			const enc2 = await encrypt(plaintext, key)

			// Different IVs → different ciphertext
			expect(Buffer.compare(enc1, enc2)).not.toBe(0)

			// But both decrypt to same value
			expect(await decrypt(enc1, key)).toBe(plaintext)
			expect(await decrypt(enc2, key)).toBe(plaintext)
		} finally {
			await cleanup()
		}
	})

	test('decrypt fails with wrong key', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const encrypted = await encrypt('secret', key)

			// Import a different random key
			const wrongKeyBytes = crypto.getRandomValues(new Uint8Array(32))
			const wrongKey = await crypto.subtle.importKey(
				'raw',
				wrongKeyBytes,
				{ name: 'AES-GCM', length: 256 },
				false,
				['encrypt', 'decrypt'],
			)

			expect(decrypt(encrypted, wrongKey)).rejects.toThrow()
		} finally {
			await cleanup()
		}
	})

	test('ensureMasterKey creates key file if missing', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await ensureMasterKey(root)

			const keyFile = Bun.file(join(root, 'secrets', '.master-key'))
			expect(await keyFile.exists()).toBe(true)

			const content = await keyFile.text()
			expect(content.trim().length).toBeGreaterThan(0)
		} finally {
			await cleanup()
		}
	})

	test('ensureMasterKey is idempotent', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await ensureMasterKey(root)
			const key1 = await Bun.file(join(root, 'secrets', '.master-key')).text()

			await ensureMasterKey(root)
			const key2 = await Bun.file(join(root, 'secrets', '.master-key')).text()

			expect(key1).toBe(key2)
		} finally {
			await cleanup()
		}
	})

	test('handles empty string encryption', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const encrypted = await encrypt('', key)
			const decrypted = await decrypt(encrypted, key)
			expect(decrypted).toBe('')
		} finally {
			await cleanup()
		}
	})

	test('handles unicode content', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const plaintext = '🔐 Tajný kľúč with ščťžýáíé'
			const encrypted = await encrypt(plaintext, key)
			const decrypted = await decrypt(encrypted, key)
			expect(decrypted).toBe(plaintext)
		} finally {
			await cleanup()
		}
	})

	test('handles long content', async () => {
		const { root, cleanup } = await createTestCompany()
		try {
			await mkdir(join(root, 'secrets'), { recursive: true })
			await ensureMasterKey(root)
			const key = await loadMasterKey(root)

			const plaintext = 'x'.repeat(10_000)
			const encrypted = await encrypt(plaintext, key)
			const decrypted = await decrypt(encrypted, key)
			expect(decrypted).toBe(plaintext)
		} finally {
			await cleanup()
		}
	})
})
