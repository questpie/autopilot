/**
 * Rate limiting middleware — sliding window via SQLite.
 *
 * Two layers:
 * - ipRateLimit(): 20 req/min by IP, BEFORE auth (protects unauthenticated endpoints)
 * - actorRateLimit(): per-actor limits AFTER auth (human 300/min, search 10/min, chat 20/min;
 *   agents 600/min general, 50/min search, 100/min chat; webhook source exempt)
 */
import { createMiddleware } from 'hono/factory'
import type { Client } from '@libsql/client'
import type { AppEnv } from '../app'
import type { AutopilotDb } from '../../db'
import { getClientIp } from './ip-allowlist'

/**
 * Check and increment rate limit counter using a weighted two-window sliding approximation.
 *
 * Estimation formula:
 *   prevCount * ((windowStart + windowSec - now) / windowSec) + currentCount
 *
 * This avoids hard resets at window boundaries without requiring schema changes.
 */
export async function checkRateLimit(
	db: AutopilotDb,
	key: string,
	windowSec: number,
	max: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
	const now = Math.floor(Date.now() / 1000)
	const windowStart = now - (now % windowSec) // Align to window boundary
	const prevWindowStart = windowStart - windowSec
	const expiresAt = windowStart + windowSec * 2 // Keep for 2 windows for cleanup

	const raw = (db as unknown as { $client: Client }).$client

	// Use a transaction for atomicity
	const tx = await raw.transaction('write')
	let result: { estimatedCount: number; currentCount: number }
	try {
		// Get previous window count for sliding window estimation
		const prevResult = await tx.execute({
			sql: `SELECT count FROM rate_limit_entries WHERE key = ? AND window_start = ?`,
			args: [key, prevWindowStart],
		})
		const prevCount = prevResult.rows[0]?.count as number | undefined ?? 0

		// Upsert current window count
		const existingResult = await tx.execute({
			sql: `SELECT id, count FROM rate_limit_entries WHERE key = ? AND window_start = ?`,
			args: [key, windowStart],
		})
		const existing = existingResult.rows[0] as { id: number; count: number } | undefined

		let currentCount: number
		if (existing) {
			currentCount = (existing.count as number) + 1
			await tx.execute({
				sql: `UPDATE rate_limit_entries SET count = ? WHERE id = ?`,
				args: [currentCount, existing.id],
			})
		} else {
			currentCount = 1
			await tx.execute({
				sql: `INSERT INTO rate_limit_entries (key, window_start, count, expires_at) VALUES (?, ?, 1, ?)`,
				args: [key, windowStart, expiresAt],
			})
		}

		// Weighted sliding window: weight previous window by its remaining overlap
		const weight = (windowStart + windowSec - now) / windowSec
		const estimatedCount = Math.floor(prevCount * weight) + currentCount

		result = { estimatedCount, currentCount }
		await tx.commit()
	} finally {
		tx.close()
	}

	const allowed = result.estimatedCount <= max
	const remaining = Math.max(0, max - result.estimatedCount)
	const resetAt = windowStart + windowSec

	return { allowed, remaining, resetAt }
}

/**
 * Convenience wrapper: 3 password reset attempts per 15-minute window.
 */
export function checkPasswordResetLimit(
	db: AutopilotDb,
	email: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
	return checkRateLimit(db, `password-reset:${email}`, 900, 3)
}

/**
 * IP-based rate limiting — 20 req/min.
 * Applied BEFORE auth middleware.
 * Exempt: /hooks/* and /api/status
 */
export function ipRateLimit() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const path = new URL(c.req.url).pathname
		const clientIp = getClientIp(c)

		// Exempt webhooks, healthcheck, and localhost in dev
		if (path.startsWith('/hooks/') || path === '/api/status') return next()
		if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') return next()

		const db = c.get('db')
		const key = `ip:${clientIp}`

		const result = await checkRateLimit(db, key, 60, 20)

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
 * Only webhook source is exempt.
 * Human limits: 300/min general, 10/min search, 20/min chat.
 * Agent limits: 600/min general, 50/min search, 100/min chat.
 */
export function actorRateLimit() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const actor = c.get('actor')

		// No actor = unauthenticated (already rate-limited by ipRateLimit)
		if (!actor) return next()

		// Only webhooks are exempt (not agents)
		if (actor.source === 'webhook') return next()

		const path = new URL(c.req.url).pathname
		const db = c.get('db')
		const isAgent = actor.type === 'agent'

		let key: string
		let max: number

		if (path.startsWith('/api/search')) {
			key = `actor:${actor.id}:/api/search`
			max = isAgent ? 50 : 10
		} else if (path.startsWith('/api/chat')) {
			key = `actor:${actor.id}:/api/chat`
			max = isAgent ? 100 : 20
		} else {
			key = `actor:${actor.id}`
			max = isAgent ? 600 : 300
		}

		const result = await checkRateLimit(db, key, 60, max)

		c.header('X-RateLimit-Limit', String(max))
		c.header('X-RateLimit-Remaining', String(result.remaining))
		c.header('X-RateLimit-Reset', String(result.resetAt))

		if (!result.allowed) {
			return c.json({ error: 'Rate limit exceeded' }, 429)
		}

		await next()
	})
}
