/**
 * Hono auth middleware — resolves every request to an Actor using the
 * existing resolveActor() pipeline, then enforces RBAC permissions and
 * writes an audit trail.
 */
import { createMiddleware } from 'hono/factory'
import { logAudit } from '../../auth/audit'
import { getRequiredPermission, resolveActor } from '../../auth/middleware'
import { checkPermission } from '../../auth/roles'
import type { AppEnv } from '../app'

/**
 * Factory that returns a Hono middleware performing:
 * 1. Actor resolution (bearer / API key)
 * 2. Permission check against the RBAC matrix
 * 3. Audit logging (denied + success)
 *
 * Paths handled *before* this middleware (/api/auth/*) are never reached here
 * because Hono short-circuits on the first matching handler.
 */
export function authMiddleware() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const path = new URL(c.req.url).pathname

		// /api/auth/* is handled by the Better Auth passthrough — skip
		if (path.startsWith('/api/auth')) {
			return next()
		}

		// Resolve actor
		const actor = await resolveActor(c.req.raw, {
			companyRoot: c.get('companyRoot'),
			auth: c.get('auth'),
		})

		c.set('actor', actor)

		// /api/status is a public health-check — allow even without an actor
		if (path === '/api/status') {
			return next()
		}

		if (!actor) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		// Permission check
		const required = getRequiredPermission(path, c.req.method)

		if (required && !checkPermission(actor, required.resource, required.action)) {
			await logAudit(c.get('companyRoot'), {
				ts: new Date().toISOString(),
				actor: actor.id,
				actor_type: actor.type,
				action: `${required.resource}.${required.action}`,
				target: path,
				source: actor.source,
				ip: actor.ip,
				result: 'denied',
			})
			return c.json({ error: 'Forbidden' }, 403)
		}

		await next()

		// Audit successful requests that required permissions
		if (required) {
			await logAudit(c.get('companyRoot'), {
				ts: new Date().toISOString(),
				actor: actor.id,
				actor_type: actor.type,
				action: `${required.resource}.${required.action}`,
				target: path,
				source: actor.source,
				ip: actor.ip,
				result: 'success',
			})
		}
	})
}
