import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
/**
 * Better Auth instance for QUESTPIE Autopilot.
 *
 * Uses the Drizzle adapter so that all tables are managed by Drizzle
 * migrations — no more Kysely internal migrations.
 */
import { betterAuth } from 'better-auth'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { admin, bearer, openAPI, twoFactor } from 'better-auth/plugins'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type { CompanyDb } from '../db'
import * as authSchema from '../db/auth-schema'
import { env } from '../env'
/** Minimal mail service interface for email verification. */
interface MailService {
	send(opts: { to: string; subject: string; html: string }): Promise<void>
}

/** No-op mail service — logs emails to console in dev. */
function createMailService(): MailService {
	return {
		async send(opts) {
			console.log(`[mail] would send to ${opts.to}: ${opts.subject}`)
		},
	}
}

const PASSWORD_COMPLEXITY_RE = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/

function validatePasswordComplexity(password: string): void {
	if (!PASSWORD_COMPLEXITY_RE.test(password)) {
		throw new Error(
			'Password must be at least 12 characters and include at least one digit and one special character.',
		)
	}
}

async function getUserCount(db: CompanyDb): Promise<number> {
	const row = await db.select({ count: sql<number>`count(*)` }).from(authSchema.user).get()
	return Number(row?.count ?? 0)
}

async function getActiveInvite(db: CompanyDb, email: string) {
	const normalizedEmail = email.trim().toLowerCase()
	const now = new Date()

	return db
		.select()
		.from(authSchema.invite)
		.where(
			and(
				eq(authSchema.invite.email, normalizedEmail),
				isNull(authSchema.invite.acceptedAt),
				or(isNull(authSchema.invite.expiresAt), gt(authSchema.invite.expiresAt, now)),
			),
		)
		.get()
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(db: CompanyDb, _companyRoot: string, mail?: MailService) {
	const mailService = mail ?? createMailService()

	const auth = betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: authSchema,
		}),
		basePath: '/api/auth',

		emailVerification: {
			sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
				void mailService.send({
					to: user.email,
					subject: 'Verify your email — QUESTPIE Autopilot',
					html: `<p>Click the link below to verify your email:</p><p><a href="${url}">${url}</a></p>`,
				})
			},
			sendOnSignUp: true,
		},

		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
			requireEmailVerification: true,
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

		trustedOrigins: (env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3001')
			.split(',')
			.map((o: string) => o.trim()),
		advanced: {
			defaultCookieAttributes: {
				sameSite: 'lax',
				secure: env.NODE_ENV === 'production',
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
						const emailLower = user.email.toLowerCase()
						const userCount = await getUserCount(db)

						if (userCount === 0) {
							return {
								data: {
									...user,
									email: emailLower,
									role: 'owner',
								},
							}
						}

						const invite = await getActiveInvite(db, emailLower)
						if (!invite) {
							throw new Error('Registration is invite-only. Your email is not on the invite list.')
						}

						return {
							data: {
								...user,
								email: emailLower,
								role: invite.role,
							},
						}
					},
				},
			},
			session: {
				create: {
					after: async (session: { userId: string; [key: string]: unknown }) => {
						try {
							const currentUser = await db
								.select({
									email: authSchema.user.email,
									banned: authSchema.user.banned,
								})
								.from(authSchema.user)
								.where(eq(authSchema.user.id, session.userId))
								.get()

							if (currentUser?.email) {
								await db
									.update(authSchema.invite)
									.set({
										acceptedAt: new Date(),
										updatedAt: new Date(),
									})
									.where(
										and(
											eq(authSchema.invite.email, currentUser.email.toLowerCase()),
											isNull(authSchema.invite.acceptedAt),
										),
									)
							}

							// Banned user logout: reject session creation for banned users
							if (currentUser?.banned === true) {
								const authApi = auth.api as Record<
									string,
									((args: unknown) => Promise<unknown>) | undefined
								>
								const revokeSessionFn = authApi.revokeSession
								if (revokeSessionFn) {
									await revokeSessionFn({
										body: { token: (session as { token?: string }).token },
									}).catch(() => {})
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
				issuer: 'QUESTPIE Autopilot',
				backupCodeOptions: { amount: 10 },
				trustDeviceMaxAge: 60 * 60 * 24 * 30, // 30 days
			}),
		],
	})

	// No runMigrations() — Drizzle migrations handle all table creation now.

	return auth
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

