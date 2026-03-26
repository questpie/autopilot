import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ArtifactRouter } from '../src/artifact/router'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { stringify } from 'yaml'

const TEST_ROOT = join(import.meta.dir, '.test-artifact-root')

function setupArtifact(name: string, config: Record<string, unknown>) {
	const dir = join(TEST_ROOT, 'artifacts', name)
	mkdirSync(dir, { recursive: true })
	writeFileSync(join(dir, '.artifact.yaml'), stringify(config))
}

describe('ArtifactRouter', () => {
	let router: ArtifactRouter

	beforeEach(() => {
		mkdirSync(join(TEST_ROOT, 'artifacts'), { recursive: true })
		router = new ArtifactRouter(TEST_ROOT)
	})

	afterEach(() => {
		rmSync(TEST_ROOT, { recursive: true, force: true })
	})

	test('readConfig reads .artifact.yaml', async () => {
		setupArtifact('test-app', {
			name: 'test-app',
			serve: 'bunx serve -p {port}',
			build: 'bun install',
			health: '/health',
			timeout: '10m',
		})

		const config = await router.readConfig('test-app')
		expect(config.name).toBe('test-app')
		expect(config.serve).toBe('bunx serve -p {port}')
		expect(config.build).toBe('bun install')
		expect(config.health).toBe('/health')
		expect(config.timeout).toBe('10m')
	})

	test('allocatePort increments from 4100', async () => {
		expect(await router.allocatePort()).toBe(4100)
		expect(await router.allocatePort()).toBe(4101)
		expect(await router.allocatePort()).toBe(4102)
	})

	test('allocatePort wraps around after 4199', async () => {
		for (let i = 0; i < 100; i++) {
			await router.allocatePort()
		}
		expect(await router.allocatePort()).toBe(4100)
	})

	test('list returns empty initially', () => {
		expect(router.list()).toEqual([])
	})

	test('stop on non-existent artifact does not throw', async () => {
		await expect(router.stop('nonexistent')).resolves.toBeUndefined()
	})

	test('stopAll clears everything when empty', async () => {
		await expect(router.stopAll()).resolves.toBeUndefined()
		expect(router.list()).toEqual([])
	})

	test('readConfig throws on missing artifact', async () => {
		await expect(router.readConfig('missing')).rejects.toThrow()
	})
})
