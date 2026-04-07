import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, success, error, separator, dot } from '../utils/format'
import { createApiClient, getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

const runsCmd = new Command('run')
	.description('List and inspect runs')
	.option('-s, --status <status>', 'Filter by run status (pending, claimed, running, completed, failed)')
	.option('-a, --agent <agent>', 'Filter by agent ID')
	.option('-t, --task <task>', 'Filter by task ID')
	.action(async (opts: { status?: string; agent?: string; task?: string }) => {
		try {
			const client = createApiClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.agent) query.agent_id = opts.agent
			if (opts.task) query.task_id = opts.task

			const res = await client.api.runs.$get({ query })
			if (!res.ok) {
				console.error(error('Failed to fetch runs'))
				process.exit(1)
			}

			const runs = (await res.json()) as Array<{
				id: string
				status: string
				agent_id: string
				runtime: string
				task_id?: string | null
				worker_id?: string | null
				resumable?: boolean | null
				resumed_from_run_id?: string | null
				created_at: string
			}>

			console.log(section('Runs'))
			if (runs.length === 0) {
				console.log(dim('  No runs found'))
				return
			}

			// Fetch task titles for display
			const taskTitles = new Map<string, string>()
			const taskIds = [...new Set(runs.map((r) => r.task_id).filter(Boolean) as string[])]
			for (const tid of taskIds) {
				try {
					const tRes = await client.api.tasks[':id'].$get({ param: { id: tid } })
					if (tRes.ok) {
						const t = (await tRes.json()) as { title: string }
						taskTitles.set(tid, t.title)
					}
				} catch (err) {
					console.debug(`[runs] failed to fetch task title for ${tid}:`, err instanceof Error ? err.message : String(err))
				}
			}

			function statusColor(s: string): string {
				if (s === 'completed') return 'green'
				if (s === 'failed') return 'red'
				if (s === 'running') return 'cyan'
				return 'yellow'
			}

			console.log(
				table(
					runs.map((r) => {
						const taskLabel = r.task_id
							? dim(taskTitles.get(r.task_id) ?? r.task_id)
							: ''
						return [
							dim(r.id),
							badge(r.status, statusColor(r.status)),
							r.agent_id,
							taskLabel,
							r.worker_id ? dim(`w:${r.worker_id}`) : '',
						]
					}),
				),
			)
			console.log('')
			console.log(separator())
			console.log(dim(`${runs.length} run(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

runsCmd.addCommand(
	new Command('show')
		.description('Show detailed information about a run')
		.argument('<id>', 'Run ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				const res = await client.api.runs[':id'].$get({ param: { id } })

				if (!res.ok) {
					console.error(error(`Run not found: ${id}`))
					console.error(dim('Use "autopilot runs" to list all runs.'))
					process.exit(1)
				}

				const run = (await res.json()) as {
					id: string
					agent_id: string
					runtime: string
					status: string
					task_id?: string | null
					worker_id?: string | null
					initiated_by?: string
					instructions?: string | null
					summary?: string | null
					tokens_input?: number
					tokens_output?: number
					error?: string | null
					started_at?: string | null
					ended_at?: string | null
					created_at: string
					resumable?: boolean | null
					resumed_from_run_id?: string | null
					preferred_worker_id?: string | null
					runtime_session_ref?: string | null
					targeting?: string | null
				}

				console.log(section(`Run ${run.id}`))
				console.log('')
				console.log(`  ${dim('ID:')}          ${run.id}`)
				console.log(`  ${dim('Status:')}      ${badge(run.status)}`)
				console.log(`  ${dim('Agent:')}       ${run.agent_id}`)
				console.log(`  ${dim('Runtime:')}     ${run.runtime}`)
				if (run.task_id) console.log(`  ${dim('Task:')}        ${run.task_id}`)
				if (run.worker_id) console.log(`  ${dim('Worker:')}      ${run.worker_id}`)
				if (run.initiated_by) console.log(`  ${dim('Initiated by:')} ${run.initiated_by}`)
				console.log(`  ${dim('Created at:')}  ${run.created_at}`)
				if (run.started_at) console.log(`  ${dim('Started at:')}  ${run.started_at}`)
				if (run.ended_at) console.log(`  ${dim('Ended at:')}    ${run.ended_at}`)
				if (run.tokens_input || run.tokens_output) {
					console.log(
						`  ${dim('Tokens:')}      ${run.tokens_input ?? 0} in / ${run.tokens_output ?? 0} out`,
					)
				}

				// Continuation / session info
				if (run.resumable) {
					console.log(`  ${dim('Resumable:')}   ${badge('yes', 'green')}`)
				}
				if (run.resumed_from_run_id) {
					console.log(`  ${dim('Continued from:')} ${run.resumed_from_run_id}`)
				}
				if (run.preferred_worker_id) {
					console.log(`  ${dim('Preferred worker:')} ${run.preferred_worker_id}`)
				}
				if (run.runtime_session_ref) {
					console.log(`  ${dim('Session ref:')} ${run.runtime_session_ref}`)
				}

				// Execution targeting
				if (run.targeting) {
					try {
						const t = JSON.parse(run.targeting) as Record<string, unknown>
						console.log('')
						console.log(dim('Targeting:'))
						if (t.required_runtime) console.log(`  ${dim('Runtime:')} ${t.required_runtime}`)
						if (t.required_worker_id) console.log(`  ${dim('Worker (pinned):')} ${t.required_worker_id}`)
						if (Array.isArray(t.required_worker_tags) && t.required_worker_tags.length > 0) {
							console.log(`  ${dim('Worker tags:')} ${t.required_worker_tags.join(', ')}`)
						}
						console.log(`  ${dim('Fallback:')} ${t.allow_fallback !== false ? 'yes' : 'no'}`)
					} catch (err) {
						console.log(dim(`  (invalid targeting JSON: ${err instanceof Error ? err.message : String(err)})`))
					}
				}

				if (run.summary) {
					console.log('')
					console.log(dim('Summary:'))
					console.log(`  ${run.summary}`)
				}
				if (run.error) {
					console.log('')
					console.log(error(`Error: ${run.error}`))
				}

				// Fetch and display events
				const eventsRes = await client.api.runs[':id'].events.$get({ param: { id } })
				if (eventsRes.ok) {
					const events = (await eventsRes.json()) as Array<{
						type: string
						summary?: string | null
						created_at: string
					}>

					if (events.length > 0) {
						console.log('')
						console.log(dim('Events:'))
						for (const evt of events) {
							console.log(
								`  ${dim(evt.created_at)} ${badge(evt.type, 'cyan')} ${evt.summary ?? ''}`,
							)
						}
					}
				}

				// Fetch and display artifacts
				const artsRes = await client.api.runs[':id'].artifacts.$get({ param: { id } })
				if (artsRes.ok) {
					const arts = (await artsRes.json()) as Array<{
						kind: string
						title: string
						ref_kind: string
						ref_value: string
					}>
					if (arts.length > 0) {
						console.log('')
						console.log(dim('Artifacts:'))
						for (const art of arts) {
							console.log(`  ${badge(art.kind, 'cyan')} ${art.title}  ${dim(`${art.ref_kind}:${art.ref_value}`)}`)
						}
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

runsCmd.addCommand(
	new Command('continue')
		.description('Continue a completed run with new instructions (same worker/session)')
		.argument('<id>', 'Run ID to continue')
		.requiredOption('-m, --message <message>', 'Continuation instructions')
		.action(async (id: string, opts: { message: string }) => {
			try {
				const client = createApiClient()

				const res = await client.api.runs[':id'].continue.$post({
					param: { id },
					json: { message: opts.message },
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Cannot continue run: ${body.error}`))
					process.exit(1)
				}

				const continuation = (await res.json()) as {
					id: string
					status: string
					resumed_from_run_id?: string | null
					preferred_worker_id?: string | null
				}

				console.log(success(`Continuation run created: ${continuation.id}`))
				console.log(dim(`  Status: ${continuation.status}`))
				if (continuation.resumed_from_run_id) {
					console.log(dim(`  Continues: ${continuation.resumed_from_run_id}`))
				}
				if (continuation.preferred_worker_id) {
					console.log(dim(`  Routed to worker: ${continuation.preferred_worker_id}`))
				}
				console.log(dim(`  The run will be picked up by the worker on next poll.`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

runsCmd.addCommand(
	new Command('cancel')
		.description('Cancel a pending, claimed, or running run')
		.argument('<id>', 'Run ID to cancel')
		.option('-r, --reason <reason>', 'Cancellation reason')
		.action(async (id: string, opts: { reason?: string }) => {
			try {
				const client = createApiClient()

				const res = await client.api.runs[':id'].cancel.$post({
					param: { id },
					json: { reason: opts.reason },
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Cannot cancel run: ${body.error}`))
					process.exit(1)
				}

				const run = (await res.json()) as { id: string; status: string }
				console.log(success(`Run ${run.id} cancelled (status: ${run.status})`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Retry Subcommand ───────────────────────────────────────────────────────

runsCmd.addCommand(
	new Command('retry')
		.description('Retry a failed or completed run with the same instructions')
		.argument('<id>', 'Run ID to retry')
		.option('-m, --message <message>', 'Override instructions for the new run')
		.action(async (id: string, opts: { message?: string }) => {
			try {
				const client = createApiClient()

				const res = await client.api.runs[':id'].$get({ param: { id } })
				if (!res.ok) {
					console.error(error(`Run not found: ${id}`))
					process.exit(1)
				}

				const run = (await res.json()) as {
					id: string
					status: string
					agent_id: string
					runtime: string
					task_id?: string | null
					instructions?: string | null
					model?: string | null
					provider?: string | null
					variant?: string | null
				}

				if (run.status !== 'failed' && run.status !== 'completed') {
					console.error(error(`Run ${id} is ${run.status} — can only retry failed or completed runs`))
					process.exit(1)
				}

				const createPayload: Record<string, string> = {
					agent_id: run.agent_id,
					runtime: run.runtime,
				}
				if (run.task_id) createPayload.task_id = run.task_id
				if (opts.message) {
					createPayload.instructions = opts.message
				} else if (run.instructions) {
					createPayload.instructions = run.instructions
				}
				if (run.model) createPayload.model = run.model
				if (run.provider) createPayload.provider = run.provider
				if (run.variant) createPayload.variant = run.variant

				const createRes = await client.api.runs.$post({ json: createPayload })
				if (!createRes.ok) {
					const body = (await createRes.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Failed to create retry run: ${body.error}`))
					process.exit(1)
				}

				const newRun = (await createRes.json()) as { id: string; status: string }
				console.log(success(`Retry run created: ${newRun.id}`))
				console.log(dim(`  Status: ${newRun.status}`))
				console.log(dim(`  Retries: ${id}`))
				console.log(dim(`  The run will be picked up by the worker on next poll.`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Watch Subcommand ───────────────────────────────────────────────────────

interface RunEvent {
	type: string
	summary?: string | null
	metadata?: string | null
	created_at: string
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
		case 'artifact': return '\uD83D\uDCE6 '
		case 'message_sent': return '\u2709\uFE0F  '
		case 'task_updated': return '\uD83D\uDCCB '
		case 'approval_needed': return '\u270B '
		case 'external_action': return '\u2699\uFE0F  '
		default: return '\u2022 '
	}
}

function renderEvent(evt: RunEvent): void {
	const ts = dim(formatTime(evt.created_at))
	const icon = eventIcon(evt.type)
	const summary = evt.summary ?? ''

	if (evt.type === 'error') {
		console.log(`  ${ts}  ${icon}${error(summary)}`)
	} else if (evt.type === 'tool_use') {
		// Try to extract tool name from metadata
		let detail = summary
		if (evt.metadata) {
			try {
				const meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata
				if (meta.tool) detail = `${meta.tool}${summary ? ` ${summary}` : ''}`
			} catch (err) {
				console.debug('[watch] malformed tool_use metadata:', err instanceof Error ? err.message : String(err))
			}
		}
		console.log(`  ${ts}  ${icon}${detail}`)
	} else if (evt.type === 'progress') {
		// Wrap in quotes like the spec shows
		const text = summary.length > 200 ? `${summary.slice(0, 200)}...` : summary
		console.log(`  ${ts}  ${icon}${dim(`"${text}"`)}`)
	} else {
		console.log(`  ${ts}  ${icon}${summary}`)
	}
}

runsCmd.addCommand(
	new Command('watch')
		.description('Watch live events from a running (or completed) run via SSE')
		.argument('<id>', 'Run ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				// Fetch run to validate it exists and get metadata
				const runRes = await client.api.runs[':id'].$get({ param: { id } })
				if (!runRes.ok) {
					console.error(error(`Run not found: ${id}`))
					console.error(dim('Use "autopilot runs" to list all runs.'))
					process.exit(1)
				}

				const run = (await runRes.json()) as {
					id: string
					status: string
					agent_id: string
					task_id?: string | null
				}

				// Fetch task title for header
				let taskLabel = run.task_id ?? ''
				if (run.task_id) {
					try {
						const tRes = await client.api.tasks[':id'].$get({ param: { id: run.task_id } })
						if (tRes.ok) {
							const t = (await tRes.json()) as { title: string }
							taskLabel = t.title
						}
					} catch (err) {
						console.debug('[watch] failed to fetch task title:', err instanceof Error ? err.message : String(err))
					}
				}

				// Print header
				const shortId = run.id.length > 12 ? `${run.id.slice(0, 12)}...` : run.id
				console.log('')
				console.log(`  Run ${shortId}  ${badge(run.status)}  Agent: ${run.agent_id}${taskLabel ? `  Task: ${taskLabel}` : ''}`)
				console.log('')

				// If run is already completed/failed, show historical events and exit
				if (run.status === 'completed' || run.status === 'failed') {
					const eventsRes = await client.api.runs[':id'].events.$get({ param: { id } })
					if (eventsRes.ok) {
						const events = (await eventsRes.json()) as RunEvent[]
						if (events.length === 0) {
							console.log(dim('  No events recorded for this run.'))
						} else {
							for (const evt of events) {
								renderEvent(evt)
							}
						}
					}
					console.log('')
					console.log(dim(`  Run ${run.status}. Showing ${run.status === 'failed' ? 'error' : 'historical'} events.`))
					return
				}

				// Show existing events first
				const existingRes = await client.api.runs[':id'].events.$get({ param: { id } })
				if (existingRes.ok) {
					const existing = (await existingRes.json()) as RunEvent[]
					for (const evt of existing) {
						renderEvent(evt)
					}
				}

				// Subscribe to SSE for live events
				console.log(dim('  (streaming, Ctrl+C to detach)'))
				console.log('')

				const headers: Record<string, string> = { ...getAuthHeaders() }
				if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'

				const res = await fetch(`${getBaseUrl()}/api/events`, { headers })
				if (!res.ok) {
					console.error(error(`Failed to connect to event stream (${res.status})`))
					process.exit(1)
				}

				const reader = res.body?.getReader()
				if (!reader) {
					console.error(error('No response body from event stream'))
					process.exit(1)
				}

				// Graceful Ctrl+C cleanup
				const cleanup = () => {
					reader.cancel().catch((err) => console.debug('[watch] reader cancel error:', err instanceof Error ? err.message : String(err)))
					console.log('')
					console.log(dim('  Detached from run stream.'))
					process.exit(0)
				}
				process.on('SIGINT', cleanup)
				process.on('SIGTERM', cleanup)

				const decoder = new TextDecoder()
				let buffer = ''

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
							const event = JSON.parse(json) as { type: string; runId?: string; eventType?: string; summary?: string; status?: string }
							if (event.type === 'heartbeat') continue

							// Filter for events matching this run
							if (event.type === 'run_event' && event.runId === id) {
								renderEvent({
									type: event.eventType ?? 'progress',
									summary: event.summary ?? null,
									created_at: new Date().toISOString(),
								})
							} else if (event.type === 'run_started' && event.runId === id) {
								renderEvent({
									type: 'started',
									summary: 'Run started',
									created_at: new Date().toISOString(),
								})
							} else if (event.type === 'run_completed' && event.runId === id) {
								const status = event.status ?? 'completed'
								renderEvent({
									type: 'completed',
									summary: `Run ${status}`,
									created_at: new Date().toISOString(),
								})
								console.log('')
								console.log(dim(`  Run ${status}.`))
								reader.cancel().catch((err) => console.debug('[watch] reader cancel error:', err instanceof Error ? err.message : String(err)))
								process.removeListener('SIGINT', cleanup)
								process.removeListener('SIGTERM', cleanup)
								return
							}
						} catch (err) {
							console.debug('[watch] malformed SSE data:', err instanceof Error ? err.message : String(err))
						}
					}
				}
			} catch (err) {
				if (err instanceof Error && err.name === 'AbortError') return
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(runsCmd)
