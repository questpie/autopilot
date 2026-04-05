import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, success, error, separator } from '../utils/format'
import { createApiClient } from '../utils/client'

const queryCmd = new Command('query')
	.description('Ask a question or request assistant help (no task created)')
	.argument('<prompt>', 'The question or request')
	.option('-a, --agent <agent_id>', 'Agent to handle the query')
	.option('--allow-mutation', 'Allow the query to modify repo/company files', false)
	.option('--continue-from <query_id>', 'Continue from a prior query')
	.option('--runtime <runtime>', 'Explicit runtime override')
	.option('-w, --wait', 'Wait for the query to complete and show result', false)
	.option('--poll-interval <ms>', 'Poll interval in ms when waiting', '3000')
	.action(
		async (
			prompt: string,
			opts: {
				agent?: string
				allowMutation: boolean
				continueFrom?: string
				runtime?: string
				wait: boolean
				pollInterval: string
			},
		) => {
			try {
				const client = createApiClient()

				// Create the query
				const res = await client.api.queries.$post({
					json: {
						prompt,
						agent_id: opts.agent,
						allow_repo_mutation: opts.allowMutation,
						continue_from: opts.continueFrom,
						runtime: opts.runtime,
					},
				})

				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Failed to create query'))
					process.exit(1)
				}

				const created = (await res.json()) as {
					query_id: string
					run_id: string
					status: string
					continue_from: string | null
				}

				console.log(success(`Query created: ${created.query_id}`))
				console.log(dim(`  Run: ${created.run_id}`))
				if (created.continue_from) {
					console.log(dim(`  Continues: ${created.continue_from}`))
				}

				if (!opts.wait) {
					console.log(dim('  Use --wait to wait for completion, or:'))
					console.log(dim(`  autopilot query show ${created.query_id}`))
					return
				}

				// Poll for completion
				const pollMs = Number.parseInt(opts.pollInterval, 10)
				console.log(dim(`  Waiting for completion (poll every ${pollMs}ms)...`))

				let finalQuery: QueryDetail | undefined

				while (true) {
					await sleep(pollMs)

					const pollRes = await client.api.queries[':id'].$get({
						param: { id: created.query_id },
					})
					if (!pollRes.ok) {
						console.error(error('Failed to poll query status'))
						process.exit(1)
					}

					const q = (await pollRes.json()) as QueryDetail
					if (q.status === 'completed' || q.status === 'failed') {
						finalQuery = q
						break
					}
				}

				printQueryResult(finalQuery)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		},
	)

queryCmd.addCommand(
	new Command('show')
		.description('Show a query result')
		.argument('<id>', 'Query ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()
				const res = await client.api.queries[':id'].$get({ param: { id } })

				if (!res.ok) {
					console.error(error(`Query not found: ${id}`))
					process.exit(1)
				}

				const q = (await res.json()) as QueryDetail
				printQueryResult(q)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

queryCmd.addCommand(
	new Command('list')
		.description('List recent queries')
		.option('-s, --status <status>', 'Filter by status')
		.option('-a, --agent <agent_id>', 'Filter by agent')
		.action(async (opts: { status?: string; agent?: string }) => {
			try {
				const client = createApiClient()
				const query: Record<string, string> = {}
				if (opts.status) query.status = opts.status
				if (opts.agent) query.agent_id = opts.agent

				const res = await client.api.queries.$get({ query })
				if (!res.ok) {
					console.error(error('Failed to fetch queries'))
					process.exit(1)
				}

				const queries = (await res.json()) as QueryListItem[]

				console.log(section('Queries'))
				if (queries.length === 0) {
					console.log(dim('  No queries found'))
					return
				}

				for (const q of queries) {
					const statusBadge = badge(q.status, queryStatusColor(q.status))
					const prompt = q.prompt.length > 60 ? `${q.prompt.slice(0, 60)}...` : q.prompt
					console.log(`  ${dim(q.id)}  ${statusBadge}  ${prompt}`)
				}
				console.log('')
				console.log(separator())
				console.log(dim(`${queries.length} query/queries`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Matches the GET /api/queries/:id response shape. */
interface QueryDetail {
	query_id: string
	prompt: string
	agent_id: string
	run_id: string | null
	status: string
	allow_repo_mutation: boolean
	mutated_repo: boolean
	summary: string | null
	error: string | null
	continue_from: string | null
	carryover_summary: string | null
	created_by: string
	created_at: string
	ended_at: string | null
}

/** Matches the GET /api/queries list item shape (raw row). */
interface QueryListItem {
	id: string
	prompt: string
	status: string
	agent_id: string
}

function queryStatusColor(status: string): string {
	if (status === 'completed') return 'green'
	if (status === 'failed') return 'red'
	return 'cyan'
}

function printQueryResult(q: QueryDetail | undefined): void {
	if (!q) {
		console.error(error('Query not found'))
		return
	}

	console.log(section('Query Result'))
	console.log('')
	console.log(`  ${dim('ID:')}       ${q.query_id}`)
	console.log(`  ${dim('Status:')}   ${badge(q.status, queryStatusColor(q.status))}`)
	console.log(`  ${dim('Agent:')}    ${q.agent_id}`)
	if (q.run_id) console.log(`  ${dim('Run:')}      ${q.run_id}`)
	if (q.continue_from) console.log(`  ${dim('Continues:')} ${q.continue_from}`)
	console.log(`  ${dim('Mutation:')} ${q.allow_repo_mutation ? 'allowed' : 'read-only'}${q.mutated_repo ? ' (files changed)' : ''}`)
	console.log(`  ${dim('Created:')}  ${q.created_at}`)
	if (q.ended_at) console.log(`  ${dim('Ended:')}    ${q.ended_at}`)

	if (q.error && q.status === 'failed') {
		console.log('')
		console.log(error(`Error: ${q.error}`))
	}

	if (q.summary) {
		console.log('')
		console.log(dim('Summary:'))
		console.log(`  ${q.summary}`)
	}

	console.log('')
	console.log(dim('Prompt:'))
	console.log(`  ${q.prompt.length > 200 ? `${q.prompt.slice(0, 200)}...` : q.prompt}`)
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

program.addCommand(queryCmd)
