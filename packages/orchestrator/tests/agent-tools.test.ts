import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createAutopilotTools, executeTool } from '../src/agent/tools'
import type { ToolContext } from '../src/agent/tools'
import { createTestCompany } from './helpers'
import { createTask } from '../src/fs/tasks'
import { readYamlUnsafe, writeYaml } from '../src/fs/yaml'

describe('agent tools', () => {
	let cleanup: () => Promise<void>
	let root: string
	let ctx: ToolContext

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const tc = await createTestCompany()
		root = tc.root
		cleanup = tc.cleanup
		ctx = { companyRoot: root, agentId: 'test-agent' }

		// Create extra dirs not in default helper
		await mkdir(join(root, 'knowledge', 'technical'), { recursive: true })
		await mkdir(join(root, 'knowledge', 'brand'), { recursive: true })
		await mkdir(join(root, 'secrets'), { recursive: true })

		return createAutopilotTools(root)
	}

	describe('search_knowledge', () => {
		it('finds a file with matching content', async () => {
			const tools = await setup()

			await Bun.write(
				join(root, 'knowledge', 'technical', 'api-design.md'),
				'# API Design\nUse REST endpoints for all services.\nKeep responses consistent.',
			)
			await Bun.write(
				join(root, 'knowledge', 'brand', 'tone.md'),
				'# Tone Guide\nBe friendly and professional.',
			)

			const result = await executeTool(tools, 'search_knowledge', { query: 'REST' }, ctx)
			expect(result.isError).toBeUndefined()
			expect(result.content[0]!.text).toContain('api-design.md')
			expect(result.content[0]!.text).toContain('REST')
		})

		it('scopes search to a specific path', async () => {
			const tools = await setup()

			await Bun.write(
				join(root, 'knowledge', 'technical', 'apis.md'),
				'# APIs\nGraphQL is also supported.',
			)
			await Bun.write(
				join(root, 'knowledge', 'brand', 'apis.md'),
				'# Brand APIs\nUse our brand API portal.',
			)

			const result = await executeTool(
				tools,
				'search_knowledge',
				{ query: 'API', scope: 'brand' },
				ctx,
			)
			expect(result.content[0]!.text).toContain('apis.md')
			expect(result.content[0]!.text).toContain('Brand API')
		})

		it('returns no results when nothing matches', async () => {
			const tools = await setup()

			const result = await executeTool(
				tools,
				'search_knowledge',
				{ query: 'nonexistent-term-xyz' },
				ctx,
			)
			expect(result.content[0]!.text).toBe('No results found.')
		})
	})

	describe('update_knowledge', () => {
		it('creates a new knowledge file', async () => {
			const tools = await setup()

			const result = await executeTool(
				tools,
				'update_knowledge',
				{
					path: 'technical/new-guide.md',
					content: '# New Guide\nSome content here.',
					reason: 'Adding new technical guide',
				},
				ctx,
			)

			expect(result.isError).toBeUndefined()
			expect(result.content[0]!.text).toContain('new-guide.md')

			const written = await Bun.file(join(root, 'knowledge', 'technical', 'new-guide.md')).text()
			expect(written).toBe('# New Guide\nSome content here.')
		})

		it('creates nested directories if needed', async () => {
			const tools = await setup()

			await executeTool(
				tools,
				'update_knowledge',
				{
					path: 'deep/nested/path/doc.md',
					content: '# Deep Doc',
				},
				ctx,
			)

			const written = await Bun.file(join(root, 'knowledge', 'deep', 'nested', 'path', 'doc.md')).text()
			expect(written).toBe('# Deep Doc')
		})
	})

	describe('ask_agent', () => {
		it('creates a direct message and pin', async () => {
			const tools = await setup()

			const result = await executeTool(
				tools,
				'ask_agent',
				{
					to: 'planner',
					question: 'What is the priority of task-123?',
					reason: 'Need to schedule work',
					urgency: 'high',
				},
				ctx,
			)

			expect(result.isError).toBeUndefined()
			expect(result.content[0]!.text).toContain('Question sent to planner')

			// Verify direct message was created
			const dmDir = join(root, 'comms', 'direct', 'planner--test-agent')
			const files = await readdir(dmDir)
			expect(files.length).toBeGreaterThan(0)

			const msgFile = files.find((f) => f.endsWith('.yaml'))
			expect(msgFile).toBeDefined()

			const msg = await readYamlUnsafe(join(dmDir, msgFile!)) as { content: string }
			expect(msg.content).toContain('What is the priority of task-123?')

			// Verify pin was created
			const pinFiles = await readdir(join(root, 'dashboard', 'pins'))
			const pinYamls = pinFiles.filter((f) => f.endsWith('.yaml'))
			expect(pinYamls.length).toBeGreaterThan(0)
		})
	})

	describe('resolve_blocker', () => {
		it('marks blocker as resolved and moves task back to active', async () => {
			const tools = await setup()

			const task = await createTask(root, {
				id: 'task-blocked-1',
				title: 'Blocked task',
				type: 'implementation',
				status: 'blocked',
				created_by: 'planner',
				blockers: [
					{
						type: 'human_required',
						reason: 'Need API key from vendor',
						assigned_to: 'dominik',
						resolved: false,
					},
				],
			})

			const result = await executeTool(
				tools,
				'resolve_blocker',
				{
					task_id: 'task-blocked-1',
					note: 'API key obtained from vendor portal',
				},
				ctx,
			)

			expect(result.isError).toBeUndefined()
			expect(result.content[0]!.text).toContain('Blocker resolved')

			// Task should have moved to active (in_progress)
			const activeFile = await Bun.file(
				join(root, 'tasks', 'active', 'task-blocked-1.yaml'),
			).exists()
			expect(activeFile).toBe(true)
		})

		it('returns error when task not found', async () => {
			const tools = await setup()

			const result = await executeTool(
				tools,
				'resolve_blocker',
				{ task_id: 'nonexistent', note: 'resolved' },
				ctx,
			)

			expect(result.isError).toBe(true)
			expect(result.content[0]!.text).toContain('Task not found')
		})

		it('returns error when no unresolved blockers exist', async () => {
			const tools = await setup()

			await createTask(root, {
				id: 'task-no-blockers',
				title: 'No blockers task',
				type: 'implementation',
				status: 'backlog',
				created_by: 'planner',
			})

			const result = await executeTool(
				tools,
				'resolve_blocker',
				{ task_id: 'task-no-blockers', note: 'nothing to resolve' },
				ctx,
			)

			expect(result.isError).toBe(true)
			expect(result.content[0]!.text).toContain('No unresolved blockers')
		})
	})

	describe('http_request', () => {
		it('makes a GET request without secret_ref', async () => {
			const tools = await setup()

			// Use a data: URL trick or just test that fetch is called
			// We'll hit a URL that won't connect but verify error handling works
			const result = await executeTool(
				tools,
				'http_request',
				{
					method: 'GET',
					url: 'http://127.0.0.1:1/nonexistent',
				},
				ctx,
			)

			// Should get a connection error, not a tool schema error
			expect(result.isError).toBe(true)
			expect(result.content[0]!.text).toContain('HTTP request failed')
		})

		it('rejects when agent not in allowed_agents for secret', async () => {
			const tools = await setup()

			await writeYaml(join(root, 'secrets', 'vendor-api.yaml'), {
				api_key: 'secret-key-123',
				allowed_agents: ['other-agent'],
			})

			const result = await executeTool(
				tools,
				'http_request',
				{
					method: 'GET',
					url: 'https://api.example.com/data',
					secret_ref: 'vendor-api',
				},
				ctx,
			)

			expect(result.isError).toBe(true)
			expect(result.content[0]!.text).toContain('not allowed')
		})

		it('returns error when secret file not found', async () => {
			const tools = await setup()

			const result = await executeTool(
				tools,
				'http_request',
				{
					method: 'GET',
					url: 'https://api.example.com/data',
					secret_ref: 'nonexistent-secret',
				},
				ctx,
			)

			expect(result.isError).toBe(true)
			expect(result.content[0]!.text).toContain('Failed to load secret')
		})
	})
})
