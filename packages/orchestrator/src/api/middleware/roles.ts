/**
 * Role guards for API routes.
 *
 * Product role model: owner | admin | member | viewer.
 *
 * Mutation surfaces (config registry, user management, invites, etc.) require
 * owner or admin. Read surfaces remain authenticated-only.
 */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'

export function isOwnerOrAdmin(role: string | null | undefined): boolean {
	return role === 'owner' || role === 'admin'
}

/**
 * Hono middleware that enforces owner-or-admin actor.
 * Assumes an upstream auth middleware has already populated `actor`.
 * Returns 401 if there is no actor at all (auth middleware was skipped),
 * 403 if the actor is present but lacks the role.
 */
export function requireOwnerOrAdmin() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const actor = c.get('actor')
		if (!actor) return c.json({ error: 'Unauthorized' }, 401)
		if (!isOwnerOrAdmin(actor.role)) return c.json({ error: 'Forbidden' }, 403)
		return next()
	})
}
