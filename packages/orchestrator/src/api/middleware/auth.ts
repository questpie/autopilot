/**
 * Simplified auth middleware — resolves every request to an Actor.
 *
 * Resolution order:
 * 1. Better Auth session via cookies → human Actor
 * 2. Authorization: Bearer token:
 *    a. Better Auth API key → API Actor
 *    b. Worker machine secret → machine Actor (used by MCP server)
 * 3. null → 401
 */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'
import type { Auth } from '../../auth'
import type { Actor } from '../../auth/types'
import type { EnrollmentService } from '../../services'
import { env } from '../../env'

type HumanSession = {
	user: {
		id: string
		email: string
		name?: string
		role?: string
	}
}

function normalizeHumanRole(role: unknown): Actor['role'] | null {
	return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer'
		? role
		: null
}

function detectSource(request: Request): Actor['source'] {
	const userAgent = request.headers.get('user-agent') ?? ''
	if (userAgent.includes('autopilot-cli')) return 'cli'
	if (userAgent.includes('autopilot-worker')) return 'internal'
	if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) return 'dashboard'
	return 'api'
}

async function getHumanSession(request: Request, auth: Auth): Promise<HumanSession | null> {
	try {
		const authApi = auth.api as Record<
			string,
			((args: unknown) => Promise<unknown>) | undefined
		>
		const getSessionFn = authApi.getSession
		if (!getSessionFn) return null
		return (await getSessionFn({ headers: request.headers })) as HumanSession | null
	} catch (err) {
		console.warn('[auth] session resolution failed:', (err as Error).message)
		return null
	}
}

export async function resolveActor(
	request: Request,
	auth: Auth,
	enrollmentService?: EnrollmentService,
): Promise<Actor | null> {
	// 1. Better Auth session via cookies
	const session = await getHumanSession(request, auth)
	if (session) {
		const role = normalizeHumanRole(session.user.role) ?? 'viewer'
		return {
			id: session.user.id,
			type: 'human',
			name: session.user.name ?? session.user.email,
			role,
			source: detectSource(request),
			ip: request.headers.get('x-forwarded-for') ?? undefined,
		}
	}

	// 2. Bearer token (API clients, MCP server with machine secret)
	const authHeader = request.headers.get('authorization')
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7)

		// 2a. Try Better Auth API key
		try {
			const authApi = auth.api as Record<string, (args: unknown) => Promise<unknown>>
			const verifyFn = authApi.verifyApiKey
			if (verifyFn) {
				const result = (await verifyFn({ body: { key: token } })) as {
					data?: { valid: boolean; key: { id: string; name?: string } }
				}
				const data = result?.data
				if (data?.valid) {
					return {
						id: data.key.id,
						type: 'api',
						name: data.key.name ?? 'api-client',
						role: 'member',
						source: detectSource(request),
						ip: request.headers.get('x-forwarded-for') ?? undefined,
					}
				}
			}
		} catch (err) {
			console.debug('[auth] bearer token is not a Better Auth API key:', (err as Error).message)
		}

		// 2b. Try worker machine secret (used by MCP server spawned from worker)
		if (enrollmentService) {
			const workerId = await enrollmentService.validateMachineSecret(token)
			if (workerId) {
				return {
					id: workerId,
					type: 'api',
					name: `worker:${workerId}`,
					role: 'member',
					source: 'internal',
					ip: request.headers.get('x-forwarded-for') ?? undefined,
				}
			}
		}
	}

	return null
}

export interface AuthMiddlewareOptions {
	/** Allow X-Local-Dev: true header to bypass auth. Only for `autopilot start` local convenience. */
	allowLocalDevBypass?: boolean
}

/** The synthetic actor created for local dev bypass. Clearly non-human, clearly synthetic. */
const LOCAL_DEV_ACTOR: Actor = {
	id: 'local-dev-bypass',
	type: 'human',
	name: 'Local Dev (bypass)',
	role: 'owner',
	source: 'cli',
}

/**
 * Check if a request originates from localhost/loopback.
 * Uses X-Forwarded-For, then falls back to connection info heuristics.
 * Conservative: if we can't determine origin, reject.
 */
function isLocalhostRequest(req: Request): boolean {
	const forwarded = req.headers.get('x-forwarded-for')
	if (forwarded) {
		const first = forwarded.split(',')[0]!.trim()
		return first === '127.0.0.1' || first === '::1' || first === 'localhost'
	}
	// Bun.serve sets the URL to the actual request URL — check host
	try {
		const url = new URL(req.url)
		const host = url.hostname
		return host === 'localhost' || host === '127.0.0.1' || host === '::1'
	} catch {
		return false
	}
}

/**
 * Factory that returns a Hono middleware performing:
 * 1. Local dev bypass (if ALL conditions are met: server flag + header + localhost)
 * 2. Actor resolution (session / bearer token)
 * 3. Returns 401 if no actor resolved
 *
 * The local dev bypass requires all three:
 * - Server started with allowLocalDevBypass=true (only `autopilot start` sets this)
 * - Request includes X-Local-Dev: true header
 * - Request originates from localhost/loopback
 *
 * Header alone is never enough. Server flag alone is never enough.
 */
export function authMiddleware(opts?: AuthMiddlewareOptions) {
	// Production safety: never allow local dev bypass in production, regardless of flag
	const effectiveBypass = (opts?.allowLocalDevBypass ?? false) && env.NODE_ENV !== 'production'

	return createMiddleware<AppEnv>(async (c, next) => {
		if (
			effectiveBypass &&
			c.req.header('x-local-dev') === 'true' &&
			isLocalhostRequest(c.req.raw)
		) {
			c.set('actor', LOCAL_DEV_ACTOR)
			return next()
		}

		const { enrollmentService } = c.get('services')
		const actor = await resolveActor(c.req.raw, c.get('auth'), enrollmentService)
		c.set('actor', actor)

		if (!actor) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		await next()
	})
}
