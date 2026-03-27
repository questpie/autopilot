/**
 * Team humans API — manage human users (list, invite, roles, ban/unban).
 *
 * GET    /team/humans              → list all human users with roles, 2FA status
 * POST   /team/humans/invite       → add email to .auth/invites.yaml
 * DELETE /team/humans/invite       → remove email from .auth/invites.yaml
 * PATCH  /team/humans/:id/role     → change role in humans.yaml
 * POST   /team/humans/:id/ban      → ban user via Better Auth admin
 * POST   /team/humans/:id/unban    → unban user via Better Auth admin
 *
 * Only owner/admin can access these endpoints (enforced by RBAC middleware).
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { readYamlUnsafe, fileExists, writeYaml } from '../../fs/yaml'
import { HUMAN_ROLES } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

// ── Schemas ─────────────────────────────────────────────────────────────────

const HumanUserSchema = z.object({
	id: z.string(),
	name: z.string().optional(),
	email: z.string(),
	role: z.string(),
	twoFactorEnabled: z.boolean(),
	banned: z.boolean(),
	createdAt: z.string().optional(),
})

const InviteRequestSchema = z.object({
	email: z.string().email('Invalid email address'),
})

const RoleChangeSchema = z.object({
	role: z.enum(HUMAN_ROLES),
})

const BanRequestSchema = z.object({
	reason: z.string().optional(),
})

const IdParamSchema = z.object({
	id: z.string(),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read .auth/invites.yaml as a string array. Returns empty array if not found. */
async function readInvites(companyRoot: string): Promise<string[]> {
	const invitesPath = join(companyRoot, '.auth', 'invites.yaml')
	if (!(await fileExists(invitesPath))) return []
	try {
		const data = await readYamlUnsafe(invitesPath)
		if (Array.isArray(data)) return data as string[]
		return []
	} catch {
		return []
	}
}

/** Write .auth/invites.yaml from a string array. */
async function writeInvites(companyRoot: string, emails: string[]): Promise<void> {
	const invitesDir = join(companyRoot, '.auth')
	await mkdir(invitesDir, { recursive: true })
	await writeYaml(join(invitesDir, 'invites.yaml'), emails)
}

/** Read humans.yaml and return parsed data. */
async function readHumansFile(companyRoot: string): Promise<{ humans: Array<{ id: string; email?: string; role: string; name?: string; [key: string]: unknown }> }> {
	const humansPath = join(companyRoot, 'team', 'humans.yaml')
	if (!(await fileExists(humansPath))) return { humans: [] }
	try {
		const data = await readYamlUnsafe(humansPath)
		return (data as { humans: Array<{ id: string; email?: string; role: string; name?: string }> }) ?? { humans: [] }
	} catch {
		return { humans: [] }
	}
}

/** Write humans.yaml. */
async function writeHumansFile(companyRoot: string, data: { humans: Array<Record<string, unknown>> }): Promise<void> {
	const teamDir = join(companyRoot, 'team')
	await mkdir(teamDir, { recursive: true })
	await writeYaml(join(teamDir, 'humans.yaml'), data)
}

/** Guard: only owner/admin can access. Returns error response or null. */
function requireAdminRole(c: { get(key: 'actor'): { role: string } | null; json: (data: unknown, status: number) => Response }): Response | null {
	const actor = c.get('actor')
	if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
		return c.json({ error: 'Forbidden: owner or admin role required' }, 403) as unknown as Response
	}
	return null
}

// ── Routes ──────────────────────────────────────────────────────────────────

const teamHumans = new Hono<AppEnv>()
	// ── GET /team/humans — list all human users ──────────────────────
	.get(
		'/',
		describeRoute({
			tags: ['team'],
			description: 'List all human users with roles, 2FA status, and ban status',
			responses: {
				200: {
					description: 'Array of human users',
					content: { 'application/json': { schema: resolver(z.array(HumanUserSchema)) } },
				},
				403: { description: 'Forbidden' },
			},
		}),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const root = c.get('companyRoot')
			const auth = c.get('auth')

			// Get all users from Better Auth
			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const listUsersFn = authApi.listUsers
			if (!listUsersFn) {
				return c.json([], 200)
			}

			const result = await listUsersFn({ query: { limit: 9999 } }) as {
				users?: Array<{
					id: string
					email: string
					name?: string
					banned?: boolean
					twoFactorEnabled?: boolean
					createdAt?: string
				}>
			}

			const users = result?.users ?? []

			// Merge role from humans.yaml
			const humansFile = await readHumansFile(root)
			const humansMap = new Map(
				humansFile.humans.map((h) => [h.email, h]),
			)

			const merged = users.map((u) => {
				const humanRecord = humansMap.get(u.email)
				return {
					id: u.id,
					name: u.name,
					email: u.email,
					role: humanRecord?.role ?? 'viewer',
					twoFactorEnabled: u.twoFactorEnabled ?? false,
					banned: u.banned ?? false,
					createdAt: u.createdAt,
				}
			})

			return c.json(merged, 200)
		},
	)
	// ── POST /team/humans/invite — add email to invite list ──────────
	.post(
		'/invite',
		describeRoute({
			tags: ['team'],
			description: 'Add an email to the invite list (.auth/invites.yaml)',
			responses: {
				200: {
					description: 'Email added',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				400: { description: 'Invalid email' },
				403: { description: 'Forbidden' },
				409: { description: 'Email already invited' },
			},
		}),
		zValidator('json', InviteRequestSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const root = c.get('companyRoot')
			const { email } = c.req.valid('json')

			const invites = await readInvites(root)
			const lowerEmail = email.toLowerCase()

			if (invites.some((e) => e.toLowerCase() === lowerEmail)) {
				return c.json({ error: 'Email already on invite list' }, 409)
			}

			invites.push(email)
			await writeInvites(root, invites)

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── DELETE /team/humans/invite — remove email from invite list ───
	.delete(
		'/invite',
		describeRoute({
			tags: ['team'],
			description: 'Remove an email from the invite list',
			responses: {
				200: {
					description: 'Email removed',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				403: { description: 'Forbidden' },
				404: { description: 'Email not on invite list' },
			},
		}),
		zValidator('json', InviteRequestSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const root = c.get('companyRoot')
			const { email } = c.req.valid('json')

			const invites = await readInvites(root)
			const lowerEmail = email.toLowerCase()
			const idx = invites.findIndex((e) => e.toLowerCase() === lowerEmail)

			if (idx < 0) {
				return c.json({ error: 'Email not on invite list' }, 404)
			}

			invites.splice(idx, 1)
			await writeInvites(root, invites)

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── PATCH /team/humans/:id/role — change user role ───────────────
	.patch(
		'/:id/role',
		describeRoute({
			tags: ['team'],
			description: 'Change a user\'s role in humans.yaml',
			responses: {
				200: {
					description: 'Role updated',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				403: { description: 'Forbidden' },
				404: { description: 'User not found' },
			},
		}),
		zValidator('param', IdParamSchema),
		zValidator('json', RoleChangeSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const root = c.get('companyRoot')
			const auth = c.get('auth')
			const { id } = c.req.valid('param')
			const { role } = c.req.valid('json')

			// Get user email from Better Auth
			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const listUsersFn = authApi.listUsers
			if (!listUsersFn) {
				return c.json({ error: 'Auth API unavailable' }, 500)
			}

			const result = await listUsersFn({ query: { limit: 9999 } }) as {
				users?: Array<{ id: string; email: string }>
			}
			const user = result?.users?.find((u) => u.id === id)
			if (!user) {
				return c.json({ error: 'User not found' }, 404)
			}

			// Update humans.yaml
			const humansFile = await readHumansFile(root)
			const existingIdx = humansFile.humans.findIndex((h) => h.email === user.email)

			if (existingIdx >= 0) {
				humansFile.humans[existingIdx]!.role = role
			} else {
				humansFile.humans.push({
					id: user.email.split('@')[0] ?? user.email,
					name: user.email.split('@')[0] ?? user.email,
					email: user.email,
					role,
				})
			}

			await writeHumansFile(root, humansFile as { humans: Array<Record<string, unknown>> })

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── POST /team/humans/:id/ban — ban a user ──────────────────────
	.post(
		'/:id/ban',
		describeRoute({
			tags: ['team'],
			description: 'Ban a user via Better Auth admin plugin',
			responses: {
				200: {
					description: 'User banned',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				403: { description: 'Forbidden' },
				404: { description: 'User not found' },
			},
		}),
		zValidator('param', IdParamSchema),
		zValidator('json', BanRequestSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const auth = c.get('auth')
			const { id } = c.req.valid('param')
			const { reason } = c.req.valid('json')

			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const banUserFn = authApi.banUser
			if (!banUserFn) {
				return c.json({ error: 'Admin plugin not available' }, 500)
			}

			try {
				await banUserFn({ body: { userId: id, banReason: reason } })
			} catch (err) {
				return c.json({ error: (err as Error).message ?? 'Failed to ban user' }, 400)
			}

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── POST /team/humans/:id/unban — unban a user ──────────────────
	.post(
		'/:id/unban',
		describeRoute({
			tags: ['team'],
			description: 'Unban a user via Better Auth admin plugin',
			responses: {
				200: {
					description: 'User unbanned',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				403: { description: 'Forbidden' },
				404: { description: 'User not found' },
			},
		}),
		zValidator('param', IdParamSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const auth = c.get('auth')
			const { id } = c.req.valid('param')

			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const unbanUserFn = authApi.unbanUser
			if (!unbanUserFn) {
				return c.json({ error: 'Admin plugin not available' }, 500)
			}

			try {
				await unbanUserFn({ body: { userId: id } })
			} catch (err) {
				return c.json({ error: (err as Error).message ?? 'Failed to unban user' }, 400)
			}

			return c.json({ ok: true as const }, 200)
		},
	)

export { teamHumans }
