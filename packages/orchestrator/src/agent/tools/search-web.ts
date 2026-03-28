import { join } from 'path'
import { z } from 'zod'
import { PATHS } from '@questpie/autopilot-spec'
import { readYamlUnsafe } from '../../fs/yaml'
import { loadCompany } from '../../fs/company'
import type { ToolDefinition, ToolContext, ToolResult } from '../tools'
import { checkSsrf } from './shared'

export function createSearchWebTool(companyRoot: string): ToolDefinition {
	return {
		name: 'search_web',
		description: 'Search the web using a search API. Returns titles, URLs, and snippets.',
		schema: z.object({
			query: z.string().describe('Search query'),
			max_results: z.number().optional().describe('Max results to return, default 5'),
		}),
		execute: async (args, ctx) => {
			const maxResults = args.max_results ?? 5

			// Load search API key from secrets/search-api.yaml
			const secretPath = join(
				companyRoot,
				PATHS.SECRETS_DIR.replace(/^\/company/, ''),
				'search-api.yaml',
			)
			let apiKey: string | undefined
			let allowedAgents: string[] | undefined
			try {
				const secret = (await readYamlUnsafe(secretPath)) as {
					api_key?: string
					allowed_agents?: string[]
				}
				apiKey = secret.api_key
				allowedAgents = secret.allowed_agents
			} catch {
				return {
					content: [{ type: 'text' as const, text: 'Web search not configured. Add search API key in secrets/search-api.yaml.' }],
					isError: true,
				}
			}

			if (!apiKey) {
				return {
					content: [{ type: 'text' as const, text: 'Web search not configured. Add search API key in secrets/search-api.yaml.' }],
					isError: true,
				}
			}

			// Check agent access
			if (allowedAgents && allowedAgents.length > 0 && !allowedAgents.includes(ctx.agentId)) {
				return {
					content: [{ type: 'text' as const, text: `Agent ${ctx.agentId} not allowed to use search_web.` }],
					isError: true,
				}
			}

			// Determine search provider from company.yaml settings
			let searchProvider = 'brave'
			try {
				const company = await loadCompany(companyRoot)
				const settings = company.settings as Record<string, unknown>
				if (settings.search_provider && typeof settings.search_provider === 'string') {
					searchProvider = settings.search_provider
				}
			} catch {
				// Use default provider
			}

			try {
				let results: Array<{ title: string; url: string; snippet: string }> = []

				switch (searchProvider) {
					case 'tavily': {
						const resp = await fetch('https://api.tavily.com/search', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								api_key: apiKey,
								query: args.query,
								max_results: maxResults,
							}),
							signal: AbortSignal.timeout(15_000),
						})
						if (!resp.ok) {
							return { content: [{ type: 'text' as const, text: `Tavily search failed: HTTP ${resp.status}` }], isError: true }
						}
						const data = (await resp.json()) as { results?: Array<{ title: string; url: string; content: string }> }
						results = (data.results ?? []).slice(0, maxResults).map((r) => ({
							title: r.title,
							url: r.url,
							snippet: r.content,
						}))
						break
					}

					case 'serpapi': {
						const params = new URLSearchParams({
							api_key: apiKey,
							q: args.query,
							num: String(maxResults),
						})
						const resp = await fetch(`https://serpapi.com/search.json?${params}`, {
							signal: AbortSignal.timeout(15_000),
						})
						if (!resp.ok) {
							return { content: [{ type: 'text' as const, text: `SerpAPI search failed: HTTP ${resp.status}` }], isError: true }
						}
						const data = (await resp.json()) as { organic_results?: Array<{ title: string; link: string; snippet: string }> }
						results = (data.organic_results ?? []).slice(0, maxResults).map((r) => ({
							title: r.title,
							url: r.link,
							snippet: r.snippet,
						}))
						break
					}

					case 'brave':
					default: {
						const params = new URLSearchParams({
							q: args.query,
							count: String(maxResults),
						})
						const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
							headers: {
								'Accept': 'application/json',
								'Accept-Encoding': 'gzip',
								'X-Subscription-Token': apiKey,
							},
							signal: AbortSignal.timeout(15_000),
						})
						if (!resp.ok) {
							return { content: [{ type: 'text' as const, text: `Brave search failed: HTTP ${resp.status}` }], isError: true }
						}
						const data = (await resp.json()) as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
						results = (data.web?.results ?? []).slice(0, maxResults).map((r) => ({
							title: r.title,
							url: r.url,
							snippet: r.description,
						}))
						break
					}
				}

				if (results.length === 0) {
					return { content: [{ type: 'text' as const, text: 'No search results found.' }] }
				}

				// SSRF check on result URLs
				const safeResults: typeof results = []
				for (const r of results) {
					const ssrfError = await checkSsrf(r.url)
					if (!ssrfError) {
						safeResults.push(r)
					}
				}

				if (safeResults.length === 0) {
					return { content: [{ type: 'text' as const, text: 'All search results were filtered by SSRF protection.' }] }
				}

				const markdown = safeResults
					.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
					.join('\n\n')

				return { content: [{ type: 'text' as const, text: markdown }] }
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return { content: [{ type: 'text' as const, text: `Web search failed: ${msg}` }], isError: true }
			}
		},
	}
}
