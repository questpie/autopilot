/**
 * Hono app factory for the QUESTPIE Autopilot orchestrator API.
 *
 * Auth model:
 * - Worker routes (/api/workers, /api/runs) require machine auth (X-Worker-Secret)
 *   or local dev bypass (X-Local-Dev: true)
 * - Enrollment (/api/enrollment/enroll) is public (consumes join token)
 * - Token creation (/api/enrollment/tokens) requires user auth
 * - Task routes (/api/tasks) require user auth (session/API key)
 * - Events SSE (/api/events) requires user auth
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { sql } from 'drizzle-orm'
import * as authSchema from '../db/auth-schema'
import type { Auth } from '../auth'
import type { CompanyDb } from '../db'
import { env } from '../env'
import type { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService, ArtifactService, ConversationBindingService, TaskRelationService, TaskGraphService, SecretService, QueryService, SessionService, SessionMessageService, ScheduleService, SteerService, AuthoredConfig, VfsService, ScriptService } from '../services'
import type { Client } from '@libsql/client'
import type { Actor } from '../auth/types'
import { authMiddleware, isLocalhostRequest, resolveActor as resolveActorFn } from './middleware/auth'
import { workerAuthMiddleware } from './middleware/worker-auth'
import { createMiddleware } from 'hono/factory'
import { events } from './routes/events'
import { tasks } from './routes/tasks'
import { runs } from './routes/runs'
import { workers } from './routes/workers'
import { enrollment } from './routes/enrollment'
import { previews } from './routes/previews'
import { intake } from './routes/intake'
import { conversations } from './routes/conversations'
import { taskGraph } from './routes/task-graph'
import { secrets } from './routes/secrets'
import { queries } from './routes/queries'
import { sessionsRoute } from './routes/sessions'
import { schedules } from './routes/schedules'
import { scripts } from './routes/scripts'
import { queues } from './routes/queues'
import { searchRoute } from './routes/search'
import { vfs } from './routes/vfs'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Services {
	taskService: TaskService
	runService: RunService
	workerService: WorkerService
	enrollmentService: EnrollmentService
	activityService: ActivityService
	artifactService: ArtifactService
	conversationBindingService: ConversationBindingService
	taskRelationService: TaskRelationService
	taskGraphService: TaskGraphService
	workflowEngine: WorkflowEngine
	secretService: SecretService
	queryService: QueryService
	sessionService: SessionService
	sessionMessageService: SessionMessageService
	scheduleService: ScheduleService
	steerService: SteerService
	vfsService: VfsService
	scriptService: ScriptService
}

export interface AppEnv {
	Variables: {
		actor: Actor | null
		workerId: string | null
		companyRoot: string
		db: CompanyDb
		auth: Auth
		services: Services
		authoredConfig: AuthoredConfig
		/** Canonical external base URL for rendered links (previews, notifications). Not the worker connection URL. */
		orchestratorUrl: string | undefined
		/** Raw libSQL client for index.db (search). */
		indexDbRaw: Client | null
	}
}

export interface AppConfig {
	corsOrigin?: string
	companyRoot: string
	db: CompanyDb
	auth: Auth
	services: Services
	authoredConfig: AuthoredConfig
	/**
	 * Allow X-Local-Dev bypass for worker auth.
	 * Only set to true by `autopilot start` (local convenience mode).
	 * NEVER set in production or multi-machine setups.
	 */
	allowLocalDevBypass?: boolean
	/**
	 * Canonical external base URL for rendered links (previews, notifications, emails).
	 * This is the public-facing URL operators/users see — NOT the worker connection URL.
	 */
	orchestratorUrl?: string
	/** Raw libSQL client for index.db (search). */
	indexDbRaw?: Client
	/** Absolute path to the built operator-web dist directory. */
	operatorWebDist?: string
	/** ConfigManager for hot reload status reporting. */
	configManager?: import('../config/config-manager').ConfigManager
}

const orchestratorPkg = JSON.parse(
	readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf-8'),
) as { version: string }

// Worker run completion can legitimately carry multi-file durable previews,
// including base64-encoded assets from preview_dir. Keep this comfortably above
// the 20 MB raw preview_dir cap to account for JSON + base64 overhead.
const API_BODY_LIMIT_BYTES = 32 * 1024 * 1024

// ─── App Factory ────────────────────────────────────────────────────────────

export function createApp(config: AppConfig) {
	const app = new Hono<AppEnv>()
	const rawOrigin = config.corsOrigin ?? env.CORS_ORIGIN
	const fallbackOrigin = config.orchestratorUrl ?? env.ORCHESTRATOR_URL ?? 'http://localhost:7778'
	const corsOrigin = rawOrigin
		? rawOrigin.split(',').map((o: string) => o.trim())
		: [fallbackOrigin]

	if (!rawOrigin && env.NODE_ENV === 'production') {
		console.warn('[api] ⚠ CORS_ORIGIN not set in production — falling back to the orchestrator base URL. Set CORS_ORIGIN if operators use a separate origin.')
	}

	// ── Global middleware ─────────────────────────────────────────────────
	app.use(
		'*',
		cors({
			origin: corsOrigin,
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Worker-Secret', 'X-Provider-Secret', 'X-Local-Dev'],
			credentials: true,
		}),
	)
	app.use(
		'*',
		bodyLimit({
			maxSize: API_BODY_LIMIT_BYTES,
			onError: (c) => c.json({ error: 'request body too large' }, 413),
		}),
	)
	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status)
		}
		console.error('[api] unhandled error:', err)
		return c.json({ error: 'internal server error' }, 500)
	})

	// ── Context injection ─────────────────────────────────────────────────
	app.use('*', async (c, next) => {
		c.set('companyRoot', config.companyRoot)
		c.set('db', config.db)
		c.set('auth', config.auth)
		c.set('services', config.services)
		c.set('authoredConfig', config.authoredConfig)
		c.set('orchestratorUrl', config.orchestratorUrl)
		c.set('indexDbRaw', config.indexDbRaw ?? null)
		c.set('actor', null)
		c.set('workerId', null)
		await next()
	})

	// ── Better Auth passthrough ───────────────────────────────────────────
	app.all('/api/auth/*', async (c) => {
		return config.auth.handler(c.req.raw)
	})

	// ── Public routes ────────────────────────────────────────────────────
	app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString(), version: orchestratorPkg.version }))

	app.get('/api/status', async (c) => {
		const db = c.get('db')
		const row = await db.select({ count: sql<number>`count(*)` }).from(authSchema.user).get()
		const userCount = Number(row?.count ?? 0)
		return c.json({ userCount, setupCompleted: userCount > 0 })
	})

	// ── Auth helper (local dev bypass gated behind server-side flag) ─────
	const userAuth = authMiddleware({ allowLocalDevBypass: config.allowLocalDevBypass ?? false })

	// ── Config inspection (user auth required) ──────────────────────────
	app.use('/api/config/*', userAuth)
	app.get('/api/config/workflows', (c) => {
		const cfg = c.get('authoredConfig')
		return c.json([...cfg.workflows.values()], 200)
	})
	app.get('/api/config/agents', (c) => {
		const cfg = c.get('authoredConfig')
		return c.json([...cfg.agents.values()], 200)
	})
	app.get('/api/config/environments', (c) => {
		const cfg = c.get('authoredConfig')
		return c.json([...cfg.environments.values()], 200)
	})
	app.get('/api/config/providers', (c) => {
		const cfg = c.get('authoredConfig')
		return c.json([...cfg.providers.values()], 200)
	})
	app.get('/api/config/reload-status', (c) => {
		if (!config.configManager) return c.json({ available: false }, 200)
		return c.json({ available: true, ...config.configManager.status() }, 200)
	})
	app.post('/api/config/reload', async (c) => {
		if (!config.configManager) return c.json({ error: 'config manager not available' }, 503)
		const result = await config.configManager.reload()
		return c.json(result, result.ok ? 200 : 500)
	})

	// ── Enrollment: enroll is public, tokens requires user auth ──────────
	app.use('/api/enrollment/tokens', authMiddleware())
	// /api/enrollment/enroll is public (worker uses join token, not session)

	// ── User auth for human-facing routes ────────────────────────────────
	app.use('/api/tasks/*', userAuth)
	app.use('/api/tasks', userAuth)
	app.use('/api/events', userAuth)

	// ── User auth for run listing, creation, and operator actions ────────
	app.use('/api/runs', userAuth)
	app.use('/api/runs/*/artifacts', userAuth)
	app.use('/api/runs/*/cancel', userAuth)
	app.use('/api/runs/*/continue', userAuth)
	app.use('/api/runs/*/steer', userAuth)
	// GET /api/runs/:id — both users and workers need access
	const eitherAuth = createMiddleware<AppEnv>(async (c, next) => {
		// Try worker auth first (X-Worker-Secret header)
		const workerSecret = c.req.header('x-worker-secret')
		if (workerSecret) {
			const { enrollmentService } = c.get('services')
			const workerId = await enrollmentService.validateMachineSecret(workerSecret)
			if (workerId) {
				c.set('workerId', workerId)
				return next()
			}
		}
		// Try local dev bypass
		const effectiveBypassEither = config.allowLocalDevBypass && env.NODE_ENV !== 'production'
		if (
			effectiveBypassEither &&
			c.req.header('x-local-dev') === 'true' &&
			isLocalhostRequest(c.req.raw)
		) {
			c.set('workerId', null)
			return next()
		}
		// Fall through to user auth
		const { enrollmentService } = c.get('services')
		const actor = await resolveActorFn(c.req.raw, c.get('auth'), enrollmentService)
		if (actor) {
			c.set('actor', actor)
			return next()
		}
		return c.json({ error: 'Unauthorized' }, 401)
	})
	app.use('/api/runs/:id', eitherAuth)

	// ── Preview routes (user auth — same as tasks/artifacts) ─────────────
	app.use('/api/previews/*', userAuth)

	// ── Intake routes (user auth for V1) ─────────────────────────────────
	app.use('/api/intake/*', userAuth)

	// ── Secrets routes (user auth — operator surface) ───────────────────
	app.use('/api/secrets/*', userAuth)
	app.use('/api/secrets', userAuth)

	// ── Query routes (user auth — operator surface) ─────────────────
	app.use('/api/queries/*', userAuth)
	app.use('/api/queries', userAuth)

	// ── Session routes (user auth — operator surface) ────────────────
	app.use('/api/sessions/*', userAuth)
	app.use('/api/sessions', userAuth)

	// ── Schedule routes (user auth — operator surface) ───────────────
	app.use('/api/schedules/*', userAuth)
	app.use('/api/schedules', userAuth)

	// ── Queue routes (user auth — operator surface) ──────────────────
	app.use('/api/queues/*', userAuth)
	app.use('/api/queues', userAuth)

	// ── Search routes (user auth — operator surface) ─────────────────
	app.use('/api/search', userAuth)

	// ── VFS routes (user auth — operator surface) ────────────────────
	app.use('/api/vfs/*', userAuth)
	app.use('/api/vfs', userAuth)
	app.use('/api/scripts/*', userAuth)
	app.use('/api/scripts', userAuth)

	// ── Conversation routes ──────────────────────────────────────────────
	// Binding management requires user auth; inbound /:providerId is self-authenticated via provider secret
	app.use('/api/conversations/bindings', userAuth)

	// ── Worker auth for machine routes ───────────────────────────────────
	const workerAuth = workerAuthMiddleware({ allowLocalDevBypass: config.allowLocalDevBypass ?? false })
	app.use('/api/workers/*', workerAuth)
	app.use('/api/workers', workerAuth)
	app.use('/api/runs/*/events', workerAuth)
	app.use('/api/runs/*/complete', workerAuth)
	app.use('/api/runs/*/steers/claim', workerAuth)

	// ── All API routes (typed chain for Hono client inference) ───────────
	const typedApp = app
		.route('/api/enrollment', enrollment)
		.route('/api/workers', workers)
		.route('/api/runs', runs)
		.route('/api/tasks', tasks)
		.route('/api/events', events)
		.route('/api/previews', previews)
		.route('/api/intake', intake)
		.route('/api/conversations', conversations)
		.route('/api/tasks', taskGraph)
		.route('/api/secrets', secrets)
		.route('/api/queries', queries)
		.route('/api/sessions', sessionsRoute)
		.route('/api/schedules', schedules)
		.route('/api/queues', queues)
		.route('/api/search', searchRoute)
		.route('/api/vfs', vfs)
		.route('/api/scripts', scripts)

	// ── Operator Web SPA serving ────────────────────────────────────────────
	if (config.operatorWebDist) {
		const distDir = config.operatorWebDist

		const mimeTypes: Record<string, string> = {
			'.js': 'text/javascript',
			'.mjs': 'text/javascript',
			'.css': 'text/css',
			'.html': 'text/html',
			'.json': 'application/json',
			'.svg': 'image/svg+xml',
			'.png': 'image/png',
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.gif': 'image/gif',
			'.ico': 'image/x-icon',
			'.woff': 'font/woff',
			'.woff2': 'font/woff2',
			'.ttf': 'font/ttf',
			'.otf': 'font/otf',
			'.webp': 'image/webp',
			'.avif': 'image/avif',
			'.webm': 'video/webm',
			'.mp4': 'video/mp4',
			'.txt': 'text/plain',
			'.xml': 'application/xml',
			'.map': 'application/json',
		}

		function getMimeType(path: string): string {
			const dot = path.lastIndexOf('.')
			if (dot === -1) return 'application/octet-stream'
			return mimeTypes[path.slice(dot).toLowerCase()] ?? 'application/octet-stream'
		}

		// Serve static assets from /app/assets/
		app.get('/app/assets/*', async (c) => {
			const filePath = c.req.path.replace('/app/', '')
			const fullPath = resolve(distDir, filePath)

			try {
				const file = Bun.file(fullPath)
				if (await file.exists()) {
					return new Response(file, {
						headers: { 'Content-Type': getMimeType(fullPath) },
					})
				}
			} catch {
				// fall through
			}
			return c.notFound()
		})

		// SPA fallback for /app/*
		app.get('/app/*', async (c) => {
			const reqPath = c.req.path.replace('/app', '').replace(/^\//, '')

			// Try to serve static file first (for files with extensions)
			if (reqPath && /\.\w+$/.test(reqPath)) {
				const fullPath = resolve(distDir, reqPath)
				try {
					const file = Bun.file(fullPath)
					if (await file.exists()) {
						return new Response(file, {
							headers: { 'Content-Type': getMimeType(fullPath) },
						})
					}
				} catch {
					// fall through to index.html
				}
			}

			// SPA fallback — serve index.html with injected env
			const indexPath = resolve(distDir, 'index.html')
			try {
				const file = Bun.file(indexPath)
				if (!(await file.exists())) {
					return c.json({ error: 'operator-web not built' }, 503)
				}

				let html = await file.text()
				const runtimeEnv = {
					APP_URL: config.orchestratorUrl || env.ORCHESTRATOR_URL || '',
					API_BASE_URL: '',
				}
				html = html.replace(
					'<script id="__runtime-env__" type="application/json">{}</script>',
					`<script id="__runtime-env__" type="application/json">${JSON.stringify(runtimeEnv)}</script>`,
				)

				return c.html(html)
			} catch {
				return c.json({ error: 'operator-web not built' }, 503)
			}
		})

		// Redirect /app to /app/
		app.get('/app', (c) => c.redirect('/app/'))
	}

	return typedApp
}

/** App type for SDK / hono client type inference. */
export type AppType = ReturnType<typeof createApp>
