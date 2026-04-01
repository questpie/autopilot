import { basename } from 'node:path'
import { companyRootFactory, container } from '../container'
import { getEnv } from '../env'
import { loadCompany } from '../fs'
import { logger } from '../logger'
import { readSecretRecord } from '../secrets/store'
import { OpenRouterAIProvider } from './openrouter-provider'
import type { AIProvider } from './provider'

export type { AIProvider, CompleteOptions, ClassifyOptions, WebSearchResult } from './provider'
export { OpenRouterAIProvider } from './openrouter-provider'
export type { OpenRouterConfig } from './openrouter-provider'

/**
 * Create AIProvider based on company config + env vars.
 *
 * Priority:
 * 1. DEPLOYMENT_MODE=cloud → chatBaseUrl from QUESTPIE_AI_PROXY_URL, apiKey from QUESTPIE_AI_PROXY_TOKEN
 * 2. company.yaml settings.ai_provider config
 * 3. Default: OpenRouter with OPENROUTER_API_KEY
 */
export function createAIProvider(companySettings?: Record<string, unknown>): AIProvider {
	const env = getEnv()
	const deploymentMode = env.DEPLOYMENT_MODE

	if (deploymentMode === 'cloud') {
		return new OpenRouterAIProvider({
			chatBaseUrl: env.QUESTPIE_AI_PROXY_URL,
			apiKey: env.QUESTPIE_AI_PROXY_TOKEN,
			// Embeddings still go directly to OpenRouter (proxy doesn't support them in MVP)
			embeddingsBaseUrl: 'https://openrouter.ai/api/v1',
		})
	}

	// Self-hosted: config from company.yaml or default
	const providerConfig = companySettings?.ai_provider as Record<string, unknown> | undefined
	return new OpenRouterAIProvider({
		chatBaseUrl: providerConfig?.base_url as string | undefined,
		apiKey: (providerConfig?.api_key as string | undefined) ?? env.OPENROUTER_API_KEY,
		utilityModel: providerConfig?.utility_model as string | undefined,
		defaultModel: providerConfig?.default_model as string | undefined,
	})
}

export async function createAIProviderForCompany(
	companyRoot: string,
	companySettings?: Record<string, unknown>,
): Promise<AIProvider> {
	const env = getEnv()
	if (env.DEPLOYMENT_MODE === 'cloud') {
		return createAIProvider(companySettings)
	}

	const providerConfig = companySettings?.ai_provider as Record<string, unknown> | undefined
	const secretRef =
		typeof providerConfig?.secret_ref === 'string' ? providerConfig.secret_ref : undefined
	let apiKey: string | undefined
	let source: 'company-secret' | 'env' | 'none' = 'none'

	if (secretRef) {
		const secret = await readSecretRecord(companyRoot, secretRef)
		apiKey = secret?.value
		source = 'company-secret'
		if (!apiKey) {
			throw new Error(`AI provider secret "${secretRef}" is missing or empty`)
		}
	} else if (env.OPENROUTER_API_KEY) {
		source = 'env'
	}

	logger.info('ai', 'resolved AI provider configuration', {
		companyRoot: basename(companyRoot),
		deploymentMode: env.DEPLOYMENT_MODE,
		provider: String(providerConfig?.provider ?? 'openrouter'),
		source,
		hasChatBaseUrl: !!providerConfig?.base_url,
	})

	return new OpenRouterAIProvider({
		chatBaseUrl: providerConfig?.base_url as string | undefined,
		apiKey: apiKey ?? env.OPENROUTER_API_KEY,
		utilityModel: providerConfig?.utility_model as string | undefined,
		defaultModel: providerConfig?.default_model as string | undefined,
	})
}

/** DI container factory. */
export const aiProviderFactory = container.registerAsync('aiProvider', async (c) => {
	const { companyRoot } = c.resolve([companyRootFactory])
	let companySettings: Record<string, unknown> | undefined
	try {
		const company = await loadCompany(companyRoot)
		companySettings = company.settings as Record<string, unknown>
	} catch (error) {
		logger.warn('ai', 'failed to load company settings for AI provider; using env fallback only', {
			companyRoot: basename(companyRoot),
			error: error instanceof Error ? error.message : String(error),
		})
	}

	return createAIProviderForCompany(companyRoot, companySettings)
})
