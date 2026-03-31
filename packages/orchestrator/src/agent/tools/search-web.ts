import { z } from 'zod'
import { OpenRouterAIProvider } from '../../ai/openrouter-provider'
import type { AIProvider } from '../../ai/provider'
import type { ToolDefinition } from '../tools'

/**
 * Web search tool using AIProvider.webSearch().
 *
 * How it works: Delegates to the AIProvider which makes a chat completion request
 * with a search model (e.g., `openai/gpt-4o-mini:online`), which triggers native web search.
 * The response includes search results with URL citations.
 */
export function createSearchWebTool(aiProviderOrCompanyRoot: AIProvider | string): ToolDefinition {
	const aiProvider =
		typeof aiProviderOrCompanyRoot === 'string'
			? new OpenRouterAIProvider()
			: aiProviderOrCompanyRoot

	return {
		name: 'web_search',
		description:
			'Search the web for current information. Returns search results with titles, URLs, and content snippets.',
		schema: z.object({
			query: z.string().describe('Search query'),
			max_results: z.number().optional().describe('Max results to return, default 5'),
		}),
		execute: async (args, _ctx) => {
			const result = await aiProvider.webSearch(args.query, args.max_results)

			if (result.error) {
				return {
					content: [{ type: 'text' as const, text: `Web search failed: ${result.error}` }],
					isError: true,
				}
			}

			if (result.citations.length > 0) {
				const text = result.citations
					.map((c, i) => `${i + 1}. **${c.title}**\n   ${c.url}\n   ${c.snippet ?? ''}`)
					.join('\n\n')

				return {
					content: [{ type: 'text' as const, text }],
				}
			}

			return {
				content: [{ type: 'text' as const, text: result.content || 'No search results found.' }],
			}
		},
	}
}
