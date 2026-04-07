/**
 * Shared secrets API routes.
 *
 * POST   /api/secrets       — set (create or update) a shared secret
 * GET    /api/secrets       — list all shared secrets (metadata only)
 * DELETE /api/secrets/:name — delete a shared secret
 *
 * All routes require user auth (operator surface).
 * Values are never returned in list/get responses.
 */
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { SharedSecretInputSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'
import { hasMasterKey } from '../../crypto'

const secrets = new Hono<AppEnv>()
	// GET /secrets — list all shared secrets (metadata only)
	.get('/', async (c) => {
		const { secretService } = c.get('services')
		const list = await secretService.list()
		return c.json(list, 200)
	})
	// POST /secrets — set (create or update) a shared secret
	.post('/', zValidator('json', SharedSecretInputSchema), async (c) => {
		if (!hasMasterKey()) {
			return c.json(
				{ error: 'AUTOPILOT_MASTER_KEY is not configured. Cannot store shared secrets.' },
				503,
			)
		}

		const { secretService } = c.get('services')
		const body = c.req.valid('json')
		const metadata = await secretService.set(body)
		return c.json(metadata, 200)
	})
	// DELETE /secrets/:name — delete a shared secret
	.delete('/:name', async (c) => {
		const { secretService } = c.get('services')
		const name = c.req.param('name')
		const deleted = await secretService.delete(name)
		if (!deleted) {
			return c.json({ error: `Secret "${name}" not found` }, 404)
		}
		return c.json({ ok: true, deleted: name }, 200)
	})

export { secrets }
