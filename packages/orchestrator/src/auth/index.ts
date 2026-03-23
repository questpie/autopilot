/**
 * Better Auth instance for QUESTPIE Autopilot.
 *
 * Uses bun:sqlite as the database adapter. Roles are loaded from
 * team/roles.yaml (YAML-driven, not hardcoded).
 */
import { betterAuth } from 'better-auth'
import { bearer, admin } from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import { Database } from 'bun:sqlite'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createAuth(companyRoot: string): Promise<{
	handler: (request: Request) => Promise<Response> | Response
	api: Record<string, unknown>
}> {
	const authDir = join(companyRoot, '.auth')
	await mkdir(authDir, { recursive: true })
	const dbPath = join(authDir, 'auth.db')
	const db = new Database(dbPath)

	return betterAuth({
		database: db,
		basePath: '/api/auth',

		emailAndPassword: { enabled: true },

		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
		},

		rateLimit: {
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
		],
	})
}

export type Auth = Awaited<ReturnType<typeof createAuth>>
