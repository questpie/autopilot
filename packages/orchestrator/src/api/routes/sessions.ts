/**
 * Session management routes — list, revoke individual, and revoke all sessions.
 */
import { Hono } from 'hono'
import type { AppEnv } from '../app'

const sessions = new Hono<AppEnv>()
	// GET /api/sessions — list active sessions for current user
	.get('/', async (c) => {
		const actor = c.get('actor')
		if (!actor) return c.json({ error: 'Unauthorized' }, 401)

		const auth = c.get('auth')
		try {
			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const listFn = authApi.listSessions ?? authApi.listUserSessions
			if (!listFn) return c.json({ error: 'Session listing not available' }, 501)

			const result = await listFn({ headers: c.req.raw.headers }) as unknown[]
			return c.json(result ?? [])
		} catch {
			return c.json({ error: 'Failed to list sessions' }, 500)
		}
	})
	// DELETE /api/sessions/:id — revoke a specific session
	.delete('/:id', async (c) => {
		const actor = c.get('actor')
		if (!actor) return c.json({ error: 'Unauthorized' }, 401)

		const sessionId = c.req.param('id')
		const auth = c.get('auth')

		try {
			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const revokeFn = authApi.revokeSession ?? authApi.revokeUserSession
			if (!revokeFn) return c.json({ error: 'Session revocation not available' }, 501)

			await revokeFn({ body: { sessionId } })
			return c.json({ ok: true })
		} catch {
			return c.json({ error: 'Failed to revoke session' }, 500)
		}
	})
	// DELETE /api/sessions — revoke all sessions for current user
	.delete('/', async (c) => {
		const actor = c.get('actor')
		if (!actor) return c.json({ error: 'Unauthorized' }, 401)

		const auth = c.get('auth')

		try {
			const authApi = auth.api as Record<string, ((args: unknown) => Promise<unknown>) | undefined>
			const revokeAllFn = authApi.revokeSessions ?? authApi.revokeAllUserSessions
			if (!revokeAllFn) return c.json({ error: 'Session revocation not available' }, 501)

			await revokeAllFn({ headers: c.req.raw.headers })
			return c.json({ ok: true })
		} catch {
			return c.json({ error: 'Failed to revoke sessions' }, 500)
		}
	})

export { sessions }
