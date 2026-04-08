import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, success, error, separator, dot } from '../utils/format'
import { createApiClient, getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

const queryCmd = new Command('query')
	.description('Ask a question or request assistant help (no task created)')
	.argument('<prompt>', 'The question or request')
	.option('-a, --agent <agent_id>', 'Agent to handle the query')
	.option('--allow-mutation', 'Allow the query to modify repo/company files', false)
	.option('--continue-from <query_id>', 'Continue from a prior query')
	.option('--runtime <runtime>', 'Explicit runtime override')
	.option('-w, --wait', 'Wait for the query to complete and show result', false)
	.option('-s, --stream', 'Stream live events (alias for --wait)', false)
	.action(
		async (
			prompt: string,
			opts: {
				agent?: string
				allowMutation: boolean
				continueFrom?: string
				runtime?: string
				wait: boolean
				stream: boolean
			},
		) => {
			try {
				const client = createApiClient()
				const shouldStream = opts.wait || opts.stream

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

				if (!shouldStream) {
					console.log(dim('  Use --wait/--stream to stream live events, or:'))
					console.log(dim(`  autopilot query show ${created.query_id}`))
					return
				}

				// Stream live events via SSE
				console.log('')
				console.log(dim('  (streaming, Ctrl+C to detach)'))
				console.log('')

				const finalQuery = await streamQueryEvents(created.query_id, created.run_id, client)
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

// ─── SSE Streaming ───────────────────────────────────────────────────────

interface SSEEvent {
	type: string
	runId?: string
	eventType?: string
	summary?: string
	status?: string
}

function formatTime(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function eventIcon(type: string): string {
	switch (type) {
		case 'started': return `${dot('green')} `
		case 'completed': return `${dot('green')} `
		case 'progress': return '\uD83D\uDCAC '
		case 'tool_use': return '\uD83D\uDD27 '
		case 'error': return '\u274C '
		default: return '\u2022 '
	}
}

async function streamQueryEvents(
	queryId: string,
	runId: string,
	client: ReturnType<typeof createApiClient>,
): Promise<QueryDetail | undefined> {
	const headers: Record<string, string> = { ...getAuthHeaders() }
	if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'

	// Check if run already completed before connecting SSE
	const runRes = await client.api.runs[':id'].$get({ param: { id: runId } })
	if (runRes.ok) {
		const run = (await runRes.json()) as { status: string }
		if (run.status === 'completed' || run.status === 'failed') {
			const qRes = await client.api.queries[':id'].$get({ param: { id: queryId } })
			if (qRes.ok) return (await qRes.json()) as QueryDetail
			return undefined
		}
	}

	const sseRes = await fetch(`${getBaseUrl()}/api/events`, { headers })
	if (!sseRes.ok) {
		console.error(error(`Failed to connect to event stream (${sseRes.status})`))
		process.exit(1)
	}

	const reader = sseRes.body?.getReader()
	if (!reader) {
		console.error(error('No response body from event stream'))
		process.exit(1)
	}

	// Graceful Ctrl+C cleanup
	const cleanup = () => {
		reader.cancel().catch((err) => console.debug('[query] reader cancel error:', err instanceof Error ? err.message : String(err)))
		console.log('')
		console.log(dim('  Detached from query stream.'))
		process.exit(0)
	}
	process.on('SIGINT', cleanup)
	process.on('SIGTERM', cleanup)

	const decoder = new TextDecoder()
	let buffer = ''

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop()!

			for (const line of lines) {
				if (!line.startsWith('data: ')) continue
				const json = line.slice(6)
				try {
					const event = JSON.parse(json) as SSEEvent
					if (event.type === 'heartbeat') continue

					// Filter for events matching this run
					if (event.type === 'run_event' && event.runId === runId) {
						const ts = dim(formatTime(new Date().toISOString()))
						const icon = eventIcon(event.eventType ?? 'progress')
						const summary = event.summary ?? ''
						if (event.eventType === 'progress') {
							const text = summary.length > 200 ? `${summary.slice(0, 200)}...` : summary
							console.log(`  ${ts}  ${icon}${dim(`"${text}"`)}`)
						} else {
							console.log(`  ${ts}  ${icon}${summary}`)
						}
					} else if (event.type === 'run_started' && event.runId === runId) {
						const ts = dim(formatTime(new Date().toISOString()))
						console.log(`  ${ts}  ${eventIcon('started')}Run started`)
					} else if (event.type === 'run_completed' && event.runId === runId) {
						const ts = dim(formatTime(new Date().toISOString()))
						const status = event.status ?? 'completed'
						console.log(`  ${ts}  ${eventIcon('completed')}Run ${status}`)
						console.log('')

						// Fetch final query result
						reader.cancel().catch((err) => console.debug('[query] reader cancel error:', err instanceof Error ? err.message : String(err)))
						process.removeListener('SIGINT', cleanup)
						process.removeListener('SIGTERM', cleanup)

						const qRes = await client.api.queries[':id'].$get({ param: { id: queryId } })
						if (qRes.ok) return (await qRes.json()) as QueryDetail
						return undefined
					}
				} catch (err) {
					console.debug('[query] malformed SSE data:', err instanceof Error ? err.message : String(err))
				}
			}
		}
	} catch (err) {
		if (err instanceof Error && err.name === 'AbortError') {
			// Connection dropped — fall back to polling once
			const qRes = await client.api.queries[':id'].$get({ param: { id: queryId } })
			if (qRes.ok) return (await qRes.json()) as QueryDetail
		}
		throw err
	}

	// Stream ended without run_completed — connection drop fallback
	process.removeListener('SIGINT', cleanup)
	process.removeListener('SIGTERM', cleanup)
	console.log(dim('  SSE stream ended, fetching final result...'))
	const qRes = await client.api.queries[':id'].$get({ param: { id: queryId } })
	if (qRes.ok) return (await qRes.json()) as QueryDetail
	return undefined
}

program.addCommand(queryCmd)
