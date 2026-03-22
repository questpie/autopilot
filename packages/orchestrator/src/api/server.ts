import { join, extname, resolve } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import { loadCompany, loadAgents, listTasks, listPins, readActivity } from '../fs'
import type { ListTasksOptions } from '../fs'

export interface ApiServerOptions {
	companyRoot: string
	port: number
}

const CORS_HEADERS: Record<string, string> = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, OPTIONS',
	'access-control-allow-headers': 'Content-Type',
}

const CONTENT_TYPE_MAP: Record<string, string> = {
	'.md': 'text/markdown',
	'.yaml': 'text/yaml',
	'.yml': 'text/yaml',
	'.json': 'application/json',
	'.txt': 'text/plain',
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.ts': 'text/plain',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
}

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json', ...CORS_HEADERS },
	})
}

function errorResponse(error: string, status: number): Response {
	return jsonResponse({ error }, status)
}

export class ApiServer {
	private server: ReturnType<typeof Bun.serve> | null = null

	constructor(private options: ApiServerOptions) {}

	async start(): Promise<void> {
		this.server = Bun.serve({
			port: this.options.port,
			fetch: (request) => this.handleRequest(request),
		})
	}

	stop(): void {
		if (this.server) {
			this.server.stop()
			this.server = null
		}
	}

	private async handleRequest(request: Request): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: CORS_HEADERS })
		}

		const url = new URL(request.url)
		const path = url.pathname

		try {
			if (path.startsWith('/fs/') || path === '/fs') {
				return await this.handleFs(path)
			}

			switch (path) {
				case '/api/status':
					return await this.handleStatus()
				case '/api/tasks':
					return await this.handleTasks(url.searchParams)
				case '/api/agents':
					return await this.handleAgents()
				case '/api/pins':
					return await this.handlePins()
				case '/api/activity':
					return await this.handleActivity(url.searchParams)
				default:
					return errorResponse('not found', 404)
			}
		} catch (err) {
			console.error('[api] error handling request:', err)
			return errorResponse('internal error', 500)
		}
	}

	private async handleStatus(): Promise<Response> {
		const root = this.options.companyRoot
		const company = await loadCompany(root)

		let agents: unknown[] = []
		try {
			agents = await loadAgents(root)
		} catch {
			// no agents file
		}

		let activeTasks: unknown[] = []
		try {
			activeTasks = await listTasks(root, { status: 'in_progress' })
		} catch {
			// no tasks
		}

		return jsonResponse({
			company: company.name,
			agentCount: agents.length,
			activeTasks: activeTasks.length,
			runningSessions: 0,
		})
	}

	private async handleTasks(params: URLSearchParams): Promise<Response> {
		const options: ListTasksOptions = {}
		const status = params.get('status')
		const agent = params.get('agent')
		if (status) options.status = status
		if (agent) options.agent = agent
		const tasks = await listTasks(this.options.companyRoot, options)
		return jsonResponse(tasks)
	}

	private async handleAgents(): Promise<Response> {
		const agents = await loadAgents(this.options.companyRoot)
		return jsonResponse(agents)
	}

	private async handlePins(): Promise<Response> {
		const pins = await listPins(this.options.companyRoot)
		return jsonResponse(pins)
	}

	private async handleActivity(params: URLSearchParams): Promise<Response> {
		const agent = params.get('agent') ?? undefined
		const limitStr = params.get('limit')
		const limit = limitStr ? parseInt(limitStr, 10) : undefined
		const entries = await readActivity(this.options.companyRoot, { agent, limit })
		return jsonResponse(entries)
	}

	private async handleFs(path: string): Promise<Response> {
		const fsPath = path.replace(/^\/fs\/?/, '')
		const fullPath = resolve(this.options.companyRoot, fsPath)

		// Prevent path traversal
		const companyResolved = resolve(this.options.companyRoot)
		if (!fullPath.startsWith(companyResolved)) {
			return errorResponse('forbidden', 403)
		}

		try {
			const info = await stat(fullPath)

			if (info.isDirectory()) {
				const entries = await readdir(fullPath)
				const items = []
				for (const entry of entries) {
					const entryPath = join(fullPath, entry)
					const entryStat = await stat(entryPath)
					items.push({
						name: entry,
						type: entryStat.isDirectory() ? 'directory' : 'file',
						size: entryStat.size,
					})
				}
				return jsonResponse(items)
			}

			const file = Bun.file(fullPath)
			const ext = extname(fullPath).toLowerCase()
			const contentType = CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream'

			return new Response(file, {
				status: 200,
				headers: { 'content-type': contentType, ...CORS_HEADERS },
			})
		} catch (err: unknown) {
			if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
				return errorResponse('not found', 404)
			}
			throw err
		}
	}
}
