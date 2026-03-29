/**
 * Hono app factory for the QUESTPIE Autopilot orchestrator API.
 *
 * Creates a configured Hono instance with global middleware, auth,
 * all API routes, documentation, and filesystem browser.
 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from '../logger'
import type { Auth } from '../auth'
import { authFactory } from '../auth'
import type { Actor } from '../auth/types'
import { companyRootFactory, container } from '../container'
import type { AutopilotDb } from '../db'
import { dbFactory } from '../db'
import { storageFactory } from '../fs/sqlite-backend'
import type { StorageBackend } from '../fs/storage'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getDurableStreamBaseUrl } from '../session/durable'
import { mountDocs } from './docs'
import { artifactProxyAuth } from './middleware/artifact-auth'
import { authMiddleware } from './middleware/auth'
import { ipAllowlist } from './middleware/ip-allowlist'
import { actorRateLimit, ipRateLimit } from './middleware/rate-limit'
import { securityHeaders } from './middleware/security-headers'
import {
	events,
	activity,
	agents,
	artifactProxy,
	artifacts,
	channels,
	chat,
	danger,
	dashboard,
	files,
	fsBrowser,
	inbox,
	notifications,
	pins,
	search,
	sessions,
	agentSessions,
	usage,
	settings,
	skills,
	status,
	tasks,
	teamHumans,
	upload,
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
	corsOrigin?: string
}

/**
 * Create a fully-configured Hono app with all routes mounted.
 *
 * Middleware order:
 * 1. CORS
 * 1.5. Security headers
 * 1.6. Body size limit (1 MB default; 10 MB for upload routes)
 * 2. Global error handler
 * 3. Context injection (companyRoot, storage, db, auth)
 * 3.5. IP Allowlist
 * 3.6. IP Rate Limit (20 req/min by IP)
 * 4. Better Auth passthrough on `/api/auth/*`
 * 5. Auth middleware on `/api/*`
 * 5.5. Actor Rate Limit (per-actor limits)
 * 6. All API routes
 * 7. Documentation (Scalar UI + OpenAPI spec)
 * 8. Filesystem browser
 */
export function createApp(config: AppConfig) {
	const app = new Hono<AppEnv>()
	const rawOrigin = config.corsOrigin ?? process.env.CORS_ORIGIN
	const corsOrigin = rawOrigin
		? rawOrigin.split(',').map((o) => o.trim())
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

	// ── 1.5. Security headers ────────────────────────────────────────────
	app.use('*', securityHeaders())

	// ── 1.6. Body size limit (1 MB default; 10 MB for uploads; none for artifact proxy) ─
	// Use a single middleware that applies different limits based on path.
	app.use('*', async (c, next) => {
		const path = new URL(c.req.url).pathname
		// Artifact proxy responses can be large — skip body limit
		if (path.startsWith('/artifacts/')) return next()
		// The upload endpoint is POST /api/upload
		const isUpload = path.startsWith('/api/upload')
		const limit = isUpload ? 10 * 1024 * 1024 : 1 * 1024 * 1024
		return bodyLimit({
			maxSize: limit,
			onError: (c) => c.json({ error: 'request body too large' }, 413),
		})(c, next)
	})

	// ── 2. Global error handler ──────────────────────────────────────────
	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status)
		}
		logger.error('api', 'unhandled error', { error: err instanceof Error ? err.message : String(err) })
		return c.json({ error: 'internal server error' }, 500)
	})

	// ── 3. Context injection (resolved from DI container) ───────────────
	app.use('*', async (c, next) => {
		const { companyRoot } = container.resolve([companyRootFactory])
		const {
			storage,
			db: dbResult,
			auth,
		} = await container.resolveAsync([storageFactory, dbFactory, authFactory])
		c.set('companyRoot', companyRoot)
		c.set('storage', storage)
		c.set('db', dbResult.db)
		c.set('auth', auth)
		await next()
	})

	// ── 3.5. IP Allowlist ────────────────────────────────────────────────
	app.use('*', ipAllowlist())

	// ── 3.6. IP Rate Limit ──────────────────────────────────────────────
	app.use('*', ipRateLimit())

	// ── 3.7. Artifact proxy (auth + reverse proxy) ──────────────────────
	app.use('/artifacts/*', artifactProxyAuth())
	app.route('/artifacts', artifactProxy)

	// ── 4. Better Auth passthrough ───────────────────────────────────────
	app.all('/api/auth/*', async (c) => {
		const { auth } = await container.resolveAsync([authFactory])
		return auth.handler(c.req.raw)
	})

	// ── 5. Auth middleware on /api/* ──────────────────────────────────────
	app.use('/api/*', authMiddleware())

	// ── 5.5. Actor Rate Limit ───────────────────────────────────────────
	app.use('/api/*', actorRateLimit())

	// ── 6. API routes (chained for RPC type inference) ───────────────────
	const typedApp = app
		.route('/api/status', status)
		.route('/api/tasks', tasks)
		.route('/api/agents', agents)
		.route('/api/pins', pins)
		.route('/api/activity', activity)
		.route('/api/inbox', inbox)
		.route('/api/chat', chat)
		.route('/api/channels', channels)
		.route('/api/search', search)
		.route('/api/artifacts', artifacts)
		.route('/api/skills', skills)
		.route('/api/dashboard', dashboard)
		.route('/api/settings', settings)
		.route('/api/team/humans', teamHumans)
		.route('/api', danger)
		.route('/api', files)
		.route('/api/upload', upload)
		.route('/api/events', events)
		.route('/api/sessions', sessions)
		.route('/api/agent-sessions', agentSessions)
		.route('/api/usage', usage)
		.route('/api/notifications', notifications)
		.route('/api/fs', fsBrowser)

	// ── 7. Documentation (must come after all routes so the spec is complete) ─
	mountDocs(typedApp)

	// ── D42: Single-port proxy — /streams/* reverse proxy to durable-streams ──
	typedApp.all('/streams/*', async (c) => {
		const url = new URL(c.req.url)
		const targetPath = url.pathname.replace(/^\/streams/, '')
		const targetUrl = `${getDurableStreamBaseUrl()}/v1/stream${targetPath}${url.search}`
		try {
			const resp = await fetch(targetUrl, {
				method: c.req.method,
				headers: c.req.raw.headers,
				body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined,
				// @ts-expect-error — duplex needed for streaming request bodies
				duplex: 'half',
			})
			return new Response(resp.body, {
				status: resp.status,
				headers: Object.fromEntries(resp.headers.entries()),
			})
		} catch {
			return c.json({ error: 'Durable Streams server unavailable' }, 502)
		}
	})

	// ── D42: Single-port proxy — /* serve static dashboard ──
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
				// SPA fallback — serve index.html for client-side routes
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

/**
 * D42: Resolve the dashboard static build directory.
 * Looks for Nitro output (.output/public) or Vite build (dist).
 */
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
