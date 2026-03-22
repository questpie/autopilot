import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { ApiServer } from '../src/api/server'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import { createTask } from '../src/fs/tasks'
import { createPin } from '../src/fs/pins'
import { appendActivity } from '../src/fs/activity'

describe('ApiServer', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let port: number
	let server: ApiServer

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
		port = 10000 + Math.floor(Math.random() * 50000)

		await writeYaml(join(companyRoot, 'company.yaml'), {
			name: 'TestCorp',
			slug: 'testcorp',
			description: 'A test company',
			owner: { name: 'Tester', email: 'test@test.com' },
		})

		await writeYaml(join(companyRoot, 'team', 'agents.yaml'), {
			agents: [
				{
					id: 'peter',
					name: 'Peter',
					role: 'developer',
					description: 'Writes code',
					fs_scope: { read: ['/projects/**'], write: ['/projects/**'] },
				},
				{
					id: 'anna',
					name: 'Anna',
					role: 'reviewer',
					description: 'Reviews code',
					fs_scope: { read: ['/projects/**'], write: ['/tasks/**'] },
				},
			],
		})

		server = new ApiServer({ companyRoot, port })
		await server.start()
	})

	afterEach(async () => {
		server.stop()
		await cleanup()
	})

	test('/api/status returns 200 with company info', async () => {
		const res = await fetch(`http://localhost:${port}/api/status`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body.company).toBe('TestCorp')
		expect(body.agentCount).toBe(2)
		expect(typeof body.activeTasks).toBe('number')
	})

	test('/api/agents returns agents array', async () => {
		const res = await fetch(`http://localhost:${port}/api/agents`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(Array.isArray(body)).toBe(true)
		expect(body).toHaveLength(2)
		expect(body[0].id).toBe('peter')
		expect(body[1].id).toBe('anna')
	})

	test('/api/tasks returns tasks', async () => {
		await createTask(companyRoot, {
			title: 'Test task',
			type: 'implementation',
			status: 'backlog',
			priority: 'medium',
			created_by: 'peter',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})

		const res = await fetch(`http://localhost:${port}/api/tasks`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(Array.isArray(body)).toBe(true)
		expect(body.length).toBeGreaterThanOrEqual(1)
		expect(body[0].title).toBe('Test task')
	})

	test('/api/tasks filters by status and agent', async () => {
		await createTask(companyRoot, {
			title: 'Active task',
			type: 'implementation',
			status: 'in_progress',
			priority: 'medium',
			created_by: 'peter',
			assigned_to: 'peter',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		await createTask(companyRoot, {
			title: 'Backlog task',
			type: 'planning',
			status: 'backlog',
			priority: 'low',
			created_by: 'anna',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})

		const res = await fetch(`http://localhost:${port}/api/tasks?status=in_progress&agent=peter`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(body).toHaveLength(1)
		expect(body[0].title).toBe('Active task')
	})

	test('/api/pins returns pins', async () => {
		await createPin(companyRoot, {
			id: `pin-${Date.now().toString(36)}`,
			group: 'alerts',
			title: 'Test pin',
			content: '',
			type: 'info',
			created_by: 'peter',
			created_at: new Date().toISOString(),
			metadata: {},
		})

		const res = await fetch(`http://localhost:${port}/api/pins`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(Array.isArray(body)).toBe(true)
		expect(body.length).toBeGreaterThanOrEqual(1)
	})

	test('/fs/ serves directory listing from company root', async () => {
		const res = await fetch(`http://localhost:${port}/fs/`)
		expect(res.status).toBe(200)

		const body = await res.json()
		expect(Array.isArray(body)).toBe(true)
		const names = body.map((e: { name: string }) => e.name)
		expect(names).toContain('team')
		expect(names).toContain('tasks')
	})

	test('/fs/ serves markdown file with correct content type', async () => {
		await mkdir(join(companyRoot, 'docs'), { recursive: true })
		await Bun.write(join(companyRoot, 'docs', 'readme.md'), '# Hello World\n')

		const res = await fetch(`http://localhost:${port}/fs/docs/readme.md`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('text/markdown')

		const body = await res.text()
		expect(body).toBe('# Hello World\n')
	})

	test('/fs/ serves yaml file with correct content type', async () => {
		const res = await fetch(`http://localhost:${port}/fs/company.yaml`)
		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('text/yaml')
	})

	test('/fs/ returns 404 for non-existent file', async () => {
		const res = await fetch(`http://localhost:${port}/fs/does-not-exist.txt`)
		expect(res.status).toBe(404)
	})

	test('returns 404 for unknown route', async () => {
		const res = await fetch(`http://localhost:${port}/unknown`)
		expect(res.status).toBe(404)
	})

	test('CORS headers are present', async () => {
		const res = await fetch(`http://localhost:${port}/api/status`)
		expect(res.headers.get('access-control-allow-origin')).toBe('*')
	})

	test('stop can be called multiple times safely', () => {
		server.stop()
		server.stop()
	})
})
