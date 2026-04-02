/**
 * Settings API — read and write company configuration.
 *
 * GET    /settings               → returns company.yaml as JSON
 * PATCH  /settings               → merges JSON body into company.yaml, saves
 * GET    /settings/deployment-mode → public, returns NODE_ENV
 */
import { join } from 'node:path'
import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { getEnv } from '../../env'
import { eventBus } from '../../events/event-bus'
import { fileExists, readYamlUnsafe, writeYaml } from '../../fs/yaml'
import type { AppEnv } from '../app'

// ── Schemas ─────────────────────────────────────────────────────────────────

const SettingsPatchSchema = z.record(z.string(), z.unknown())

// ── Helpers ─────────────────────────────────────────────────────────────────

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** Deep merge two objects, recursing into nested plain objects. */
function deepMerge(
	target: Record<string, unknown>,
	source: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...target }
	for (const key of Object.keys(source)) {
		if (UNSAFE_KEYS.has(key)) continue
		const tVal = target[key]
		const sVal = source[key]
		if (
			tVal &&
			sVal &&
			typeof tVal === 'object' &&
			typeof sVal === 'object' &&
			!Array.isArray(tVal) &&
			!Array.isArray(sVal)
		) {
			result[key] = deepMerge(tVal as Record<string, unknown>, sVal as Record<string, unknown>)
		} else {
			result[key] = sVal
		}
	}
	return result
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * Public settings route — no auth required.
 * Mounted before auth middleware in app.ts.
 */
const settingsPublic = new Hono<AppEnv>().get('/deployment-mode', (c) => {
	const env = getEnv()
	return c.json({ mode: env.NODE_ENV === 'production' ? 'production' : 'development' }, 200)
})

const settings = new Hono<AppEnv>()
	// ── GET /settings — read company config as JSON ──────────────────
	.get('/', async (c) => {
		const root = c.get('companyRoot')
		const companyPath = join(root, 'company.yaml')

		if (!(await fileExists(companyPath))) {
			return c.json({ settings: {} }, 200)
		}

		const data = await readYamlUnsafe(companyPath)
		return c.json({ settings: (data as Record<string, unknown>) ?? {} }, 200)
	})
	// ── PATCH /settings — deep merge partial update into company config ───
	.patch(
		'/',
		zValidator('json', SettingsPatchSchema),
		async (c) => {
			const root = c.get('companyRoot')
			const companyPath = join(root, 'company.yaml')
			const body = c.req.valid('json')

			let existing: Record<string, unknown> = {}
			if (await fileExists(companyPath)) {
				const data = await readYamlUnsafe(companyPath)
				if (data && typeof data === 'object') {
					existing = data as Record<string, unknown>
				}
			}

			const merged = deepMerge(existing, body)
			await writeYaml(companyPath, merged)

			eventBus.emit({ type: 'settings_changed' })

			return c.json({ ok: true as const }, 200)
		},
	)

export { settings, settingsPublic }
