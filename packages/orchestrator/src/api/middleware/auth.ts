/**
 * Simplified auth middleware — resolves every request to an Actor.
 *
 * Resolution order:
 * 1. Better Auth session via cookies → human Actor
 * 2. Authorization: Bearer token → worker/API Actor
 * 3. null → 401
 */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'
import type { Auth } from '../../auth'
import type { Actor } from '../../auth/types'

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
	} catch {
		return null
	}
}

async function resolveActor(request: Request, auth: Auth): Promise<Actor | null> {
	// 1. Better Auth session via cookies
	const session = await getHumanSession(request, auth)
	if (session) {
		const role = normalizeHumanRole(session.user.role) ?? 'viewer'
		return {
			id: session.user.id,
			type: 'human',
			name: session.user.name ?? session.user.email,
			role,
			permissions: {},
			source: detectSource(request),
			ip: request.headers.get('x-forwarded-for') ?? undefined,
		}
	}

	// 2. Bearer token (workers, API clients)
	const authHeader = request.headers.get('authorization')
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7)

		// Try Better Auth API key
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
						permissions: {},
						source: detectSource(request),
						ip: request.headers.get('x-forwarded-for') ?? undefined,
					}
				}
			}
		} catch {
			// Not a Better Auth API key — that's fine
		}
	}

	return null
}

/**
 * Factory that returns a Hono middleware performing:
 * 1. Actor resolution (session / bearer token)
 * 2. Returns 401 if no actor resolved
 *
 * Public routes (/api/auth/*, /api/health, /api/settings/deployment-mode)
 * are mounted before this middleware in app.ts.
 */
export function authMiddleware() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const actor = await resolveActor(c.req.raw, c.get('auth'))
		c.set('actor', actor)

		if (!actor) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		await next()
	})
}
