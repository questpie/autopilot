/**
 * Actor resolution — resolves every request to an Actor.
 *
 * Resolution order:
 * 1. Better Auth session via cookies → human Actor
 * 2. Authorization: Bearer → API key Actor
 * 3. null → unauthenticated
 *
 * This module is kept for backward compatibility. The primary auth middleware
 * is now at api/middleware/auth.ts which calls this internally.
 */
import type { Auth } from './index'
import type { Actor } from './types'

function normalizeHumanRole(role: unknown): Actor['role'] | null {
	return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer'
		? role
		: null
}

export interface ResolveActorConfig {
	companyRoot: string
	auth: Auth
}

type HumanSession = {
	user: {
		id: string
		email: string
		name?: string
		role?: string
	}
}

async function getHumanSession(
	request: Request,
	config: ResolveActorConfig,
): Promise<HumanSession | null> {
	try {
		const authApi = config.auth.api as Record<
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

/**
 * Resolve the identity of an incoming request into an Actor.
 */
export async function resolveActor(
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor | null> {
	// 1. Better Auth session via cookies
	const session = await getHumanSession(request, config)
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

		try {
			const authApi = config.auth.api as Record<string, (args: unknown) => Promise<unknown>>
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
			// Not a valid API key
		}
	}

	return null
}

function detectSource(request: Request): Actor['source'] {
	const userAgent = request.headers.get('user-agent') ?? ''
	if (userAgent.includes('autopilot-cli')) return 'cli'
	if (userAgent.includes('autopilot-worker')) return 'internal'
	if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) return 'dashboard'
	return 'api'
}
