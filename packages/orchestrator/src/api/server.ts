import { join, extname, resolve } from 'node:path'
import { readdir, stat, writeFile, unlink, mkdir } from 'node:fs/promises'
import {
	loadCompany,
	loadAgents,
	listTasks,
	listPins,
	readActivity,
	createTask,
	updateTask,
	moveTask,
	readTask,
	readYamlUnsafe,
} from '../fs'
import { loadSkillCatalog } from '../skills'
import { routeMessage } from '../router'
import { ArtifactRouter } from '../artifact'
import type { ListTasksOptions } from '../fs'
import { searchFts, searchHybrid } from '../db/search-index'
import type { EntityType, SearchResult } from '../db/search-index'
import { createDb } from '../db'
import type { AutopilotDb } from '../db'
import { resolveActor, getRequiredPermission } from '../auth/middleware'
import { checkPermission } from '../auth/roles'
import { logAudit } from '../auth/audit'
import type { Auth } from '../auth'
import type { Actor } from '../auth/types'
import { eventBus } from '../events'
import type { AutopilotEvent } from '../events'

/** Configuration for the read-only REST API server. */
export interface ApiServerOptions {
	/** Absolute path to the company root directory on disk. */
	companyRoot: string
	/** TCP port to listen on. */
	port: number
	/** Better Auth instance (optional — if not provided, auth is disabled). */
	auth?: Auth
	/** Whether auth is enabled (from company.yaml settings.auth.enabled). */
	authEnabled?: boolean
}

const CORS_HEADERS: Record<string, string> = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

/**
 * HTTP API that exposes company state for the CLI and web dashboard.
 *
 * Routes:
 * - `GET  /api/status`              -- company name, agent count, active tasks
 * - `GET  /api/tasks`               -- list tasks (query: `status`, `agent`)
 * - `POST /api/tasks`               -- create a new task
 * - `GET  /api/tasks/:id`           -- get a single task
 * - `POST /api/tasks/:id/approve`   -- approve (complete) a task
 * - `POST /api/tasks/:id/reject`    -- reject (block) a task
 * - `GET  /api/agents`              -- list agents
 * - `GET  /api/pins`                -- list dashboard pins
 * - `GET  /api/activity`            -- activity feed (query: `agent`, `limit`)
 * - `GET  /api/inbox`               -- tasks needing attention (review + blocked)
 * - `POST /api/chat`                -- send a message via chat router
 * - `GET  /api/artifacts`           -- list artifacts
 * - `POST /api/artifacts/:id/start` -- start an artifact
 * - `POST /api/artifacts/:id/stop`  -- stop an artifact
 * - `GET  /api/skills`              -- list skill catalog
 * - `GET  /api/groups`              -- dashboard pin groups
 * - `POST /api/files/*`             -- create a file
 * - `PUT  /api/files/*`             -- overwrite a file
 * - `DELETE /api/files/*`           -- delete a file
 * - `POST /api/upload`              -- multipart file upload
 * - `GET  /fs/*`                    -- raw filesystem browser
 */
export class ApiServer {
	private server: ReturnType<typeof Bun.serve> | null = null
	private db: AutopilotDb | null = null

	constructor(private options: ApiServerOptions) {}

	private async getDb(): Promise<AutopilotDb> {
		if (!this.db) {
			this.db = await createDb(this.options.companyRoot)
		}
		return this.db
	}

	/** Start the Bun HTTP server. */
	async start(): Promise<void> {
		this.server = Bun.serve({
			port: this.options.port,
			fetch: (request) => this.handleRequest(request),
		})
	}

	/** Stop the Bun HTTP server. */
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
		const method = request.method

		try {
			// Better Auth passthrough
			if (path.startsWith('/api/auth')) {
				if (this.options.auth) {
					return this.options.auth.handler(request)
				}
				return errorResponse('auth not configured', 404)
			}

			// Webhook endpoints exempt from bearer/API key
			if (path.startsWith('/hooks/')) {
				return await this.routeToHandler(request, url)
			}

			// Resolve actor
			const actor = await resolveActor(request, {
				authEnabled: this.options.authEnabled ?? false,
				companyRoot: this.options.companyRoot,
				auth: this.options.auth!,
			})

			// /api/status is a public health check
			if (!actor && path === '/api/status') {
				return await this.handleStatus()
			}

			if (!actor) return errorResponse('Unauthorized', 401)

			// Permission check
			const required = getRequiredPermission(path, method)
			if (required && !checkPermission(actor, required.resource, required.action)) {
				await logAudit(this.options.companyRoot, {
					ts: new Date().toISOString(),
					actor: actor.id,
					actor_type: actor.type,
					action: `${required.resource}.${required.action}`,
					target: path,
					source: actor.source,
					ip: actor.ip,
					result: 'denied',
				})
				return errorResponse('Forbidden', 403)
			}

			// Route + audit
			const response = await this.routeToHandler(request, url)
			if (required) {
				await logAudit(this.options.companyRoot, {
					ts: new Date().toISOString(),
					actor: actor.id,
					actor_type: actor.type,
					action: `${required.resource}.${required.action}`,
					target: path,
					source: actor.source,
					ip: actor.ip,
					result: 'success',
				})
			}
			return response
		} catch (err) {
			console.error('[api] error handling request:', err)
			return errorResponse('internal error', 500)
		}
	}

	private async routeToHandler(request: Request, url: URL): Promise<Response> {
		const path = url.pathname
		const method = request.method

		try {
			// Filesystem browser
			if (path.startsWith('/fs/') || path === '/fs') {
				return await this.handleFs(path)
			}

			// File management API
			if (path.startsWith('/api/files/')) {
				const filePath = path.replace(/^\/api\/files\//, '')
				if (method === 'POST') return await this.handleFileWrite(filePath, request)
				if (method === 'PUT') return await this.handleFileWrite(filePath, request)
				if (method === 'DELETE') return await this.handleFileDelete(filePath)
				return errorResponse('method not allowed', 405)
			}

			// Upload
			if (path === '/api/upload' && method === 'POST') {
				return await this.handleUpload(request)
			}

			// Task actions (must come before generic /api/tasks switch)
			const taskApproveMatch = path.match(/^\/api\/tasks\/([^/]+)\/approve$/)
			if (taskApproveMatch?.[1] && method === 'POST') {
				return await this.handleTaskApprove(taskApproveMatch[1])
			}

			const taskRejectMatch = path.match(/^\/api\/tasks\/([^/]+)\/reject$/)
			if (taskRejectMatch?.[1] && method === 'POST') {
				return await this.handleTaskReject(taskRejectMatch[1], request)
			}

			const taskDetailMatch = path.match(/^\/api\/tasks\/([^/]+)$/)
			if (taskDetailMatch?.[1] && taskDetailMatch[1] !== 'undefined' && method === 'GET') {
				return await this.handleTaskDetail(taskDetailMatch[1])
			}

			// Artifact actions
			const artifactStartMatch = path.match(/^\/api\/artifacts\/([^/]+)\/start$/)
			if (artifactStartMatch?.[1] && method === 'POST') {
				return await this.handleArtifactStart(artifactStartMatch[1])
			}

			const artifactStopMatch = path.match(/^\/api\/artifacts\/([^/]+)\/stop$/)
			if (artifactStopMatch?.[1] && method === 'POST') {
				return await this.handleArtifactStop(artifactStopMatch[1])
			}

			// Dashboard widget detail
			const widgetDetailMatch = path.match(/^\/api\/dashboard\/widgets\/([^/]+)$/)
			if (widgetDetailMatch?.[1] && method === 'GET') {
				return await this.handleDashboardWidgetDetail(widgetDetailMatch[1])
			}

			// SSE events endpoint
			if (path === '/api/events' && method === 'GET') {
				return this.handleSSE(request, url.searchParams)
			}

			switch (path) {
				case '/api/status':
					return await this.handleStatus()
				case '/api/tasks':
					if (method === 'POST') return await this.handleTaskCreate(request)
					return await this.handleTasks(url.searchParams)
				case '/api/agents':
					return await this.handleAgents()
				case '/api/pins':
					return await this.handlePins()
				case '/api/activity':
					return await this.handleActivity(url.searchParams)
				case '/api/inbox':
					return await this.handleInbox()
				case '/api/chat':
					if (method === 'POST') return await this.handleChat(request)
					return errorResponse('method not allowed', 405)
				case '/api/artifacts':
					return await this.handleArtifacts()
				case '/api/skills':
					return await this.handleSkills()
				case '/api/groups':
					return await this.handleGroups()
				case '/api/search':
					return await this.handleSearch(url.searchParams)
				case '/api/dashboard/layout':
					return await this.handleDashboardLayout()
				case '/api/dashboard/widgets':
					return await this.handleDashboardWidgets()
				case '/api/dashboard/pages':
					return await this.handleDashboardPages()
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

		let reviewTasks: unknown[] = []
		try {
			reviewTasks = await listTasks(root, { status: 'review' })
		} catch {
			// no tasks
		}

		let blockedTasks: unknown[] = []
		try {
			blockedTasks = await listTasks(root, { status: 'blocked' })
		} catch {
			// no tasks
		}

		return jsonResponse({
			company: company.name,
			agentCount: agents.length,
			activeTasks: activeTasks.length,
			runningSessions: 0,
			pendingApprovals: reviewTasks.length + blockedTasks.length,
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

	private async handleTaskDetail(taskId: string): Promise<Response> {
		const task = await readTask(this.options.companyRoot, taskId)
		if (!task) return errorResponse('task not found', 404)
		return jsonResponse(task)
	}

	private async handleTaskCreate(request: Request): Promise<Response> {
		const body = await request.json()
		const task = await createTask(this.options.companyRoot, body)
		return jsonResponse(task, 201)
	}

	private async handleTaskApprove(taskId: string): Promise<Response> {
		const root = this.options.companyRoot
		const task = await readTask(root, taskId)
		if (!task) return errorResponse('task not found', 404)
		await updateTask(root, taskId, { status: 'done' }, 'human')
		try {
			await moveTask(root, taskId, task.status, 'done')
		} catch {
			// already moved or folder missing
		}
		return jsonResponse({ ok: true, taskId, status: 'done' })
	}

	private async handleTaskReject(taskId: string, request: Request): Promise<Response> {
		const root = this.options.companyRoot
		const task = await readTask(root, taskId)
		if (!task) return errorResponse('task not found', 404)
		let reason = 'Rejected by human'
		try {
			const body = await request.json()
			if (body.reason) reason = body.reason
		} catch {
			// no body
		}
		await updateTask(root, taskId, { status: 'blocked' }, 'human')
		try {
			await moveTask(root, taskId, task.status, 'blocked')
		} catch {
			// already moved
		}
		return jsonResponse({ ok: true, taskId, status: 'blocked', reason })
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

	private async handleInbox(): Promise<Response> {
		const root = this.options.companyRoot
		let reviewTasks: unknown[] = []
		let blockedTasks: unknown[] = []
		try {
			reviewTasks = await listTasks(root, { status: 'review' })
		} catch {
			// empty
		}
		try {
			blockedTasks = await listTasks(root, { status: 'blocked' })
		} catch {
			// empty
		}
		const pins = await listPins(root)
		const actionPins = pins.filter(
			(p) => p.metadata?.actions && p.metadata.actions.length > 0,
		)
		return jsonResponse({
			tasks: [...reviewTasks, ...blockedTasks],
			pins: actionPins,
		})
	}

	private async handleChat(request: Request): Promise<Response> {
		const root = this.options.companyRoot
		const body = await request.json()
		const { message, channel } = body
		if (!message) return errorResponse('message is required', 400)
		try {
			const agents = await loadAgents(root)
			const result = await routeMessage(message, agents, root)
			return jsonResponse(result)
		} catch (err) {
			return jsonResponse({
				routed_to: null,
				reason: err instanceof Error ? err.message : 'routing failed',
			})
		}
	}

	private async handleArtifacts(): Promise<Response> {
		const root = this.options.companyRoot
		const dir = join(root, 'artifacts')
		try {
			const dirEntries = await readdir(dir, { withFileTypes: true })
			const folders = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name)
			const router = new ArtifactRouter(root)
			const artifacts = []
			for (const id of folders) {
				try {
					const config = await router.readConfig(id)
					artifacts.push({ id, ...config, status: 'stopped' })
				} catch {
					// skip invalid
				}
			}
			return jsonResponse(artifacts)
		} catch {
			return jsonResponse([])
		}
	}

	private async handleArtifactStart(id: string): Promise<Response> {
		// Placeholder — artifact lifecycle managed by ArtifactRouter
		return jsonResponse({ ok: true, id, status: 'starting' })
	}

	private async handleArtifactStop(id: string): Promise<Response> {
		return jsonResponse({ ok: true, id, status: 'stopped' })
	}

	private async handleSkills(): Promise<Response> {
		try {
			const catalog = await loadSkillCatalog(this.options.companyRoot)
			return jsonResponse(catalog)
		} catch {
			return jsonResponse([])
		}
	}

	private async handleGroups(): Promise<Response> {
		const root = this.options.companyRoot
		const groupsPath = join(root, 'dashboard', 'groups.yaml')
		try {
			const data = await readYamlUnsafe(groupsPath)
			return jsonResponse(data)
		} catch {
			return jsonResponse({ groups: [] })
		}
	}

	private async handleSearch(params: URLSearchParams): Promise<Response> {
		const q = params.get('q')
		if (!q) return errorResponse('q parameter is required', 400)

		const typeParam = params.get('type')
		const mode = params.get('mode') ?? 'hybrid'
		const limitStr = params.get('limit')
		const limit = limitStr ? parseInt(limitStr, 10) : 20

		const types = typeParam
			? typeParam.split(',').map((t) => t.trim()) as EntityType[]
			: undefined

		try {
			const db = await this.getDb()
			let results: SearchResult[] = []

			if (mode === 'fts') {
				if (types && types.length === 1) {
					results = await searchFts(db, q, { type: types[0], limit })
				} else {
					results = await searchFts(db, q, { limit })
				}
			} else {
				// hybrid or semantic — use searchHybrid with null embedding (FTS fallback)
				if (types && types.length === 1) {
					results = await searchHybrid(db, q, null, { type: types[0], limit })
				} else {
					results = await searchHybrid(db, q, null, { limit })
				}
			}

			// Filter by multiple types if provided
			if (types && types.length > 1) {
				results = results.filter((r) => types.includes(r.entityType))
			}

			return jsonResponse({
				results,
				query: q,
				mode,
				total: results.length,
			})
		} catch {
			return jsonResponse({
				results: [],
				query: q,
				mode,
				total: 0,
			})
		}
	}

	private async handleFileWrite(filePath: string, request: Request): Promise<Response> {
		const root = this.options.companyRoot
		const fullPath = resolve(root, filePath)
		if (!fullPath.startsWith(resolve(root))) {
			return errorResponse('forbidden', 403)
		}
		const body = await request.json()
		const content = typeof body === 'string' ? body : (body.content ?? JSON.stringify(body))
		const dir = join(fullPath, '..')
		await mkdir(dir, { recursive: true })
		await writeFile(fullPath, content, 'utf-8')
		return jsonResponse({ ok: true, path: filePath })
	}

	private async handleFileDelete(filePath: string): Promise<Response> {
		const root = this.options.companyRoot
		const fullPath = resolve(root, filePath)
		if (!fullPath.startsWith(resolve(root))) {
			return errorResponse('forbidden', 403)
		}
		try {
			await unlink(fullPath)
			return jsonResponse({ ok: true, path: filePath })
		} catch {
			return errorResponse('file not found', 404)
		}
	}

	private async handleUpload(request: Request): Promise<Response> {
		const root = this.options.companyRoot
		try {
			const formData = await request.formData()
			const file = formData.get('file') as File | null
			const targetDir = (formData.get('path') as string) ?? ''
			if (!file) return errorResponse('no file provided', 400)

			const fullDir = resolve(root, targetDir)
			if (!fullDir.startsWith(resolve(root))) {
				return errorResponse('forbidden', 403)
			}
			await mkdir(fullDir, { recursive: true })
			const fullPath = join(fullDir, file.name)
			const buffer = await file.arrayBuffer()
			await writeFile(fullPath, Buffer.from(buffer))
			return jsonResponse({ ok: true, path: join(targetDir, file.name) })
		} catch (err) {
			return errorResponse(err instanceof Error ? err.message : 'upload failed', 500)
		}
	}

	private async handleDashboardLayout(): Promise<Response> {
		const root = this.options.companyRoot
		const layoutPath = join(root, 'dashboard', 'overrides', 'layout.yaml')
		try {
			const data = await readYamlUnsafe(layoutPath)
			return jsonResponse(data)
		} catch {
			return errorResponse('not found', 404)
		}
	}

	private async handleDashboardWidgets(): Promise<Response> {
		const root = this.options.companyRoot
		const widgetsDir = join(root, 'dashboard', 'widgets')
		try {
			const entries = await readdir(widgetsDir, { withFileTypes: true })
			const folders = entries.filter((d) => d.isDirectory()).map((d) => d.name)
			const widgets = []
			for (const name of folders) {
				try {
					const metaPath = join(widgetsDir, name, 'widget.yaml')
					const meta = await readYamlUnsafe(metaPath)
					widgets.push(meta)
				} catch {
					// skip widgets without valid yaml
				}
			}
			return jsonResponse(widgets)
		} catch {
			return jsonResponse([])
		}
	}

	private async handleDashboardWidgetDetail(name: string): Promise<Response> {
		const root = this.options.companyRoot
		const metaPath = join(root, 'dashboard', 'widgets', name, 'widget.yaml')
		try {
			const meta = await readYamlUnsafe(metaPath)
			return jsonResponse(meta)
		} catch {
			return errorResponse('widget not found', 404)
		}
	}

	private async handleDashboardPages(): Promise<Response> {
		const root = this.options.companyRoot
		const registryPath = join(root, 'dashboard', 'pages', 'registry.yaml')
		try {
			const data = await readYamlUnsafe(registryPath)
			return jsonResponse(data)
		} catch {
			return jsonResponse({ pages: [] })
		}
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

	private handleSSE(request: Request, params: URLSearchParams): Response {
		const encoder = new TextEncoder()

		const stream = new ReadableStream({
			start(controller) {
				const send = (data: string) => {
					try {
						controller.enqueue(encoder.encode(`data: ${data}\n\n`))
					} catch {
						// Stream closed
					}
				}

				// Subscribe to event bus
				const unsubscribe = eventBus.subscribe((event: AutopilotEvent) => {
					send(JSON.stringify(event))
				})

				// Heartbeat every 30s to keep connection alive
				const heartbeat = setInterval(() => {
					try {
						controller.enqueue(encoder.encode(': heartbeat\n\n'))
					} catch {
						clearInterval(heartbeat)
					}
				}, 30_000)

				// Cleanup on client disconnect
				request.signal.addEventListener('abort', () => {
					unsubscribe()
					clearInterval(heartbeat)
					try {
						controller.close()
					} catch {
						// Already closed
					}
				})
			},
		})

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				...CORS_HEADERS,
			},
		})
	}
}
