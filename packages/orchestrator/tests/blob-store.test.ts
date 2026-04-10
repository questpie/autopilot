/**
 * Tests for the content-addressed blob store.
 */
import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BlobStore } from '../src/services/blob-store'

describe('BlobStore', () => {
	const dataDir = join(tmpdir(), `qp-blobs-${Date.now()}`)
	let store: BlobStore

	beforeAll(async () => {
		await mkdir(dataDir, { recursive: true })
		store = new BlobStore(dataDir)
	})

	afterAll(async () => {
		await rm(dataDir, { recursive: true, force: true })
	})

	test('put and get round-trip', async () => {
		const content = Buffer.from('hello world')
		const { storageKey, contentHash, size } = await store.put(content)

		expect(storageKey).toMatch(/^sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/)
		expect(contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
		expect(size).toBe(11)

		const retrieved = await store.get(storageKey)
		expect(retrieved).not.toBeNull()
		expect(retrieved!.toString()).toBe('hello world')
	})

	test('deduplication — same content produces same key', async () => {
		const content = Buffer.from('deduplicate me')
		const first = await store.put(content)
		const second = await store.put(content)

		expect(first.storageKey).toBe(second.storageKey)
		expect(first.contentHash).toBe(second.contentHash)
	})

	test('different content produces different keys', async () => {
		const a = await store.put(Buffer.from('content-a'))
		const b = await store.put(Buffer.from('content-b'))
		expect(a.storageKey).not.toBe(b.storageKey)
	})

	test('exists returns true for stored blobs', async () => {
		const { storageKey } = await store.put(Buffer.from('exists-test'))
		expect(store.exists(storageKey)).toBe(true)
		expect(store.exists('sha256/xx/nonexistent')).toBe(false)
	})

	test('get returns null for missing key', async () => {
		const result = await store.get('sha256/00/0000000000000000000000000000000000000000000000000000000000000000')
		expect(result).toBeNull()
	})

	test('delete removes blob', async () => {
		const { storageKey } = await store.put(Buffer.from('delete-me'))
		expect(store.exists(storageKey)).toBe(true)
		await store.delete(storageKey)
		expect(store.exists(storageKey)).toBe(false)
	})

	test('binary content preserved', async () => {
		const binary = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x01])
		const { storageKey } = await store.put(binary)
		const retrieved = await store.get(storageKey)
		expect(retrieved).toEqual(binary)
	})
})
