/**
 * Hono app factory for the QUESTPIE Autopilot orchestrator API.
 *
 * Routes receive services via Hono context variables (set by closure over the services bag).
 *
 * Auth model:
 * - Worker routes (/api/workers, /api/runs) are public (machine-to-machine)
 * - Task routes (/api/tasks) require user auth (session/API key)
 * - Events SSE (/api/events) requires user auth
 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { Auth } from '../auth'
import type { CompanyDb } from '../db'
import { env } from '../env'
import type { TaskService, RunService, WorkerService } from '../services'
import type { Actor } from '../auth/types'
import { authMiddleware } from './middleware/auth'
import { events } from './routes/events'
import { tasks } from './routes/tasks'
import { runs } from './routes/runs'
import { workers } from './routes/workers'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Services {
	taskService: TaskService
	runService: RunService
	workerService: WorkerService
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

	// ── Global middleware ─────────────────────────────────────────────────
	app.use(
		'*',
		cors({
			origin: corsOrigin,
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
			credentials: true,
		}),
	)
	app.use(
		'*',
		bodyLimit({
			maxSize: 1 * 1024 * 1024,
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
		await next()
	})

	// ── Better Auth passthrough ───────────────────────────────────────────
	app.all('/api/auth/*', async (c) => {
		return config.auth.handler(c.req.raw)
	})

	// ── Auth middleware for human-facing routes only ──────────────────────
	app.use('/api/tasks/*', authMiddleware())
	app.use('/api/tasks', authMiddleware())
	app.use('/api/events', authMiddleware())

	// ── Public routes ────────────────────────────────────────────────────
	app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

	// ── All API routes (typed chain for Hono client inference) ───────────
	const typedApp = app
		.route('/api/workers', workers)
		.route('/api/runs', runs)
		.route('/api/tasks', tasks)
		.route('/api/events', events)

	return typedApp
}

/** App type for SDK / hono client type inference. */
export type AppType = ReturnType<typeof createApp>
