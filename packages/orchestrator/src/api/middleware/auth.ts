/**
 * Hono auth middleware — resolves every request to an Actor using the
 * existing resolveActor() pipeline, then enforces RBAC permissions and
 * writes an audit trail.
 */
import { createMiddleware } from 'hono/factory'
import { logAudit } from '../../auth/audit'
import { loadMasterKey } from '../../auth/crypto'
import { getRequiredPermission, resolveActor } from '../../auth/middleware'
import { checkPermission } from '../../auth/roles'
import type { AppEnv } from '../app'

/** Cached master key — loaded once on first use. */
let _masterKey: CryptoKey | null = null

/**
 * Factory that returns a Hono middleware performing:
 * 1. Actor resolution (bearer / API key)
 * 2. Permission check against the RBAC matrix
 * 3. Audit logging (denied + success)
 *
 * Public routes (/api/auth/*, /api/status, /api/settings/deployment-mode)
 * are mounted before this middleware in app.ts, so they are handled by Hono
 * before this middleware runs — no hardcoded path exceptions needed here.
 */
export function authMiddleware() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const path = new URL(c.req.url).pathname

		// Resolve actor
		const result = await resolveActor(c.req.raw, {
			companyRoot: c.get('companyRoot'),
			auth: c.get('auth'),
		})

		// Webhook auth can return a Response directly with specific error details
		if (result instanceof Response) {
			return result
		}

		const actor = result
		c.set('actor', actor)

		if (!actor) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		// Lazy-load master key for audit encryption
		const companyRoot = c.get('companyRoot')
		if (!_masterKey) {
			_masterKey = await loadMasterKey(companyRoot)
		}

		// Permission check
		const required = getRequiredPermission(path, c.req.method)

		if (required && !checkPermission(actor, required.resource, required.action)) {
			await logAudit(companyRoot, {
				ts: new Date().toISOString(),
				actor: actor.id,
				actor_type: actor.type,
				action: `${required.resource}.${required.action}`,
				target: path,
				source: actor.source,
				ip: actor.ip,
				result: 'denied',
			}, _masterKey)
			return c.json({ error: 'Forbidden' }, 403)
		}

		await next()

		// Audit successful requests that required permissions
		if (required) {
			await logAudit(companyRoot, {
				ts: new Date().toISOString(),
				actor: actor.id,
				actor_type: actor.type,
				action: `${required.resource}.${required.action}`,
				target: path,
				source: actor.source,
				ip: actor.ip,
				result: 'success',
			}, _masterKey)
		}
	})
}
