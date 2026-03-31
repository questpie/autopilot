import { companyRootFactory, container } from '../container'
import { getEnv } from '../env'
import { loadCompany } from '../fs'
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

	if (secretRef) {
		const secret = await readSecretRecord(companyRoot, secretRef)
		apiKey = secret?.value
	}

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
	try {
		const company = await loadCompany(companyRoot)
		return createAIProviderForCompany(companyRoot, company.settings as Record<string, unknown>)
	} catch {
		return createAIProviderForCompany(companyRoot)
	}
})
