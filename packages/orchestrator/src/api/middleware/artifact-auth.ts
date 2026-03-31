/**
 * Lightweight auth middleware for the artifact proxy (`/artifacts/*`).
 *
 * Reuses the standard actor resolution pipeline but lives outside
 * the `/api/*` auth middleware so it can later support public access
 * via share tokens or the `public` flag in `.artifact.yaml`.
 */
import { createMiddleware } from 'hono/factory'
import { resolveActor } from '../../auth/middleware'
import type { AppEnv } from '../app'

export function artifactProxyAuth() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const result = await resolveActor(c.req.raw, {
			companyRoot: c.get('companyRoot'),
			auth: c.get('auth'),
			db: c.get('db'),
		})

		// Webhook auth can return a Response directly with specific error details
		if (result instanceof Response) {
			return result
		}

		const actor = result
		c.set('actor', actor)

		if (actor) return next()

		// Future: check ?token= query param for public sharing
		// Future: check .artifact.yaml public: true flag

		return c.json({ error: 'Unauthorized' }, 401)
	})
}
