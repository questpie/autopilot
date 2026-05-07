/// <reference types="bun" />

import { basename } from 'node:path'

type JsonRecord = Record<string, unknown>

interface ProjectRecord {
	id: string
	name: string
	path: string
	git_remote: string | null
	default_branch: string | null
	registered_at: string
	metadata: string
}

const now = () => new Date().toISOString()

const records: Record<string, JsonRecord[]> = {
	company: [
		{
			name: 'Questpie',
			slug: 'questpie',
			description: 'Autopilot MVP',
			defaults: { runtime: 'claude-code', task_assignee: 'dev' },
		},
	],
	agents: [
		{
			id: 'dev',
			name: 'Developer',
			role: 'developer',
			description: 'Implements features, fixes bugs, writes tests.',
			capability_profiles: ['coding'],
		},
	],
	workflows: [
		{
			id: 'direct',
			name: 'Direct task',
			description: 'Single agent task execution.',
			steps: [{ id: 'implement', type: 'agent', agent_id: 'dev', actions: [] }],
		},
	],
	providers: [],
	environments: [],
	capabilities: [
		{
			id: 'coding',
			description: 'Local coding agent runtime.',
			skills: [],
			mcp_servers: [],
			context: [],
			prompts: [],
		},
	],
	skills: [],
	scripts: [],
	context: [],
}

const projects: ProjectRecord[] = [
	{
		id: 'questpie-autopilot',
		name: 'questpie-autopilot',
		path: '/Users/drepkovsky/questpie/repos/questpie-autopilot',
		git_remote: 'git@github.com:millionco/questpie-autopilot.git',
		default_branch: 'main',
		registered_at: now(),
		metadata: '{}',
	},
]

const events = {
	configSets: [] as Array<{ type: string; id: string; data: unknown; project_id?: string | null }>,
	configDeletes: [] as Array<{ type: string; id: string; project_id?: string | null }>,
	projectRegisters: [] as unknown[],
	reloadCount: 0,
}

function json(data: unknown, init?: ResponseInit) {
	return Response.json(data, {
		...init,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Local-Dev',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
			...(init?.headers ?? {}),
		},
	})
}

async function readJson(req: Request): Promise<JsonRecord> {
	try {
		return (await req.json()) as JsonRecord
	} catch {
		return {}
	}
}

function projectIdFromPath(path: string) {
	return basename(path).toLowerCase().replace(/[^a-z0-9]+/g, '-') || `project-${Date.now()}`
}

const api = Bun.serve({
	hostname: '127.0.0.1',
	port: 7778,
	async fetch(req: Request) {
		const url = new URL(req.url)
		const path = url.pathname

		if (req.method === 'OPTIONS') return json({ ok: true })
		if (path === '/api/events') {
			const body = new ReadableStream({
				start(controller) {
					controller.enqueue(new TextEncoder().encode(': connected\n\n'))
				},
			})
			return new Response(body, {
				headers: {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
				},
			})
		}
		if (path === '/api/__test/events') return json(events)
		if (path === '/api/status') return json({ userCount: 1, setupCompleted: true })
		if (path === '/api/auth/get-session') {
			return json({
				user: { id: 'u1', email: 'owner@example.com', name: 'Owner', role: 'owner' },
				session: { id: 's1' },
			})
		}
		if (path === '/api/preferences') return json([])
		if (path === '/api/tasks') return json([])

		if (path === '/api/projects' && req.method === 'GET') return json(projects)
		if (path === '/api/projects' && req.method === 'POST') {
			const body = await readJson(req)
			const projectPath = String(body.path ?? '')
			const id = projectIdFromPath(projectPath)
			const project: ProjectRecord = {
				id,
				name: String(body.name || basename(projectPath) || id),
				path: projectPath,
				git_remote: typeof body.git_remote === 'string' ? body.git_remote : null,
				default_branch: typeof body.default_branch === 'string' ? body.default_branch : null,
				registered_at: now(),
				metadata: '{}',
			}
			const index = projects.findIndex((item) => item.id === id || item.path === projectPath)
			if (index >= 0) projects[index] = project
			else projects.push(project)
			events.projectRegisters.push(body)
			return json(project)
		}
		const projectDelete = path.match(/^\/api\/projects\/([^/]+)$/)
		if (projectDelete && req.method === 'DELETE') {
			const id = decodeURIComponent(projectDelete[1]!)
			const index = projects.findIndex((project) => project.id === id)
			if (index >= 0) projects.splice(index, 1)
			return json({ ok: true, deleted: id })
		}

		if (path === '/api/config/reload-status') {
			return json({
				available: true,
				lastReloadAt: events.reloadCount > 0 ? now() : null,
				lastError: null,
				reloadCount: events.reloadCount,
			})
		}
		if (path === '/api/config/reload' && req.method === 'POST') {
			events.reloadCount += 1
			return json({ ok: true })
		}

		const configMatch = path.match(/^\/api\/config\/([^/]+)(?:\/([^/]+))?$/)
		if (configMatch) {
			const type = decodeURIComponent(configMatch[1]!)
			const id = configMatch[2] ? decodeURIComponent(configMatch[2]) : undefined
			if (req.method === 'GET') return json(records[type] ?? [])
			if (req.method === 'PUT' && id) {
				const body = await readJson(req)
				const data = (body.data ?? {}) as JsonRecord
				const existing = records[type] ?? []
				const index = existing.findIndex((record) => record.id === id)
				if (index >= 0) existing[index] = data
				else existing.push(data)
				records[type] = existing
				events.configSets.push({
					type,
					id,
					data,
					project_id: typeof body.project_id === 'string' ? body.project_id : null,
				})
				return json(data)
			}
			if (req.method === 'DELETE' && id) {
				records[type] = (records[type] ?? []).filter((record) => record.id !== id)
				events.configDeletes.push({
					type,
					id,
					project_id: url.searchParams.get('project_id'),
				})
				return json({ ok: true, deleted: id })
			}
		}

		if (path.startsWith('/api/')) return json([])
		return json({ error: 'not found', path }, { status: 404 })
	},
})

const vite = Bun.spawn(['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '3001'], {
	cwd: import.meta.dir + '/../..',
	stdout: 'inherit',
	stderr: 'inherit',
})

function shutdown() {
	api.stop(true)
	vite.kill()
}

process.on('SIGINT', () => {
	shutdown()
	process.exit(0)
})
process.on('SIGTERM', () => {
	shutdown()
	process.exit(0)
})

const exitCode = await vite.exited
api.stop(true)
process.exit(exitCode)
