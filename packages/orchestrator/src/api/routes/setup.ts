import { join } from 'node:path'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import * as authSchema from '../../db/auth-schema'
import { fileExists, readYamlUnsafe, writeYaml } from '../../fs/yaml'
import type { AppEnv } from '../app'

const VerificationStatusSchema = z.object({
	exists: z.boolean(),
	verified: z.boolean(),
})

const InviteValidationSchema = z.object({
	valid: z.boolean(),
	email: z.string().email().nullable(),
	role: z.string().nullable(),
	expiresAt: z.string().nullable(),
})

const SetupCompleteSchema = z.object({
	ok: z.literal(true),
	setupCompleted: z.literal(true),
})

const VerificationQuerySchema = z.object({
	email: z.string().email(),
})

const InviteQuerySchema = z.object({
	token: z.string().min(1),
	email: z.string().email().optional(),
})

async function markSetupCompleted(root: string, actorId: string): Promise<void> {
	const companyPath = join(root, 'company.yaml')
	const existing = (await fileExists(companyPath))
		? ((await readYamlUnsafe(companyPath)) as Record<string, unknown>)
		: {}

	await writeYaml(companyPath, {
		...existing,
		setup_completed: true,
		setup_completed_at: new Date().toISOString(),
		setup_completed_by: actorId,
		onboarding_chat_completed:
			typeof existing.onboarding_chat_completed === 'boolean'
				? existing.onboarding_chat_completed
				: false,
	})
}

const setupPublic = new Hono<AppEnv>()
	.get(
		'/verification-status',
		describeRoute({
			tags: ['setup'],
			description: 'Check whether a signup email exists and has been verified',
			responses: {
				200: {
					description: 'Verification status',
					content: { 'application/json': { schema: resolver(VerificationStatusSchema) } },
				},
			},
		}),
		zValidator('query', VerificationQuerySchema),
		async (c) => {
			const db = c.get('db')
			const { email } = c.req.valid('query')
			const user = await db
				.select({ id: authSchema.user.id, emailVerified: authSchema.user.emailVerified })
				.from(authSchema.user)
				.where(eq(authSchema.user.email, email.toLowerCase()))
				.get()

			return c.json(
				{
					exists: !!user,
					verified: user?.emailVerified ?? false,
				},
				200,
			)
		},
	)
	.get(
		'/invite',
		describeRoute({
			tags: ['setup'],
			description: 'Validate a pending invite token for signup',
			responses: {
				200: {
					description: 'Invite validation result',
					content: { 'application/json': { schema: resolver(InviteValidationSchema) } },
				},
			},
		}),
		zValidator('query', InviteQuerySchema),
		async (c) => {
			const db = c.get('db')
			const { token, email } = c.req.valid('query')
			const invite = await db
				.select()
				.from(authSchema.invite)
				.where(
					and(
						eq(authSchema.invite.token, token),
						isNull(authSchema.invite.acceptedAt),
						or(isNull(authSchema.invite.expiresAt), gt(authSchema.invite.expiresAt, new Date())),
					),
				)
				.get()

			if (!invite) {
				return c.json({ valid: false, email: null, role: null, expiresAt: null }, 200)
			}

			if (email && invite.email !== email.toLowerCase()) {
				return c.json({ valid: false, email: null, role: null, expiresAt: null }, 200)
			}

			return c.json(
				{
					valid: true,
					email: invite.email,
					role: invite.role,
					expiresAt: invite.expiresAt?.toISOString() ?? null,
				},
				200,
			)
		},
	)

const setup = new Hono<AppEnv>().post(
	'/complete',
	describeRoute({
		tags: ['setup'],
		description: 'Mark onboarding as completed in company.yaml',
		responses: {
			200: {
				description: 'Setup completed',
				content: { 'application/json': { schema: resolver(SetupCompleteSchema) } },
			},
		},
	}),
	async (c) => {
		const actor = c.get('actor')
		if (!actor || actor.type !== 'human') {
			return c.json({ error: 'Only authenticated humans can complete setup' }, 403)
		}

		const db = c.get('db')
		const userCountRow = await db
			.select({ count: sql<number>`count(*)` })
			.from(authSchema.user)
			.get()
		const userCount = Number(userCountRow?.count ?? 0)
		if (userCount === 0) {
			return c.json({ error: 'Cannot complete setup before creating a user' }, 400)
		}

		await markSetupCompleted(c.get('companyRoot'), actor.id)
		return c.json({ ok: true as const, setupCompleted: true as const }, 200)
	},
)

export { setup, setupPublic }
