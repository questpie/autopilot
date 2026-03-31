import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeYaml } from '../src/fs/yaml'
import { Watcher, parseWatchEvent } from '../src/watcher/watcher'
import type { WatchEvent } from '../src/watcher/watcher'
import { createTestCompany } from './helpers'

describe('parseWatchEvent', () => {
	test('parses team config path (agents/dev.yaml)', () => {
		const event = parseWatchEvent('/company', '/company/team/agents/dev.yaml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'agents/dev.yaml',
			path: '/company/team/agents/dev.yaml',
		})
	})

	test('parses team config path (agents/dev.yml)', () => {
		const event = parseWatchEvent('/company', '/company/team/agents/dev.yml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'agents/dev.yml',
			path: '/company/team/agents/dev.yml',
		})
	})

	test('parses nested team config path (workflows)', () => {
		const event = parseWatchEvent('/company', '/company/team/workflows/deploy.yaml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'workflows/deploy.yaml',
			path: '/company/team/workflows/deploy.yaml',
		})
	})

	test('parses role prompt file', () => {
		const event = parseWatchEvent('/company', '/company/team/roles/developer.md')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'roles/developer.md',
			path: '/company/team/roles/developer.md',
		})
	})

	test('parses company.yaml', () => {
		const event = parseWatchEvent('/company', '/company/company.yaml')
		expect(event).toEqual({
			type: 'config_changed',
			file: 'company.yaml',
			path: '/company/company.yaml',
		})
	})

	test('parses knowledge file', () => {
		const event = parseWatchEvent('/company', '/company/knowledge/guide.md')
		expect(event).toEqual({
			type: 'knowledge_changed',
			file: 'guide.md',
			path: '/company/knowledge/guide.md',
		})
	})

	test('parses artifact config', () => {
		const event = parseWatchEvent('/company', '/company/artifacts/web-app/.artifact.yaml')
		expect(event).toEqual({
			type: 'artifact_changed',
			artifactId: 'web-app',
			path: '/company/artifacts/web-app/.artifact.yaml',
		})
	})

	test('parses dashboard layout file', () => {
		const event = parseWatchEvent('/company', '/company/dashboard/layout.yaml')
		expect(event).toEqual({
			type: 'dashboard_changed',
			file: 'layout.yaml',
			path: '/company/dashboard/layout.yaml',
		})
	})

	test('ignores dashboard/pins/ (pins are DB-only)', () => {
		const event = parseWatchEvent('/company', '/company/dashboard/pins/pin-001.yaml')
		expect(event).toBeNull()
	})

	test('ignores tasks/ (tasks are DB-only)', () => {
		const event = parseWatchEvent('/company', '/company/tasks/active/TASK-001.yaml')
		expect(event).toBeNull()
	})

	test('ignores comms/ (messages are DB-only)', () => {
		const event = parseWatchEvent('/company', '/company/comms/channels/general/msg-001.yaml')
		expect(event).toBeNull()
	})

	test('returns null for unknown paths', () => {
		const event = parseWatchEvent('/company', '/company/random/unknown-file.txt')
		expect(event).toBeNull()
	})
})

describe('Watcher', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
	})

	afterEach(async () => {
		await cleanup()
	})

	test('triggers config_changed when agent file is modified', async () => {
		const events: WatchEvent[] = []

		const watcher = new Watcher({
			companyRoot,
			onEvent: async (event) => {
				events.push(event)
			},
			debounceMs: 100,
		})

		await watcher.start()
		await new Promise((r) => setTimeout(r, 300))

		await writeYaml(join(companyRoot, 'team', 'agents', 'dev.yaml'), {
			id: 'dev',
			name: 'Developer',
			role: 'developer',
			description: 'Dev',
			model: 'claude',
			fs_scope: { read: ['**'], write: ['**'] },
		})

		await new Promise((r) => setTimeout(r, 1000))
		await watcher.stop()

		expect(events.length).toBeGreaterThanOrEqual(1)
		const configEvent = events.find((e) => e.type === 'config_changed')
		expect(configEvent).toBeDefined()
	})

	test('triggers knowledge_changed when knowledge file created', async () => {
		const events: WatchEvent[] = []
		await mkdir(join(companyRoot, 'knowledge'), { recursive: true })

		const watcher = new Watcher({
			companyRoot,
			onEvent: async (event) => {
				events.push(event)
			},
			debounceMs: 100,
		})

		await watcher.start()
		await new Promise((r) => setTimeout(r, 300))

		await writeFile(join(companyRoot, 'knowledge', 'guide.md'), '# Guide\n\nContent here.')

		await new Promise((r) => setTimeout(r, 1000))
		await watcher.stop()

		const knowledgeEvent = events.find((e) => e.type === 'knowledge_changed')
		expect(knowledgeEvent).toBeDefined()
	})

	test('stop closes watcher cleanly', async () => {
		const watcher = new Watcher({
			companyRoot,
			onEvent: async () => {},
			debounceMs: 100,
		})

		await watcher.start()
		await watcher.stop()

		// Should not throw when stopping again
		await watcher.stop()
	})
})
