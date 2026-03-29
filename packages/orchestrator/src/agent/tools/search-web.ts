import { z } from 'zod'
import type { ToolDefinition, ToolContext, ToolResult } from '../tools'

/**
 * Web search tool using OpenRouter's `:online` web search plugin.
 *
 * How it works: Makes a chat completion request to OpenRouter with a search model
 * (e.g., `openai/gpt-4o-mini:online`), which triggers native web search.
 * The response includes search results with URL citations.
 *
 * Zero extra infrastructure — uses the same OPENROUTER_API_KEY.
 */
export function createSearchWebTool(_companyRoot: string): ToolDefinition {
	return {
		name: 'search_web',
		description: 'Search the web for current information. Returns search results with titles, URLs, and content snippets.',
		schema: z.object({
			query: z.string().describe('Search query'),
			max_results: z.number().optional().describe('Max results to return, default 5'),
		}),
		execute: async (args, _ctx) => {
			const maxResults = args.max_results ?? 5
			const apiKey = process.env.OPENROUTER_API_KEY

			if (!apiKey) {
				return {
					content: [{ type: 'text' as const, text: 'Web search requires OPENROUTER_API_KEY to be configured.' }],
					isError: true,
				}
			}

			try {
				// Use OpenRouter's :online plugin via a cheap model
				const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
						'HTTP-Referer': 'https://questpie.com',
						'X-Title': 'QuestPie Autopilot',
					},
					body: JSON.stringify({
						model: 'openai/gpt-4o-mini:online',
						messages: [
							{
								role: 'user',
								content: `Search the web for: ${args.query}\n\nReturn the top ${maxResults} most relevant results. For each result include the title, URL, and a brief content snippet.`,
							},
						],
						max_tokens: 1500,
					}),
					signal: AbortSignal.timeout(30_000),
				})

				if (!resp.ok) {
					const body = await resp.text().catch(() => '')
					return {
						content: [{ type: 'text' as const, text: `Web search failed: HTTP ${resp.status} ${body.slice(0, 200)}` }],
						isError: true,
					}
				}

				const data = (await resp.json()) as {
					choices?: Array<{
						message?: {
							content?: string
							annotations?: Array<{
								type: string
								url_citation?: { url: string; title: string; content?: string }
							}>
						}
					}>
				}

				const choice = data.choices?.[0]?.message
				const content = choice?.content ?? ''
				const annotations = choice?.annotations ?? []

				// If we have URL citations, format them nicely
				if (annotations.length > 0) {
					const citations = annotations
						.filter((a) => a.type === 'url_citation' && a.url_citation)
						.slice(0, maxResults)
						.map((a, i) => {
							const c = a.url_citation!
							return `${i + 1}. **${c.title}**\n   ${c.url}\n   ${c.content?.slice(0, 200) ?? ''}`
						})
						.join('\n\n')

					return {
						content: [{ type: 'text' as const, text: citations || content }],
					}
				}

				// Fallback: return raw content from the model
				return {
					content: [{ type: 'text' as const, text: content || 'No search results found.' }],
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				return {
					content: [{ type: 'text' as const, text: `Web search failed: ${msg}` }],
					isError: true,
				}
			}
		},
	}
}
