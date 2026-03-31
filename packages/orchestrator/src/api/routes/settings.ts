import { join } from 'node:path'
/**
 * Settings API — read and write company configuration + provider management.
 *
 * GET    /settings                    → returns company.yaml as JSON
 * PATCH  /settings                    → merges JSON body into company.yaml, saves
 * GET    /settings/providers          → returns provider status (configured/model) without keys
 * POST   /settings/providers/:provider → saves API key to encrypted company secrets
 * DELETE /settings/providers/:provider → removes provider secret + company reference
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { container } from '../../container'
import { getEnv } from '../../env'
import { eventBus } from '../../events/event-bus'
import { fileExists, readYamlUnsafe, writeYaml } from '../../fs/yaml'
import { deleteSecret, listSecrets, readSecretRecord, writeSecret } from '../../secrets/store'
import type { AppEnv } from '../app'

// ── Schemas ─────────────────────────────────────────────────────────────────

const SettingsResponseSchema = z.object({
	settings: z.record(z.string(), z.unknown()),
})

const DeploymentModeResponseSchema = z.object({
	mode: z.enum(['selfhosted', 'cloud']),
})
type DeploymentMode = z.infer<typeof DeploymentModeResponseSchema>['mode']

const SettingsPatchSchema = z.record(z.string(), z.unknown())

const ProviderStatusSchema = z.object({
	configured: z.boolean(),
	model: z.string().optional(),
})

const ProvidersResponseSchema = z.object({
	openrouter: ProviderStatusSchema,
	gemini: ProviderStatusSchema,
})

const SaveProviderKeySchema = z.object({
	apiKey: z.string().min(1, 'API key is required'),
})

const SecretMetadataSchema = z.object({
	name: z.string(),
	service: z.string(),
	type: z.string(),
	created_at: z.string(),
	created_by: z.string(),
	allowed_agents: z.array(z.string()),
	usage: z.string(),
	encrypted: z.boolean(),
	hasValue: z.boolean(),
})

const CreateSecretSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers, and hyphens only'),
	value: z.string().min(1, 'Secret value is required'),
	type: z.string().default('api_token'),
	allowed_agents: z.array(z.string()).default([]),
	usage: z.string().default(''),
})

const ProviderParamSchema = z.object({
	provider: z.enum(['openrouter', 'gemini']),
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

/** Map provider name to its default model. */
const PROVIDER_MODEL_MAP: Record<string, string> = {
	openrouter: 'anthropic/claude-sonnet-4',
	gemini: 'gemini-2.0-flash',
}

/** Key format validation patterns. */
const KEY_PATTERNS: Record<string, RegExp> = {
	openrouter: /^sk-or-/,
	gemini: /^AI/,
}

function providerSecretName(provider: string): string {
	return `provider-${provider}`
}

async function updateCompanyProviderSettings(
	root: string,
	provider: string,
	secretRef?: string,
): Promise<void> {
	const companyPath = join(root, 'company.yaml')
	let existing: Record<string, unknown> = {}
	if (await fileExists(companyPath)) {
		const data = await readYamlUnsafe(companyPath)
		if (data && typeof data === 'object') existing = data as Record<string, unknown>
	}

	const settings = (existing.settings as Record<string, unknown> | undefined) ?? {}
	const currentAiProvider = (settings.ai_provider as Record<string, unknown> | undefined) ?? {}
	const nextAiProvider = secretRef
		? {
				...currentAiProvider,
				provider,
				secret_ref: secretRef,
				default_model:
					typeof currentAiProvider.default_model === 'string'
						? currentAiProvider.default_model
						: PROVIDER_MODEL_MAP[provider],
			}
		: undefined
	const { ai_provider: _unusedAiProvider, ...settingsWithoutAiProvider } = settings
	const nextSettings = nextAiProvider
		? { ...settingsWithoutAiProvider, ai_provider: nextAiProvider }
		: settingsWithoutAiProvider

	const merged = {
		...existing,
		settings: nextSettings,
	}

	await writeYaml(companyPath, merged)
}

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * Public settings route — deployment mode only, no auth required.
 * Mounted before auth middleware in app.ts.
 */
const settingsPublic = new Hono<AppEnv>().get(
	'/deployment-mode',
	describeRoute({
		tags: ['settings'],
		description: 'Return the current deployment mode (selfhosted or cloud)',
		responses: {
			200: {
				description: 'Deployment mode',
				content: { 'application/json': { schema: resolver(DeploymentModeResponseSchema) } },
			},
		},
	}),
	(c) => {
		const mode: DeploymentMode = getEnv().DEPLOYMENT_MODE
		return c.json({ mode }, 200)
	},
)

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
	.get(
		'/secrets',
		describeRoute({
			tags: ['settings'],
			description: 'List company secrets metadata (values are never returned)',
			responses: {
				200: {
					description: 'Secrets metadata',
					content: { 'application/json': { schema: resolver(z.array(SecretMetadataSchema)) } },
				},
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			return c.json(await listSecrets(root), 200)
		},
	)
	.post(
		'/secrets',
		describeRoute({
			tags: ['settings'],
			description: 'Create or replace an encrypted company secret',
			responses: {
				200: {
					description: 'Secret saved',
					content: {
						'application/json': {
							schema: resolver(z.object({ ok: z.literal(true), secret: SecretMetadataSchema })),
						},
					},
				},
			},
		}),
		zValidator('json', CreateSecretSchema),
		async (c) => {
			const actor = c.get('actor')
			const root = c.get('companyRoot')
			const body = c.req.valid('json')
			const secret = await writeSecret(root, {
				name: body.name,
				value: body.value,
				type: body.type,
				createdBy: actor?.id ?? 'system',
				allowedAgents: body.allowed_agents,
				usage: body.usage,
			})
			eventBus.emit({ type: 'settings_changed' })
			return c.json({ ok: true as const, secret }, 200)
		},
	)
	.delete(
		'/secrets/:name',
		describeRoute({
			tags: ['settings'],
			description: 'Delete an encrypted company secret',
			responses: {
				200: { description: 'Secret deleted' },
				404: { description: 'Secret not found' },
			},
		}),
		zValidator('param', z.object({ name: z.string() })),
		async (c) => {
			const root = c.get('companyRoot')
			const { name } = c.req.valid('param')
			const deleted = await deleteSecret(root, name)
			if (!deleted) return c.json({ error: 'secret not found' }, 404)
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
			const root = c.get('companyRoot')
			const env = getEnv()
			const companyPath = join(root, 'company.yaml')
			const company = (await fileExists(companyPath))
				? ((await readYamlUnsafe(companyPath)) as Record<string, unknown>)
				: {}
			const settings = (company.settings as Record<string, unknown> | undefined) ?? {}
			const aiProvider = (settings.ai_provider as Record<string, unknown> | undefined) ?? {}
			const result: Record<string, { configured: boolean; model?: string }> = {}

			for (const provider of Object.keys(PROVIDER_MODEL_MAP)) {
				const secretRef =
					typeof aiProvider.secret_ref === 'string' && aiProvider.provider === provider
						? aiProvider.secret_ref
						: undefined
				const secret = secretRef ? await readSecretRecord(root, secretRef).catch(() => null) : null
				const fallbackKey = provider === 'openrouter' ? env.OPENROUTER_API_KEY : undefined
				const key = secret?.value ?? fallbackKey
				result[provider] = {
					configured: !!key && key.length > 0,
					model: key
						? typeof aiProvider.default_model === 'string'
							? aiProvider.default_model
							: PROVIDER_MODEL_MAP[provider]
						: undefined,
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
			const actor = c.get('actor')
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

			const root = c.get('companyRoot')
			const secretRef = providerSecretName(provider)
			await writeSecret(root, {
				name: secretRef,
				value: apiKey,
				type: 'api_token',
				createdBy: actor?.id ?? 'system',
				allowedAgents: [],
				usage: `provider.${provider}`,
			})
			await updateCompanyProviderSettings(root, provider, secretRef)
			container.clearInstance('aiProvider')
			container.clearInstance('embeddingService')

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
			const root = c.get('companyRoot')
			await deleteSecret(root, providerSecretName(provider))
			await updateCompanyProviderSettings(root, provider)
			container.clearInstance('aiProvider')
			container.clearInstance('embeddingService')

			eventBus.emit({ type: 'settings_changed' })

			return c.json({ ok: true as const }, 200)
		},
	)

export { settings, settingsPublic }
