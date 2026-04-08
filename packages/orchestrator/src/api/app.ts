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
import type { Auth } from '../auth'
import type { CompanyDb } from '../db'
import { env } from '../env'
import type { TaskService, RunService, WorkerService, EnrollmentService, WorkflowEngine, ActivityService, ArtifactService, ConversationBindingService, TaskRelationService, TaskGraphService, SecretService, QueryService, SessionService, ScheduleService, SteerService, AuthoredConfig } from '../services'
import type { Client } from '@libsql/client'
import type { Actor } from '../auth/types'
import { authMiddleware } from './middleware/auth'
import { workerAuthMiddleware } from './middleware/worker-auth'
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
import { queues } from './routes/queues'
import { searchRoute } from './routes/search'

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
	scheduleService: ScheduleService
	steerService: SteerService
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
}

const orchestratorPkg = JSON.parse(
	readFileSync(resolve(import.meta.dir, '..', '..', 'package.json'), 'utf-8'),
) as { version: string }

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

	// ── Enrollment: enroll is public, tokens requires user auth ──────────
	app.use('/api/enrollment/tokens', authMiddleware())
	// /api/enrollment/enroll is public (worker uses join token, not session)

	// ── User auth for human-facing routes ────────────────────────────────
	app.use('/api/tasks/*', userAuth)
	app.use('/api/tasks', userAuth)
	app.use('/api/events', userAuth)

	// ── User auth for run inspection and operator actions ────────────────
	app.use('/api/runs/*/artifacts', userAuth)
	app.use('/api/runs/*/cancel', userAuth)
	app.use('/api/runs/*/steer', userAuth)

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

	return typedApp
}

/** App type for SDK / hono client type inference. */
export type AppType = ReturnType<typeof createApp>
