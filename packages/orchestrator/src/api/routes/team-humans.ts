import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { HUMAN_ROLES, HumanSchema, PATHS } from '@questpie/autopilot-spec'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
/**
 * Team humans API — manage human users (list, invite, roles, ban/unban).
 *
 * GET    /team/humans              → list all human users with roles, 2FA status
 * POST   /team/humans/invite       → add email to .auth/invites.yaml
 * DELETE /team/humans/invite       → remove email from .auth/invites.yaml
 * PATCH  /team/humans/:id/role     → change role in team/humans/{id}.yaml
 * POST   /team/humans/:id/ban      → ban user via Better Auth admin
 * POST   /team/humans/:id/unban    → unban user via Better Auth admin
 *
 * Only owner/admin can access these endpoints (enforced by RBAC middleware).
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import * as authSchema from '../../db/auth-schema'
import { env } from '../../env'
import { readYaml } from '../../fs/yaml'
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
	role: z.enum(HUMAN_ROLES).default('member'),
})

const InviteDeleteSchema = z.object({
	email: z.string().email('Invalid email address'),
})

const InviteRecordSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	role: z.enum(HUMAN_ROLES),
	token: z.string(),
	inviteUrl: z.string().url(),
	createdAt: z.string(),
	expiresAt: z.string().nullable(),
	acceptedAt: z.string().nullable(),
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

function buildInviteUrl(email: string, token: string): string {
	const baseOrigin =
		env.CORS_ORIGIN?.split(',')
			.map((origin) => origin.trim())
			.find(Boolean) ?? 'http://localhost:3000'
	const url = new URL('/signup', baseOrigin)
	url.searchParams.set('email', email)
	url.searchParams.set('token', token)
	return url.toString()
}

/** Read all human files from team/humans/*.yaml and return parsed data. */
async function readHumansFile(companyRoot: string): Promise<{
	humans: Array<{ id: string; email?: string; role: string; name?: string; [key: string]: unknown }>
}> {
	const dir = join(companyRoot, PATHS.HUMANS_DIR.slice(1))
	if (!existsSync(dir)) return { humans: [] }
	const humans: Array<{
		id: string
		email?: string
		role: string
		name?: string
		[key: string]: unknown
	}> = []
	const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
	for (const file of files) {
		try {
			const human = await readYaml(join(dir, file), HumanSchema)
			humans.push(human as { id: string; email?: string; role: string; name?: string })
		} catch {
			// skip invalid
		}
	}
	return { humans }
}

/** Guard: only owner/admin can access. Returns error response or null. */
function requireAdminRole(c: {
	get(key: 'actor'): { role: string } | null
	json: (data: unknown, status: number) => Response
}): Response | null {
	const actor = c.get('actor')
	if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
		return c.json({ error: 'Forbidden: owner or admin role required' }, 403)
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

			const result = (await listUsersFn({ query: { limit: 9999 } })) as {
				users?: Array<{
					id: string
					email: string
					name?: string
					role?: string
					banned?: boolean
					twoFactorEnabled?: boolean
					createdAt?: string
				}>
			}

			const users: Array<{
				id: string
				email: string
				name?: string
				role?: string
				banned?: boolean
				twoFactorEnabled?: boolean
				createdAt?: string
			}> = result?.users ?? []

			// Merge role from team/humans/*.yaml
			const humansFile = await readHumansFile(root)
			const humansMap = new Map(humansFile.humans.map((h) => [h.email, h]))

			const merged = users.map((u) => {
				const humanRecord = humansMap.get(u.email)
				return {
					id: u.id,
					name: u.name,
					email: u.email,
					role: u.role ?? humanRecord?.role ?? 'viewer',
					twoFactorEnabled: u.twoFactorEnabled ?? false,
					banned: u.banned ?? false,
					createdAt: u.createdAt,
				}
			})

			return c.json(merged, 200)
		},
	)
	.get(
		'/invite',
		describeRoute({
			tags: ['team'],
			description: 'List pending invites from SQLite',
			responses: {
				200: {
					description: 'Array of pending invites',
					content: { 'application/json': { schema: resolver(z.array(InviteRecordSchema)) } },
				},
				403: { description: 'Forbidden' },
			},
		}),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const db = c.get('db')
			const invites = await db
				.select()
				.from(authSchema.invite)
				.where(
					and(
						isNull(authSchema.invite.acceptedAt),
						or(isNull(authSchema.invite.expiresAt), gt(authSchema.invite.expiresAt, new Date())),
					),
				)

			return c.json(
				invites.map((invite) => ({
					id: invite.id,
					email: invite.email,
					role: invite.role as (typeof HUMAN_ROLES)[number],
					token: invite.token,
					inviteUrl: buildInviteUrl(invite.email, invite.token),
					createdAt: invite.createdAt.toISOString(),
					expiresAt: invite.expiresAt?.toISOString() ?? null,
					acceptedAt: invite.acceptedAt?.toISOString() ?? null,
				})),
				200,
			)
		},
	)
	// ── POST /team/humans/invite — add email to invite list ──────────
	.post(
		'/invite',
		describeRoute({
			tags: ['team'],
			description: 'Create a pending invite in SQLite for a future Better Auth signup',
			responses: {
				200: {
					description: 'Invite created',
					content: {
						'application/json': {
							schema: resolver(z.object({ ok: z.literal(true), invite: InviteRecordSchema })),
						},
					},
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

			const db = c.get('db')
			const actor = c.get('actor')
			const { email, role } = c.req.valid('json')
			const lowerEmail = email.toLowerCase()

			const existingUser = await db
				.select({ id: authSchema.user.id })
				.from(authSchema.user)
				.where(eq(authSchema.user.email, lowerEmail))
				.get()
			if (existingUser) {
				return c.json({ error: 'User already exists' }, 409)
			}

			const existingInvite = await db
				.select({ id: authSchema.invite.id })
				.from(authSchema.invite)
				.where(and(eq(authSchema.invite.email, lowerEmail), isNull(authSchema.invite.acceptedAt)))
				.get()
			if (existingInvite) {
				return c.json({ error: 'Email already invited' }, 409)
			}

			const now = new Date()
			const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7)
			const token = randomUUID()
			const inviteId = randomUUID()
			await db.insert(authSchema.invite).values({
				id: inviteId,
				email: lowerEmail,
				role,
				token,
				invitedBy: actor?.id ?? null,
				createdAt: now,
				updatedAt: now,
				expiresAt,
			})

			return c.json(
				{
					ok: true as const,
					invite: {
						id: inviteId,
						email: lowerEmail,
						role,
						token,
						inviteUrl: buildInviteUrl(lowerEmail, token),
						createdAt: now.toISOString(),
						expiresAt: expiresAt.toISOString(),
						acceptedAt: null,
					},
				},
				200,
			)
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
		zValidator('json', InviteDeleteSchema),
		async (c) => {
			const denied = requireAdminRole(c as never)
			if (denied) return denied

			const db = c.get('db')
			const { email } = c.req.valid('json')
			const lowerEmail = email.toLowerCase()

			const existingInvite = await db
				.select({ id: authSchema.invite.id })
				.from(authSchema.invite)
				.where(and(eq(authSchema.invite.email, lowerEmail), isNull(authSchema.invite.acceptedAt)))
				.get()

			if (!existingInvite) {
				return c.json({ error: 'Email not on invite list' }, 404)
			}

			await db.delete(authSchema.invite).where(eq(authSchema.invite.id, existingInvite.id))

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── PATCH /team/humans/:id/role — change user role ───────────────
	.patch(
		'/:id/role',
		describeRoute({
			tags: ['team'],
			description: "Change a user's role in team/humans/{id}.yaml",
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

			const db = c.get('db')
			const { id } = c.req.valid('param')
			const { role } = c.req.valid('json')

			// Get user email directly from DB
			const user = await db
				.select({ id: authSchema.user.id, email: authSchema.user.email })
				.from(authSchema.user)
				.where(eq(authSchema.user.id, id))
				.get()
			if (!user) {
				return c.json({ error: 'User not found' }, 404)
			}

			await db.update(authSchema.user).set({ role }).where(eq(authSchema.user.id, id))

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
