import { loadAgents } from '../fs'
import { verifyAgentKey } from './agent-keys'
/**
 * Auth middleware — resolves every request to an Actor.
 *
 * Resolution order:
 * 1. /hooks/* → HMAC webhook auth (exempt from bearer/API key)
 * 2. X-API-Key header → agent key or Better Auth API key
 * 3. Authorization: Bearer → Better Auth session or agent key
 * 4. null → 401
 */
import type { Auth } from './index'
import { resolveRolePermissions } from './roles'
import type { Actor } from './types'

/** Limited permissions for webhook actors — only task/channel writes. */
const WEBHOOK_PERMISSIONS: Record<string, string[]> = {
	tasks: ['create', 'update'],
	channels: ['write'],
}

export interface ResolveActorConfig {
	companyRoot: string
	auth: Auth
}

/**
 * Resolve the identity of an incoming request into an Actor.
 * Returns a Response directly for webhook auth failures (with specific error messages).
 */
export async function resolveActor(
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor | Response | null> {
	const path = new URL(request.url).pathname

	// 1. Webhook HMAC auth (/hooks/*)
	if (path.startsWith('/hooks/')) {
		return verifyWebhookRequest(request, path, config)
	}

	// 2. X-API-Key header (agent or API client)
	const apiKeyHeader = request.headers.get('x-api-key')
	if (apiKeyHeader) {
		return resolveApiKeyActor(apiKeyHeader, request, config)
	}

	// 3. Authorization: Bearer header
	const authHeader = request.headers.get('authorization')
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7)

		// 3a. Try Better Auth session (human bearer token)
		try {
			const authApi = config.auth.api as Record<
				string,
				((args: unknown) => Promise<unknown>) | undefined
			>
			const getSessionFn = authApi.getSession
			if (!getSessionFn) return null
			const session = (await getSessionFn({ headers: request.headers })) as {
				user: { id: string; email: string; name?: string; twoFactorEnabled?: boolean }
				twoFactorVerified?: boolean
			} | null
			if (session) {
				return resolveHumanActor(session, request, config)
			}
		} catch {
			// Not a valid session
		}

		// 3b. Try agent API key (sent as Bearer)
		const agentActor = await resolveApiKeyActor(token, request, config)
		if (agentActor) return agentActor
	}

	return null
}

async function resolveApiKeyActor(
	key: string,
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor | null> {
	// Agent key pattern: ap_{agentId}_{random}
	if (key.startsWith('ap_')) {
		const result = await verifyAgentKey(config.companyRoot, key)
		if (result) {
			const agents = await loadAgents(config.companyRoot)
			const agent = agents.find((a) => a.id === result.agentId)
			return {
				id: result.agentId,
				type: 'agent',
				name: agent?.name ?? result.agentId,
				role: 'agent',
				permissions: resolveRolePermissions('member'),
				scope: {
					fsRead: agent?.fs_scope?.read ?? ['**'],
					fsWrite: agent?.fs_scope?.write ?? [],
					secrets: ((agent as Record<string, unknown>)?.allowed_secrets as string[]) ?? [],
				},
				source: 'internal',
				ip: request.headers.get('x-forwarded-for') ?? undefined,
			}
		}
	}

	// Better Auth API key (human-created, for CI/CD)
	try {
		const authApi = config.auth.api as Record<string, (args: unknown) => Promise<unknown>>
		const verifyFn = authApi.verifyApiKey
		if (!verifyFn) return null
		const result = (await verifyFn({ body: { key } })) as {
			data?: { valid: boolean; key: { id: string; name?: string } }
		}
		const data = result?.data
		if (data?.valid) {
			return {
				id: data.key.id,
				type: 'api',
				name: data.key.name ?? 'api-client',
				role: 'member',
				permissions: resolveRolePermissions('member'),
				source: 'api',
				ip: request.headers.get('x-forwarded-for') ?? undefined,
			}
		}
	} catch {
		// Not a Better Auth API key
	}

	return null
}

async function resolveHumanActor(
	session: {
		user: { id: string; email: string; name?: string; twoFactorEnabled?: boolean }
		twoFactorVerified?: boolean
	},
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor | null> {
	// 2FA enforcement: if user has 2FA enabled but session not verified, reject
	if (session.user.twoFactorEnabled && !session.twoFactorVerified) {
		return null
	}

	// Role comes from team/humans/*.yaml, NOT from Better Auth DB
	const { loadHumans } = await import('../fs/company')

	let roleFromHumans: string | undefined
	try {
		const humans = await loadHumans(config.companyRoot)
		const human = humans.find((h: { email?: string }) => h.email === session.user.email)
		if (human) {
			roleFromHumans = human.role
		}
	} catch {
		// Fallback to viewer if humans dir not found
	}

	const role: 'owner' | 'admin' | 'member' | 'viewer' =
		roleFromHumans === 'owner' ||
		roleFromHumans === 'admin' ||
		roleFromHumans === 'member' ||
		roleFromHumans === 'viewer'
			? roleFromHumans
			: 'viewer'

	// Mandatory 2FA for owner/admin: if not enabled and path is not an auth route, block access.
	// Exempt /api/auth/* so users can still configure 2FA.
	if ((role === 'owner' || role === 'admin') && !session.user.twoFactorEnabled) {
		const path = new URL(request.url).pathname
		if (!path.startsWith('/api/auth/')) {
			return null
		}
	}

	return {
		id: session.user.id,
		type: 'human',
		name: session.user.name ?? session.user.email,
		role,
		permissions: resolveRolePermissions(role),
		source: detectSource(request),
		ip: request.headers.get('x-forwarded-for') ?? undefined,
	}
}

/**
 * Verify an incoming webhook request using per-webhook or global HMAC secret.
 *
 * Resolution:
 * 1. Load team/webhooks/*.yaml and match by path — use webhook-specific secret_ref / signature_header
 * 2. Fall back to WEBHOOK_SECRET env var with common signature headers
 * 3. If auth is 'none' in webhook config, allow without verification
 * 4. Reject if no secret configured, signature missing, or signature invalid
 */
async function verifyWebhookRequest(
	request: Request,
	path: string,
	config: ResolveActorConfig,
): Promise<Actor | Response> {
	const { join } = await import('node:path')
	const { timingSafeEqual, createHmac } = await import('node:crypto')
	const ip = request.headers.get('x-forwarded-for') ?? undefined

	// Try to load webhook config for this path
	let webhookConfig: {
		auth: 'hmac_sha256' | 'bearer_token' | 'none'
		secret_ref?: string
		signature_header?: string
	} | null = null

	try {
		const { loadWebhooks } = await import('../fs/company')
		const webhooks = await loadWebhooks(config.companyRoot)

		const matched = webhooks.find(
			(w: { path: string; enabled?: boolean }) =>
				w.enabled !== false && (path === w.path || path === `/${w.path}` || `/${path}` === w.path),
		)
		if (matched) {
			webhookConfig = {
				auth: (matched.auth as 'hmac_sha256' | 'bearer_token' | 'none') ?? 'hmac_sha256',
				secret_ref: matched.secret_ref,
				signature_header: matched.signature_header,
			}
		}
	} catch {
		// webhook directory missing or invalid — fall through to global secret
	}

	// If webhook is configured with auth: none, allow without verification
	if (webhookConfig?.auth === 'none') {
		return makeWebhookActor(ip)
	}

	// Resolve the secret: per-webhook secret_ref → global WEBHOOK_SECRET env
	let secret: string | null = null

	if (webhookConfig?.secret_ref) {
		try {
			const secretPath = join(config.companyRoot, 'secrets', `${webhookConfig.secret_ref}.yaml`)
			const secretFile = await Bun.file(secretPath).text()
			const { parse } = await import('yaml')
			const parsed = parse(secretFile)
			secret = parsed?.value ?? null
		} catch {
			// Secret file not readable
		}
	}

	if (!secret) {
		secret = process.env.WEBHOOK_SECRET ?? null
	}

	if (!secret) {
		return new Response(JSON.stringify({ error: 'No webhook secret configured' }), {
			status: 401,
			headers: { 'content-type': 'application/json' },
		})
	}

	// Determine which header contains the signature
	const signatureHeader = webhookConfig?.signature_header ?? null
	const signature =
		(signatureHeader ? request.headers.get(signatureHeader) : null) ??
		request.headers.get('x-hub-signature-256') ??
		request.headers.get('x-webhook-signature') ??
		request.headers.get('stripe-signature')

	if (!signature) {
		return new Response(JSON.stringify({ error: 'Missing webhook signature' }), {
			status: 401,
			headers: { 'content-type': 'application/json' },
		})
	}

	// Compute expected HMAC and compare using timing-safe comparison
	const body = await request.clone().text()
	const hmac = createHmac('sha256', secret).update(body).digest('hex')
	// Support both raw hex and sha256=hex prefix formats
	const expected = signature.startsWith('sha256=') ? `sha256=${hmac}` : hmac

	const sigBuffer = Buffer.from(signature)
	const expectedBuffer = Buffer.from(expected)

	if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
		return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
			status: 403,
			headers: { 'content-type': 'application/json' },
		})
	}

	return makeWebhookActor(ip)
}

/** Create a webhook actor with limited permissions. */
function makeWebhookActor(ip?: string): Actor {
	return {
		id: 'webhook',
		type: 'api',
		name: 'webhook',
		role: 'viewer',
		permissions: WEBHOOK_PERMISSIONS,
		source: 'webhook',
		ip,
	}
}

function detectSource(request: Request): Actor['source'] {
	const userAgent = request.headers.get('user-agent') ?? ''
	if (userAgent.includes('autopilot-cli')) return 'cli'
	if (userAgent.includes('Mozilla') || userAgent.includes('Chrome')) return 'dashboard'
	return 'api'
}

/**
 * Map an API path + method to the required permission.
 * Returns null for paths that don't require specific permissions.
 */
export function getRequiredPermission(
	path: string,
	method: string,
): { resource: string; action: string } | null {
	// Tasks
	if (path.startsWith('/api/tasks')) {
		if (method === 'GET') return { resource: 'tasks', action: 'read' }
		if (path.includes('/approve')) return { resource: 'tasks', action: 'approve' }
		if (path.includes('/reject')) return { resource: 'tasks', action: 'reject' }
		if (method === 'POST') return { resource: 'tasks', action: 'create' }
		if (method === 'DELETE') return { resource: 'tasks', action: 'delete' }
		return { resource: 'tasks', action: 'update' }
	}

	// Team
	if (path.startsWith('/api/team')) {
		if (path.includes('/invite') && method === 'POST') return { resource: 'team', action: 'invite' }
		if (path.includes('/invite') && method === 'DELETE')
			return { resource: 'team', action: 'invite' }
		if (path.includes('/role') && method === 'PUT')
			return { resource: 'team', action: 'change_role' }
		if (method === 'DELETE') return { resource: 'team', action: 'remove' }
		return { resource: 'team', action: 'read' }
	}

	// Agents
	if (path.startsWith('/api/agents'))
		return { resource: 'agents', action: method === 'GET' ? 'read' : 'configure' }

	// Secrets
	if (path.startsWith('/api/secrets'))
		return {
			resource: 'secrets',
			action: method === 'GET' ? 'read' : method === 'DELETE' ? 'delete' : 'create',
		}

	// Knowledge
	if (path.startsWith('/api/knowledge'))
		return { resource: 'knowledge', action: method === 'GET' ? 'read' : 'write' }

	// Chat
	if (path.startsWith('/api/chat'))
		return { resource: 'chat', action: method === 'GET' ? 'read' : 'write' }

	// Integrations
	if (path.startsWith('/api/integrations')) {
		if (method === 'POST') return { resource: 'integrations', action: 'connect' }
		if (method === 'DELETE') return { resource: 'integrations', action: 'disconnect' }
		return { resource: 'integrations', action: 'read' }
	}

	// Audit
	if (path.startsWith('/api/audit')) return { resource: 'audit', action: 'read' }

	// Sessions
	if (path.startsWith('/api/sessions')) {
		return { resource: 'sessions', action: method === 'GET' ? 'read' : 'revoke' }
	}

	// Dashboard read endpoints
	if (
		path.startsWith('/api/pins') ||
		path.startsWith('/api/activity') ||
		path.startsWith('/api/inbox') ||
		path.startsWith('/api/skills') ||
		path.startsWith('/api/artifacts') ||
		path.startsWith('/api/groups') ||
		path.startsWith('/api/dashboard')
	) {
		return { resource: 'dashboard', action: 'read' }
	}

	// Settings
	if (path.startsWith('/api/settings')) {
		if (path.startsWith('/api/settings/providers')) {
			if (method === 'GET') return { resource: 'settings', action: 'read' }
			return { resource: 'settings', action: 'write' }
		}
		if (method === 'GET') return { resource: 'settings', action: 'read' }
		return { resource: 'settings', action: 'write' }
	}

	// Danger zone
	if (path === '/api/export' && method === 'POST') return { resource: 'danger', action: 'export' }
	if (path === '/api/reset' && method === 'POST') return { resource: 'danger', action: 'reset' }
	if (path === '/api/delete-company' && method === 'POST')
		return { resource: 'danger', action: 'delete' }

	// Notifications
	if (path.startsWith('/api/notifications')) {
		if (method === 'GET') return { resource: 'notifications', action: 'read' }
		return { resource: 'notifications', action: 'write' }
	}

	// Channels
	if (path.startsWith('/api/channels')) {
		if (method === 'GET') return { resource: 'channels', action: 'read' }
		return { resource: 'channels', action: 'write' }
	}

	// Search
	if (path.startsWith('/api/search')) return { resource: 'search', action: 'read' }

	// Files & Upload
	if (path.startsWith('/api/files')) {
		if (method === 'GET') return { resource: 'files', action: 'read' }
		return { resource: 'files', action: 'write' }
	}
	if (path.startsWith('/api/upload')) return { resource: 'files', action: 'write' }

	// Events (SSE)
	if (path.startsWith('/api/events')) return { resource: 'events', action: 'read' }

	// FS browser
	if (path.startsWith('/fs/')) return { resource: 'knowledge', action: 'read' }

	return null
}
