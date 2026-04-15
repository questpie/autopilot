/**
 * Invite management API routes.
 *
 * POST   /api/invites             — create invite (owner/admin only)
 * GET    /api/invites             — list all invites (owner/admin only)
 * DELETE /api/invites/:id         — revoke invite (owner/admin only)
 * GET    /api/invites/validate    — validate token (public, for signup page)
 * POST   /api/invites/accept      — accept invite (public, creates user)
 */
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import * as authSchema from '../../db/auth-schema'
import type { AppEnv } from '../app'

const INVITE_TTL_DAYS = 7

function requireAdminOrOwner(role: string | null | undefined): boolean {
	return role === 'owner' || role === 'admin'
}

const invites = new Hono<AppEnv>()
	// GET /validate — public, used by signup page
	.get('/validate', async (c) => {
		const token = c.req.query('token')
		if (!token) {
			return c.json({ error: 'token is required' }, 400)
		}

		const db = c.get('db')
		const row = await db
			.select()
			.from(authSchema.invite)
			.where(eq(authSchema.invite.token, token))
			.get()

		if (!row) {
			return c.json({ error: 'Invalid invite token' }, 404)
		}

		if (row.acceptedAt) {
			return c.json({ error: 'Invite already accepted' }, 410)
		}

		if (row.expiresAt && row.expiresAt < new Date()) {
			return c.json({ error: 'Invite has expired' }, 410)
		}

		return c.json({ email: row.email, role: row.role }, 200)
	})
	// POST /accept — public, creates user from invite
	.post('/accept', async (c) => {
		const body = await c.req.json<{ token: string; name: string; email: string; password: string }>()

		if (!body.token || !body.name || !body.email || !body.password) {
			return c.json({ error: 'token, name, email, and password are required' }, 400)
		}

		const db = c.get('db')
		const row = await db
			.select()
			.from(authSchema.invite)
			.where(eq(authSchema.invite.token, body.token))
			.get()

		if (!row) {
			return c.json({ error: 'Invalid invite token' }, 404)
		}

		if (row.acceptedAt) {
			return c.json({ error: 'Invite already accepted' }, 410)
		}

		if (row.expiresAt && row.expiresAt < new Date()) {
			return c.json({ error: 'Invite has expired' }, 410)
		}

		if (row.email.toLowerCase() !== body.email.toLowerCase()) {
			return c.json({ error: 'Email does not match invite' }, 400)
		}

		const auth = c.get('auth')

		// Create the user via better-auth sign-up
		const signUpResult = await auth.api.signUpEmail({
			body: {
				email: body.email,
				password: body.password,
				name: body.name,
			},
		})

		if (!signUpResult || !signUpResult.user) {
			return c.json({ error: 'Failed to create user' }, 500)
		}

		// If invite has a non-default role, update the user's role
		if (row.role && row.role !== 'member') {
			await db
				.update(authSchema.user)
				.set({ role: row.role, updatedAt: new Date() })
				.where(eq(authSchema.user.id, signUpResult.user.id))
		}

		// Mark invite accepted
		await db
			.update(authSchema.invite)
			.set({ acceptedAt: new Date(), updatedAt: new Date() })
			.where(eq(authSchema.invite.token, body.token))

		return c.json({ ok: true }, 200)
	})
	// GET / — list all invites (owner/admin only)
	.get('/', async (c) => {
		const actor = c.get('actor')
		if (!requireAdminOrOwner(actor?.role)) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		const db = c.get('db')
		const rows = await db.select().from(authSchema.invite).all()
		return c.json(rows, 200)
	})
	// POST / — create invite (owner/admin only)
	.post('/', async (c) => {
		const actor = c.get('actor')
		if (!requireAdminOrOwner(actor?.role)) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		const body = await c.req.json<{ email: string; role?: string }>()

		if (!body.email) {
			return c.json({ error: 'email is required' }, 400)
		}

		const db = c.get('db')

		// Check for existing non-accepted invite for this email
		const existing = await db
			.select()
			.from(authSchema.invite)
			.where(eq(authSchema.invite.email, body.email.toLowerCase()))
			.get()

		if (existing && !existing.acceptedAt) {
			return c.json({ error: 'An active invite already exists for this email' }, 409)
		}

		const token = randomBytes(32).toString('hex')
		const now = new Date()
		const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)
		const id = randomBytes(16).toString('hex')

		const invite = {
			id,
			email: body.email.toLowerCase(),
			role: body.role ?? 'member',
			token,
			invitedBy: actor?.id ?? null,
			createdAt: now,
			updatedAt: now,
			expiresAt,
			acceptedAt: null,
		}

		// If accepted invite exists for same email, delete it first to allow re-invite
		if (existing?.acceptedAt) {
			await db.delete(authSchema.invite).where(eq(authSchema.invite.email, body.email.toLowerCase()))
		}

		await db.insert(authSchema.invite).values(invite)
		return c.json(invite, 201)
	})
	// DELETE /:id — revoke invite (owner/admin only)
	.delete('/:id', async (c) => {
		const actor = c.get('actor')
		if (!requireAdminOrOwner(actor?.role)) {
			return c.json({ error: 'Forbidden' }, 403)
		}

		const db = c.get('db')
		const id = c.req.param('id')

		const existing = await db
			.select()
			.from(authSchema.invite)
			.where(eq(authSchema.invite.id, id))
			.get()

		if (!existing) {
			return c.json({ error: 'Invite not found' }, 404)
		}

		await db.delete(authSchema.invite).where(eq(authSchema.invite.id, id))
		return c.json({ ok: true, deleted: id }, 200)
	})

export { invites }
