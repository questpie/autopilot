/**
 * Hono app factory for the QUESTPIE Autopilot orchestrator API.
 *
 * Creates a configured Hono instance with CORS, auth, and all API routes.
 * Routes receive services via Hono context variables (set by closure over the services bag).
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { Auth } from '../auth'
import type { CompanyDb } from '../db'
import { env } from '../env'
import type {
	TaskService,
	RunService,
	MessageService,
	WorkerService,
	WorkflowRunService,
	InferenceService,
} from '../services'
import type { Actor } from '../auth/types'
import { authMiddleware } from './middleware/auth'
import { events } from './routes/events'
import { tasks } from './routes/tasks'
import { runs } from './routes/runs'
import { workers } from './routes/workers'
import { channels } from './routes/channels'
import { settings, settingsPublic } from './routes/settings'
import { search } from './routes/search'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Services {
	taskService: TaskService
	runService: RunService
	messageService: MessageService
	workerService: WorkerService
	workflowRunService: WorkflowRunService
	inferenceService: InferenceService | null
}

export interface AppEnv {
	Variables: {
		actor: Actor | null
		companyRoot: string
		db: CompanyDb
		auth: Auth
		services: Services
	}
}

export interface AppConfig {
	corsOrigin?: string
	companyRoot: string
	db: CompanyDb
	auth: Auth
	services: Services
}

// ─── App Factory ────────────────────────────────────────────────────────────

export function createApp(config: AppConfig) {
	const app = new Hono<AppEnv>()
	const rawOrigin = config.corsOrigin ?? env.CORS_ORIGIN
	const corsOrigin = rawOrigin
		? rawOrigin.split(',').map((o: string) => o.trim())
		: ['http://localhost:3000', 'http://localhost:3001']

	// ── 1. CORS ──────────────────────────────────────────────────────────
	app.use(
		'*',
		cors({
			origin: corsOrigin,
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
			credentials: true,
		}),
	)

	// ── 2. Body size limit (1 MB default) ────────────────────────────────
	app.use(
		'*',
		bodyLimit({
			maxSize: 1 * 1024 * 1024,
			onError: (c) => c.json({ error: 'request body too large' }, 413),
		}),
	)

	// ── 3. Global error handler ──────────────────────────────────────────
	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status)
		}
		console.error('[api] unhandled error:', err)
		return c.json({ error: 'internal server error' }, 500)
	})

	// ── 4. Context injection (from config closure) ───────────────────────
	app.use('*', async (c, next) => {
		c.set('companyRoot', config.companyRoot)
		c.set('db', config.db)
		c.set('auth', config.auth)
		c.set('services', config.services)
		await next()
	})

	// ── 5. Better Auth passthrough ───────────────────────────────────────
	app.all('/api/auth/*', async (c) => {
		return config.auth.handler(c.req.raw)
	})

	// ── 6. Public API routes (no auth required) ──────────────────────────
	app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))
	app.route('/api/settings', settingsPublic)

	// ── 7. Auth middleware on /api/* ──────────────────────────────────────
	app.use('/api/*', authMiddleware())

	// ── 8. Authenticated API routes ──────────────────────────────────────
	const typedApp = app
		.route('/api/tasks', tasks)
		.route('/api/runs', runs)
		.route('/api/workers', workers)
		.route('/api/channels', channels)
		.route('/api/search', search)
		.route('/api/settings', settings)
		.route('/api/events', events)

	// ── 9. Static dashboard fallback ─────────────────────────────────────
	const dashboardDir = resolveDashboardDir()
	if (dashboardDir) {
		typedApp.get('/*', async (c) => {
			const url = new URL(c.req.url)
			const filePath = join(dashboardDir, url.pathname === '/' ? 'index.html' : url.pathname)

			try {
				const file = Bun.file(filePath)
				if (await file.exists()) {
					return new Response(file.stream(), {
						headers: { 'Content-Type': file.type || 'application/octet-stream' },
					})
				}
				// SPA fallback
				const indexFile = Bun.file(join(dashboardDir, 'index.html'))
				if (await indexFile.exists()) {
					return new Response(indexFile.stream(), {
						headers: { 'Content-Type': 'text/html' },
					})
				}
			} catch {
				// Fall through
			}
			return c.text('Not Found', 404)
		})
	}

	return typedApp
}

function resolveDashboardDir(): string | null {
	const candidates = [
		resolve(__dirname, '..', '..', '..', '..', 'apps', 'dashboard-v2', '.output', 'public'),
		resolve(__dirname, '..', '..', '..', '..', 'apps', 'dashboard-v2', 'dist'),
		'/app/apps/dashboard-v2/.output/public',
	]
	for (const dir of candidates) {
		if (existsSync(dir)) return dir
	}
	return null
}

/** App type for SDK / hono client type inference. */
export type AppType = ReturnType<typeof createApp>
