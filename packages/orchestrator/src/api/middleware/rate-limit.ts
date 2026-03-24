/**
 * Rate limiting middleware — sliding window via SQLite.
 *
 * Two layers:
 * - ipRateLimit(): 20 req/min by IP, BEFORE auth (protects unauthenticated endpoints)
 * - actorRateLimit(): per-actor limits AFTER auth (human 300/min, search 10/min, chat 20/min, agents exempt)
 */
import { createMiddleware } from 'hono/factory'
import type { Database } from 'bun:sqlite'
import type { AppEnv } from '../app'
import type { AutopilotDb } from '../../db'
import { getClientIp } from './ip-allowlist'

/**
 * Check and increment rate limit counter using atomic SQLite transactions.
 * Uses SELECT + INSERT/UPDATE inside a transaction for atomicity.
 */
export function checkRateLimit(
	db: AutopilotDb,
	key: string,
	windowSec: number,
	max: number,
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Math.floor(Date.now() / 1000)
	const windowStart = now - (now % windowSec) // Align to window boundary
	const expiresAt = windowStart + windowSec * 2 // Keep for 2 windows for cleanup

	const raw = (db as unknown as { $client: Database }).$client

	// Use a transaction for atomicity
	const count = raw.transaction(() => {
		const existing = raw
			.prepare(`SELECT id, count FROM rate_limit_entries WHERE key = ? AND window_start = ?`)
			.get(key, windowStart) as { id: number; count: number } | null

		if (existing) {
			const newCount = existing.count + 1
			raw.prepare(`UPDATE rate_limit_entries SET count = ? WHERE id = ?`).run(
				newCount,
				existing.id,
			)
			return newCount
		}

		raw.prepare(
			`INSERT INTO rate_limit_entries (key, window_start, count, expires_at) VALUES (?, ?, 1, ?)`,
		).run(key, windowStart, expiresAt)
		return 1
	})()

	const allowed = count <= max
	const remaining = Math.max(0, max - count)
	const resetAt = windowStart + windowSec

	return { allowed, remaining, resetAt }
}

/**
 * IP-based rate limiting — 20 req/min.
 * Applied BEFORE auth middleware.
 * Exempt: /hooks/* and /api/status
 */
export function ipRateLimit() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const path = new URL(c.req.url).pathname

		// Exempt webhooks and healthcheck
		if (path.startsWith('/hooks/') || path === '/api/status') return next()

		const db = c.get('db')
		const clientIp = getClientIp(c)
		const key = `ip:${clientIp}`

		const result = checkRateLimit(db, key, 60, 20)

		// Always set headers
		c.header('X-RateLimit-Limit', '20')
		c.header('X-RateLimit-Remaining', String(result.remaining))
		c.header('X-RateLimit-Reset', String(result.resetAt))

		if (!result.allowed) {
			return c.json({ error: 'Rate limit exceeded' }, 429)
		}

		await next()
	})
}

/**
 * Actor-based rate limiting — applied AFTER auth middleware.
 * Agents and webhooks are exempt.
 * Human limits: 300/min general, 10/min search, 20/min chat.
 */
export function actorRateLimit() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const actor = c.get('actor')

		// No actor = unauthenticated (already rate-limited by ipRateLimit)
		if (!actor) return next()

		// Agents and webhooks are exempt
		if (actor.type === 'agent' || actor.source === 'webhook') return next()

		const path = new URL(c.req.url).pathname
		const db = c.get('db')

		let key: string
		let max: number

		if (path.startsWith('/api/search')) {
			key = `actor:${actor.id}:/api/search`
			max = 10
		} else if (path.startsWith('/api/chat')) {
			key = `actor:${actor.id}:/api/chat`
			max = 20
		} else {
			key = `actor:${actor.id}`
			max = 300
		}

		const result = checkRateLimit(db, key, 60, max)

		c.header('X-RateLimit-Limit', String(max))
		c.header('X-RateLimit-Remaining', String(result.remaining))
		c.header('X-RateLimit-Reset', String(result.resetAt))

		if (!result.allowed) {
			return c.json({ error: 'Rate limit exceeded' }, 429)
		}

		await next()
	})
}
