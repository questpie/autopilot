import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, success, error, separator } from '../utils/format'
import { createApiClient } from '../utils/client'

const runsCmd = new Command('runs')
	.description('List and inspect runs')
	.option('-s, --status <status>', 'Filter by run status (pending, claimed, running, completed, failed)')
	.option('-a, --agent <agent>', 'Filter by agent ID')
	.action(async (opts: { status?: string; agent?: string }) => {
		try {
			const client = createApiClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.agent) query.agent_id = opts.agent

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
				resumable?: boolean | null
				resumed_from_run_id?: string | null
				created_at: string
			}>

			console.log(section('Runs'))
			if (runs.length === 0) {
				console.log(dim('  No runs found'))
				return
			}

			console.log(
				table(
					runs.map((r) => [
						dim(r.id),
						badge(
							r.status,
							r.status === 'completed'
								? 'green'
								: r.status === 'failed'
									? 'red'
									: r.status === 'running'
										? 'cyan'
										: 'yellow',
						),
						r.agent_id,
						r.runtime,
						r.task_id ? dim(`task:${r.task_id}`) : '',
						r.resumable ? badge('resumable', 'green') : '',
						r.resumed_from_run_id ? dim(`<- ${r.resumed_from_run_id}`) : '',
					]),
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

program.addCommand(runsCmd)
