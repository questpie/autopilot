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

interface ArtifactAuthOptions {
	authEnabled: boolean
}

export function artifactProxyAuth(options: ArtifactAuthOptions) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const actor = await resolveActor(c.req.raw, {
			authEnabled: options.authEnabled,
			companyRoot: c.get('companyRoot'),
			auth: c.get('auth'),
		})

		c.set('actor', actor)

		if (actor) return next()

		// Future: check ?token= query param for public sharing
		// Future: check .artifact.yaml public: true flag

		if (!options.authEnabled) return next()

		return c.json({ error: 'Unauthorized' }, 401)
	})
}
