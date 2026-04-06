import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { bearer } from 'better-auth/plugins'
import { eq, sql } from 'drizzle-orm'
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

async function getUserCount(db: CompanyDb): Promise<number> {
	const row = await db.select({ count: sql<number>`count(*)` }).from(authSchema.user).get()
	return Number(row?.count ?? 0)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(db: CompanyDb, _companyRoot: string, mail?: MailService) {
	const mailService = mail ?? createMailService()

	const authBaseUrl = process.env.BETTER_AUTH_URL ?? env.ORCHESTRATOR_URL ?? 'http://localhost:7778'
	if (!process.env.BETTER_AUTH_URL && !env.ORCHESTRATOR_URL && env.NODE_ENV === 'production') {
		console.warn('[auth] ⚠ Neither BETTER_AUTH_URL nor ORCHESTRATOR_URL set in production — auth links (email verification) will point to localhost')
	}

	const auth = betterAuth({
		baseURL: authBaseUrl,
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

						// First user is always owner
						if (userCount === 0) {
							return {
								data: {
									...user,
									email: emailLower,
									role: 'owner',
								},
							}
						}

						// Subsequent users default to member
						return {
							data: {
								...user,
								email: emailLower,
								role: 'member',
							},
						}
					},
				},
			},
		},

		plugins: [bearer(), apiKey()],
	})

	return auth
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
