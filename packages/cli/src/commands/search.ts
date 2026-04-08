import { Command } from 'commander'
import { program } from '../program'
import { section, dim, error, separator, badge } from '../utils/format'
import { createApiClient } from '../utils/client'

program.addCommand(
	new Command('search')
		.description('Full-text search across tasks, runs, context files, and schedules')
		.argument('<query>', 'Search query')
		.option('-s, --scope <scope>', 'Scope: tasks, runs, context, schedules, all', 'all')
		.action(async (query: string, opts: { scope: string }) => {
			try {
				const client = createApiClient()
				const res = await client.api.search.$get({
					query: { q: query, scope: opts.scope },
				})

				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Search failed'))
					process.exit(1)
				}

				const data = (await res.json()) as {
					results: Array<{
						entityType: string
						entityId: string
						title: string | null
						snippet: string
						rank: number
					}>
					query: string
					scope: string
				}

				console.log(section(`Search: "${data.query}" (scope: ${data.scope})`))
				console.log('')

				if (data.results.length === 0) {
					console.log(dim('  No results found'))
					return
				}

				for (const result of data.results) {
					const typeLabel = badge(result.entityType, 'cyan')
					const title = result.title ?? result.entityId
					console.log(`  ${typeLabel}  ${title}`)
					console.log(`  ${dim(result.entityId)}`)
					// Strip HTML tags from snippet for CLI display
					const cleanSnippet = result.snippet.replace(/<\/?b>/g, '')
					if (cleanSnippet) {
						const truncated = cleanSnippet.length > 120 ? `${cleanSnippet.slice(0, 120)}...` : cleanSnippet
						console.log(`  ${dim(truncated)}`)
					}
					console.log('')
				}

				console.log(separator())
				console.log(dim(`${data.results.length} result(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)
