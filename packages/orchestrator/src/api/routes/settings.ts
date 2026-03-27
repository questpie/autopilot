/**
 * Settings API — read and write company configuration + provider management.
 *
 * GET    /settings                    → returns company.yaml as JSON
 * PATCH  /settings                    → merges JSON body into company.yaml, saves
 * GET    /settings/providers          → returns provider status (configured/model) without keys
 * POST   /settings/providers/:provider → saves API key to .env
 * DELETE /settings/providers/:provider → removes API key from .env
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { join, resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { readYamlUnsafe, fileExists, writeYaml } from '../../fs/yaml'
import { eventBus } from '../../events/event-bus'
import type { AppEnv } from '../app'

// ── Schemas ─────────────────────────────────────────────────────────────────

const SettingsResponseSchema = z.object({
	settings: z.record(z.string(), z.unknown()),
})

const SettingsPatchSchema = z.record(z.string(), z.unknown())

const ProviderStatusSchema = z.object({
	configured: z.boolean(),
	model: z.string().optional(),
})

const ProvidersResponseSchema = z.object({
	claude: ProviderStatusSchema,
	openai: ProviderStatusSchema,
	gemini: ProviderStatusSchema,
})

const SaveProviderKeySchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
})

const ProviderParamSchema = z.object({
	provider: z.enum(['claude', 'openai', 'gemini']),
})

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
			tVal && sVal &&
			typeof tVal === 'object' && typeof sVal === 'object' &&
			!Array.isArray(tVal) && !Array.isArray(sVal)
		) {
			result[key] = deepMerge(
				tVal as Record<string, unknown>,
				sVal as Record<string, unknown>,
			)
		} else {
			result[key] = sVal
		}
	}
	return result
}

/** Map provider name to its .env variable name. */
const PROVIDER_ENV_MAP: Record<string, string> = {
	claude: 'ANTHROPIC_API_KEY',
	openai: 'OPENAI_API_KEY',
	gemini: 'GOOGLE_AI_API_KEY',
}

/** Map provider name to its default model. */
const PROVIDER_MODEL_MAP: Record<string, string> = {
	claude: 'claude-sonnet-4-20250514',
	openai: 'gpt-4o',
	gemini: 'gemini-2.0-flash',
}

/** Key format validation patterns. */
const KEY_PATTERNS: Record<string, RegExp> = {
	claude: /^sk-ant-/,
	openai: /^sk-/,
	gemini: /^AI/,
}

/** Resolve the .env file path (project root). */
function envFilePath(): string {
	// Walk up from this file to find the monorepo root (where .env lives)
	return resolve(__dirname, '..', '..', '..', '..', '..', '.env')
}

/** Parse a .env file into key-value pairs (preserving comments and order). */
async function readEnvFile(path: string): Promise<string> {
	try {
		return await readFile(path, 'utf-8')
	} catch {
		return ''
	}
}

/** Set a key in the .env content string. Adds it if missing, updates if present. */
function setEnvVar(content: string, key: string, value: string): string {
	const lines = content.split('\n')
	const pattern = new RegExp(`^#?\\s*${key}\\s*=`)
	const idx = lines.findIndex((l) => pattern.test(l))

	if (idx >= 0) {
		lines[idx] = `${key}=${value}`
	} else {
		// Append at end
		lines.push(`${key}=${value}`)
	}

	return lines.join('\n')
}

/** Remove a key from the .env content string (comment it out). */
function removeEnvVar(content: string, key: string): string {
	const lines = content.split('\n')
	const pattern = new RegExp(`^\\s*${key}\\s*=`)
	return lines.map((l) => pattern.test(l) ? `# ${key}=` : l).join('\n')
}

// ── Routes ──────────────────────────────────────────────────────────────────

const settings = new Hono<AppEnv>()
	// ── GET /settings — read company config as JSON ──────────────────
	.get(
		'/',
		describeRoute({
			tags: ['settings'],
			description: 'Read company.yaml as JSON',
			responses: {
				200: {
					description: 'Company settings',
					content: { 'application/json': { schema: resolver(SettingsResponseSchema) } },
				},
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const companyPath = join(root, 'company.yaml')

			if (!(await fileExists(companyPath))) {
				return c.json({ settings: {} }, 200)
			}

			const data = await readYamlUnsafe(companyPath)
			return c.json({ settings: (data as Record<string, unknown>) ?? {} }, 200)
		},
	)
	// ── PATCH /settings — deep merge partial update into company config ───
	.patch(
		'/',
		describeRoute({
			tags: ['settings'],
			description: 'Deep merge partial update into company.yaml',
			responses: {
				200: {
					description: 'Settings updated',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
			},
		}),
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
	// ── GET /settings/providers — provider status ────────────────────
	.get(
		'/providers',
		describeRoute({
			tags: ['settings'],
			description: 'Return provider configuration status without exposing API keys',
			responses: {
				200: {
					description: 'Provider statuses',
					content: { 'application/json': { schema: resolver(ProvidersResponseSchema) } },
				},
			},
		}),
		async (c) => {
			const result: Record<string, { configured: boolean; model?: string }> = {}

			for (const [provider, envVar] of Object.entries(PROVIDER_ENV_MAP)) {
				const key = process.env[envVar]
				result[provider] = {
					configured: !!key && key.length > 0,
					model: key ? PROVIDER_MODEL_MAP[provider] : undefined,
				}
			}

			return c.json(result, 200)
		},
	)
	// ── POST /settings/providers/:provider — save API key ────────────
	.post(
		'/providers/:provider',
		describeRoute({
			tags: ['settings'],
			description: 'Save an API key for a provider to the .env file',
			responses: {
				200: {
					description: 'Key saved',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
				400: { description: 'Invalid key format' },
			},
		}),
		zValidator('param', ProviderParamSchema),
		zValidator('json', SaveProviderKeySchema),
		async (c) => {
			const { provider } = c.req.valid('param')
			const { apiKey } = c.req.valid('json')

			// Validate key format
			const pattern = KEY_PATTERNS[provider]
			if (pattern && !pattern.test(apiKey)) {
				return c.json(
					{ error: `Invalid API key format for ${provider}. Expected prefix: ${pattern.source}` },
					400,
				)
			}

			const envVar = PROVIDER_ENV_MAP[provider]!
			const envPath = envFilePath()
			const content = await readEnvFile(envPath)
			const updated = setEnvVar(content, envVar, apiKey)
			await writeFile(envPath, updated, 'utf-8')

			// Update process.env so GET reflects immediately
			process.env[envVar] = apiKey

			eventBus.emit({ type: 'settings_changed' })

			return c.json({ ok: true as const }, 200)
		},
	)
	// ── DELETE /settings/providers/:provider — remove API key ─────────
	.delete(
		'/providers/:provider',
		describeRoute({
			tags: ['settings'],
			description: 'Remove an API key for a provider',
			responses: {
				200: {
					description: 'Key removed',
					content: { 'application/json': { schema: resolver(z.object({ ok: z.literal(true) })) } },
				},
			},
		}),
		zValidator('param', ProviderParamSchema),
		async (c) => {
			const { provider } = c.req.valid('param')
			const envVar = PROVIDER_ENV_MAP[provider]!
			const envPath = envFilePath()
			const content = await readEnvFile(envPath)
			const updated = removeEnvVar(content, envVar)
			await writeFile(envPath, updated, 'utf-8')

			// Clear from process.env
			delete process.env[envVar]

			eventBus.emit({ type: 'settings_changed' })

			return c.json({ ok: true as const }, 200)
		},
	)

export { settings }
