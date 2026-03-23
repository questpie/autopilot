/**
 * Auth middleware — resolves every request to an Actor.
 *
 * Resolution order:
 * 1. auth.enabled = false → implicit owner (zero friction)
 * 2. /hooks/* → HMAC webhook auth (exempt from bearer/API key)
 * 3. X-API-Key header → agent key or Better Auth API key
 * 4. Authorization: Bearer → Better Auth session or agent key
 * 5. null → 401
 */
import type { Auth } from './index'
import type { Actor } from './types'
import { verifyAgentKey } from './agent-keys'
import { resolveRolePermissions } from './roles'
import { loadAgents } from '../fs'

export interface ResolveActorConfig {
	authEnabled: boolean
	companyRoot: string
	auth: Auth
}

/**
 * Resolve the identity of an incoming request into an Actor.
 */
export async function resolveActor(
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor | null> {
	// 0. Auth disabled → implicit owner
	if (!config.authEnabled) {
		return {
			id: 'implicit-owner',
			type: 'human',
			name: 'Owner',
			role: 'owner',
			permissions: { '*': ['*'] },
			source: detectSource(request),
		}
	}

	const path = new URL(request.url).pathname

	// 1. Webhook HMAC auth (/hooks/*)
	if (path.startsWith('/hooks/')) {
		return {
			id: 'webhook',
			type: 'api',
			name: 'webhook',
			role: 'member',
			permissions: resolveRolePermissions('member'),
			source: 'webhook',
			ip: request.headers.get('x-forwarded-for') ?? undefined,
		}
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
			const authApi = config.auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const getSessionFn = authApi.getSession
			if (!getSessionFn) return null
			const session = await getSessionFn({ headers: request.headers }) as { user: { id: string; email: string; name?: string } } | null
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
					secrets: (agent as Record<string, unknown>)?.allowed_secrets as string[] ?? [],
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
		const result = await verifyFn({ body: { key } }) as { data?: { valid: boolean; key: { id: string; name?: string } } }
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
	session: { user: { id: string; email: string; name?: string } },
	request: Request,
	config: ResolveActorConfig,
): Promise<Actor> {
	// Role comes from humans.yaml, NOT from Better Auth DB
	const { readYamlUnsafe } = await import('../fs/yaml')
	const { join } = await import('node:path')

	let role: 'owner' | 'admin' | 'member' | 'viewer' = 'viewer'
	try {
		const humansData = (await readYamlUnsafe(
			join(config.companyRoot, 'team', 'humans.yaml'),
		)) as { humans: Array<{ email?: string; role: string }> }
		const human = humansData.humans.find((h) => h.email === session.user.email)
		if (human) {
			role = human.role as typeof role
		}
	} catch {
		// Fallback to viewer if humans.yaml not found
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
		if (path.includes('/invite') && method === 'DELETE') return { resource: 'team', action: 'invite' }
		if (path.includes('/role') && method === 'PUT') return { resource: 'team', action: 'change_role' }
		if (method === 'DELETE') return { resource: 'team', action: 'remove' }
		return { resource: 'team', action: 'read' }
	}

	// Agents
	if (path.startsWith('/api/agents')) return { resource: 'agents', action: method === 'GET' ? 'read' : 'configure' }

	// Secrets
	if (path.startsWith('/api/secrets')) return { resource: 'secrets', action: method === 'GET' ? 'read' : method === 'DELETE' ? 'delete' : 'create' }

	// Knowledge
	if (path.startsWith('/api/knowledge')) return { resource: 'knowledge', action: method === 'GET' ? 'read' : 'write' }

	// Chat
	if (path.startsWith('/api/chat')) return { resource: 'chat', action: 'write' }

	// Integrations
	if (path.startsWith('/api/integrations')) {
		if (method === 'POST') return { resource: 'integrations', action: 'connect' }
		if (method === 'DELETE') return { resource: 'integrations', action: 'disconnect' }
		return { resource: 'integrations', action: 'read' }
	}

	// Audit
	if (path.startsWith('/api/audit')) return { resource: 'audit', action: 'read' }

	// Dashboard read endpoints
	if (
		path.startsWith('/api/pins') || path.startsWith('/api/activity') ||
		path.startsWith('/api/inbox') || path.startsWith('/api/skills') ||
		path.startsWith('/api/artifacts') || path.startsWith('/api/groups') ||
		path.startsWith('/api/dashboard')
	) {
		return { resource: 'dashboard', action: 'read' }
	}

	// FS browser
	if (path.startsWith('/fs/')) return { resource: 'knowledge', action: 'read' }

	return null
}
