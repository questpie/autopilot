/**
 * Better Auth instance for QUESTPIE Autopilot.
 *
 * Uses the Drizzle adapter so that all tables are managed by Drizzle
 * migrations — no more Kysely internal migrations.
 */
import { betterAuth } from 'better-auth'
import { bearer, admin, openAPI, twoFactor } from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import type { AutopilotDb } from '../db'
import * as authSchema from '../db/auth-schema'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'

const PASSWORD_COMPLEXITY_RE = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/

function validatePasswordComplexity(password: string): void {
	if (!PASSWORD_COMPLEXITY_RE.test(password)) {
		throw new Error(
			'Password must be at least 12 characters and include at least one digit and one special character.',
		)
	}
}

async function loadInviteEmails(companyRoot: string): Promise<string[] | null> {
	try {
		const raw = await readFile(join(companyRoot, '.auth', 'invites.yaml'), 'utf-8')
		// Simple YAML parse: look for lines like "  - email@example.com"
		const emails: string[] = []
		for (const line of raw.split('\n')) {
			const trimmed = line.trim()
			if (trimmed.startsWith('- ')) {
				const email = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '')
				if (email) emails.push(email)
			}
		}
		return emails
	} catch {
		// File doesn't exist — allow all signups (fresh install)
		return null
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(db: AutopilotDb, companyRoot: string) {
	const auth = betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: authSchema,
		}),
		basePath: '/api/auth',

		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
			password: {
				hash: async (password: string) => {
					validatePasswordComplexity(password)
					return hashPassword(password)
				},
				verify: ({ hash, password }: { hash: string; password: string }) => {
					return verifyPassword({ hash, password })
				},
			},
		},

		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: true,
				maxAge: 60 * 5,
			},
		},

		trustedOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3001')
			.split(',')
			.map((o) => o.trim()),
		advanced: {
			defaultCookieAttributes: {
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				httpOnly: true,
			},
		},

		rateLimit: {
			storage: 'database',
			window: 60,
			max: 30,
			customRules: {
				'/api/auth/sign-in/*': { window: 300, max: 10 },
				'/api/auth/sign-up/*': { window: 300, max: 5 },
			},
		},

		databaseHooks: {
			user: {
				create: {
					before: async (user: { email: string; [key: string]: unknown }) => {
						// Invite-only: check .auth/invites.yaml
						const allowedEmails = await loadInviteEmails(companyRoot)
						if (allowedEmails !== null) {
							const emailLower = user.email.toLowerCase()
							const isInvited = allowedEmails.some((e) => e.toLowerCase() === emailLower)
							if (!isInvited) {
								throw new Error('Registration is invite-only. Your email is not on the invite list.')
							}
						}
						return { data: user }
					},
				},
			},
			session: {
				create: {
					after: async (session: { userId: string; [key: string]: unknown }) => {
						// Banned user logout: reject session creation for banned users
						try {
							const row = await db.select({ banned: authSchema.user.banned }).from(authSchema.user).where(eq(authSchema.user.id, session.userId)).get()
							if (row?.banned === true) {
								const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
								const revokeSessionFn = authApi.revokeSession
								if (revokeSessionFn) {
									await revokeSessionFn({ body: { token: (session as { token?: string }).token } }).catch(() => {})
								}
								throw new Error('Your account has been banned.')
							}
						} catch (err) {
							// Re-throw ban errors, swallow lookup failures
							if ((err as Error).message === 'Your account has been banned.') throw err
						}
					},
				},
			},
		},

		plugins: [
			bearer(),
			apiKey(),
			admin(),
			openAPI(),
			twoFactor({
				issuer: 'QuestPie Autopilot',
				backupCodeOptions: { amount: 10 },
				trustDeviceMaxAge: 60 * 60 * 24 * 30, // 30 days
			}),
		],
	})

	// No runMigrations() — Drizzle migrations handle all table creation now.

	return auth
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

import { container, companyRootFactory } from '../container'
import { dbFactory } from '../db'

export const authFactory = container.registerAsync('auth', async (c) => {
	const { db: dbResult, companyRoot } = await c.resolveAsync([dbFactory, companyRootFactory])
	return createAuth(dbResult.db, companyRoot)
})
