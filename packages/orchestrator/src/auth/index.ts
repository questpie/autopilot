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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(db: AutopilotDb) {
	const auth = betterAuth({
		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema: authSchema,
		}),
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

	// No runMigrations() — Drizzle migrations handle all table creation now.

	return auth
}

export type Auth = Awaited<ReturnType<typeof createAuth>>

import { container } from '../container'
import { dbFactory } from '../db'

export const authFactory = container.registerAsync('auth', async (c) => {
	const { db: dbResult } = await c.resolveAsync([dbFactory])
	return createAuth(dbResult.db)
})
