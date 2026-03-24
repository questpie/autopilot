/**
 * Better Auth instance for QUESTPIE Autopilot.
 *
 * Uses a shared bun:sqlite Database instance (the same autopilot.db used by
 * Drizzle ORM) so that all data lives in a single SQLite file.
 */
import { betterAuth } from 'better-auth'
import { bearer, admin, openAPI, twoFactor } from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import type { Database } from 'bun:sqlite'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(rawDb: Database) {
	const auth = betterAuth({
		database: rawDb,
		basePath: '/api/auth',

		emailAndPassword: { enabled: true },

		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			cookieCache: {
				enabled: true,
				maxAge: 60 * 5,
			},
		},

		advanced: {
			// Better Auth validates Origin header on mutations by default (CSRF).
			// SameSite=Strict prevents cookies from being sent on cross-origin requests.
			defaultCookieAttributes: {
				sameSite: 'strict',
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

	// Better Auth does NOT auto-create tables — we must run migrations explicitly.
	// This creates all required tables (user, session, account, verification,
	// twoFactor, apikey, etc.) if they don't already exist, and adds any missing
	// columns for plugin-provided fields.
	const ctx = await auth.$context
	await ctx.runMigrations()

	return auth
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

import { container } from '../container'
import { dbFactory } from '../db'

export const authFactory = container.registerAsync('auth', async (c) => {
	const { db } = await c.resolveAsync([dbFactory])
	return createAuth(db.raw)
})
