/**
 * Hono app factory for the QUESTPIE Autopilot orchestrator API.
 *
 * Creates a configured Hono instance with global middleware, auth,
 * all API routes, documentation, and filesystem browser.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import type { Auth } from '../auth'
import { authFactory } from '../auth'
import type { Actor } from '../auth/types'
import type { AutopilotDb } from '../db'
import { dbFactory } from '../db'
import type { StorageBackend } from '../fs/storage'
import { storageFactory } from '../fs/sqlite-backend'
import { container, companyRootFactory } from '../container'
import { authMiddleware } from './middleware/auth'
import { docs } from './docs'
import {
	status,
	tasks,
	agents,
	pins,
	activity,
	inbox,
	chat,
	search,
	artifacts,
	skills,
	dashboard,
	files,
	upload,
	fsBrowser,
	events,
} from './routes'

export interface AppEnv {
	Variables: {
		actor: Actor | null
		companyRoot: string
		storage: StorageBackend
		db: AutopilotDb
		auth: Auth
	}
}

export interface AppConfig {
	authEnabled: boolean
	corsOrigin?: string
}

/**
 * Create a fully-configured Hono app with all routes mounted.
 *
 * Middleware order:
 * 1. CORS
 * 2. Global error handler
 * 3. Context injection (companyRoot, storage, db, auth)
 * 4. Better Auth passthrough on `/api/auth/*`
 * 5. Auth middleware on `/api/*`
 * 6. All API routes
 * 7. Documentation (Scalar UI + OpenAPI spec)
 * 8. Filesystem browser
 */
export function createApp(config: AppConfig) {
	const app = new Hono<AppEnv>()

	// ── 1. CORS ──────────────────────────────────────────────────────────
	app.use(
		'*',
		cors({
			origin: config.corsOrigin ?? '*',
			allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
		}),
	)

	// ── 2. Global error handler ──────────────────────────────────────────
	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status)
		}
		console.error('[api] unhandled error:', err)
		return c.json({ error: 'internal server error' }, 500)
	})

	// ── 3. Context injection (resolved from DI container) ───────────────
	app.use('*', async (c, next) => {
		const { companyRoot } = container.resolve([companyRootFactory])
		const { storage, db: dbResult, auth } = await container.resolveAsync([storageFactory, dbFactory, authFactory])
		c.set('companyRoot', companyRoot)
		c.set('storage', storage)
		c.set('db', dbResult.db)
		c.set('auth', auth)
		await next()
	})

	// ── 4. Better Auth passthrough ───────────────────────────────────────
	app.all('/api/auth/*', async (c) => {
		const { auth } = await container.resolveAsync([authFactory])
		return auth.handler(c.req.raw)
	})

	// ── 5. Auth middleware on /api/* ──────────────────────────────────────
	app.use('/api/*', authMiddleware({ authEnabled: config.authEnabled }))

	// ── 6. API routes ────────────────────────────────────────────────────
	app.route('/api/status', status)
	app.route('/api/tasks', tasks)
	app.route('/api/agents', agents)
	app.route('/api/pins', pins)
	app.route('/api/activity', activity)
	app.route('/api/inbox', inbox)
	app.route('/api/chat', chat)
	app.route('/api/search', search)
	app.route('/api/artifacts', artifacts)
	app.route('/api/skills', skills)
	app.route('/api/dashboard', dashboard)
	app.route('/api', files)
	app.route('/api', upload)
	app.route('/api/events', events)

	// ── 7. Documentation ─────────────────────────────────────────────────
	app.route('/', docs)

	// ── 8. Filesystem browser ────────────────────────────────────────────
	app.route('/fs', fsBrowser)

	return app
}

/** App type for SDK / hono client type inference. */
export type AppType = ReturnType<typeof createApp>
