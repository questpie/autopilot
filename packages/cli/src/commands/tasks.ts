import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, table, success, error, separator, dot, header, warning, stripAnsi } from '../utils/format'
import { createApiClient, getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

// ─── Shared Types ─────────────────────────────────────────────────────────

interface TaskSummary {
	id: string
	status: string
	title: string
	assigned_to?: string | null
	type: string
	workflow_step?: string | null
}

interface ChildRollup {
	total: number
	active: number
	blocked: number
	done: number
	failed: number
	backlog: number
}

const tasksCmd = new Command('task')
	.alias('tasks')
	.description('List and manage tasks')
	.option('-s, --status <status>', 'Filter by task status')
	.option('-a, --assigned <agent>', 'Filter by assigned agent ID')
	.action(async (opts: { status?: string; assigned?: string }) => {
		try {
			const client = createApiClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.assigned) query.assigned_to = opts.assigned

			const res = await client.api.tasks.$get({ query })
			if (!res.ok) {
				console.error(error('Failed to fetch tasks'))
				process.exit(1)
			}

			const tasks = (await res.json()) as TaskSummary[]

			console.log(section('Tasks'))
			if (tasks.length === 0) {
				console.log(dim('  No tasks found'))
				if (opts.status || opts.assigned) {
					console.log(
						dim(
							`  Filters: ${opts.status ? `status=${opts.status}` : ''} ${opts.assigned ? `assigned_to=${opts.assigned}` : ''}`,
						),
					)
				}
				return
			}

			console.log(
				table(
					tasks.map((t) => [
						dim(t.id),
						badge(t.status, statusColor(t.status)),
						t.title,
						t.assigned_to ? dim(`-> ${t.assigned_to}`) : '',
					]),
				),
			)
			console.log('')
			console.log(separator())
			const blockedCount = tasks.filter((t) => t.status === 'blocked').length
			console.log(
				dim(`${tasks.length} task(s)`) +
					(blockedCount > 0 ? `  ${badge(`${blockedCount} blocked`, 'yellow')}` : ''),
			)
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

tasksCmd.addCommand(
	new Command('show')
		.description('Show detailed information about a task')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				const res = await client.api.tasks[':id'].$get({ param: { id } })

				if (!res.ok) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				const task = (await res.json()) as {
					id: string
					title: string
					status: string
					type: string
					priority?: string
					assigned_to?: string | null
					workflow_id?: string | null
					workflow_step?: string | null
					created_by?: string
					created_at: string
					updated_at?: string
					description?: string | null
				}

				console.log(section(task.title))
				console.log('')
				console.log(`  ${dim('ID:')}          ${task.id}`)
				console.log(
					`  ${dim('Status:')}      ${badge(task.status, task.status === 'blocked' ? 'red' : task.status === 'done' ? 'green' : 'cyan')}`,
				)
				console.log(`  ${dim('Type:')}        ${task.type}`)
				if (task.priority) console.log(`  ${dim('Priority:')}    ${task.priority}`)
				console.log(`  ${dim('Assigned:')}    ${task.assigned_to ?? 'unassigned'}`)
				if (task.workflow_id) console.log(`  ${dim('Workflow:')}    ${task.workflow_id}`)
				if (task.workflow_step) console.log(`  ${dim('Step:')}        ${task.workflow_step}`)
				if (task.created_by) console.log(`  ${dim('Created by:')}  ${task.created_by}`)
				console.log(`  ${dim('Created at:')}  ${task.created_at}`)
				if (task.updated_at) console.log(`  ${dim('Updated at:')}  ${task.updated_at}`)

				if (task.status === 'blocked') {
					const childCount = await getChildCount(client, task.id)
					if (childCount > 0) {
						console.log('')
						console.log(`  ${badge('WAITING FOR CHILDREN', 'yellow')}`)
						await printRollupSummary(client, task.id)
					} else {
						console.log('')
						console.log(`  ${badge('WAITING FOR APPROVAL', 'red')}`)
						console.log(dim(`  Use: autopilot tasks approve|reject|reply ${task.id}`))
					}

					// Show last completed run summary for context
					await printLastRunSummary(client, task.id)
				}

				if (task.description) {
					console.log('')
					console.log(dim('Description:'))
					console.log(`  ${task.description}`)
				}

				// Show approval history
				try {
					const actRes = await client.api.tasks[':id'].activity.$get({ param: { id } })
					if (actRes.ok) {
						const entries = (await actRes.json()) as Array<{
							type: string
							actor: string
							summary: string
							created_at: string
						}>
						if (entries.length > 0) {
							console.log('')
							console.log(dim('Approval history:'))
							for (const e of entries) {
								const icon = e.type === 'approval' ? '+' : e.type === 'rejection' ? 'x' : '>'
								console.log(`  ${dim(e.created_at)} [${icon}] ${e.summary}`)
							}
						}
					}
				} catch (err) {
					console.debug(
						'[tasks] activity fetch failed:',
						err instanceof Error ? err.message : String(err),
					)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('create')
		.description('Create a new task')
		.requiredOption('-t, --title <title>', 'Task title')
		.requiredOption('--type <type>', 'Task type (e.g. feature, bug, chore)')
		.option('-d, --description <desc>', 'Task description')
		.option('--priority <priority>', 'Priority (low, medium, high, critical)')
		.option('--assign <agent>', 'Assign to agent ID')
		.action(
			async (opts: {
				title: string
				type: string
				description?: string
				priority?: string
				assign?: string
			}) => {
				try {
					const client = createApiClient()

					const res = await client.api.tasks.$post({
						json: {
							title: opts.title,
							type: opts.type,
							description: opts.description,
							priority: opts.priority,
							assigned_to: opts.assign,
						},
					})

					if (!res.ok) {
						console.error(error('Failed to create task'))
						process.exit(1)
					}

					const task = (await res.json()) as { id: string; title: string }
					console.log(success(`Task created: ${task.id}`))
					console.log(dim(`  ${task.title}`))
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

tasksCmd.addCommand(
	new Command('update')
		.description('Update a task')
		.argument('<id>', 'Task ID')
		.option('-s, --status <status>', 'New status')
		.option('-t, --title <title>', 'New title')
		.option('-d, --description <desc>', 'New description')
		.option('--priority <priority>', 'New priority')
		.option('--assign <agent>', 'Assign to agent ID')
		.action(
			async (
				id: string,
				opts: {
					status?: string
					title?: string
					description?: string
					priority?: string
					assign?: string
				},
			) => {
				try {
					const client = createApiClient()

					const body: Record<string, string> = {}
					if (opts.status) body.status = opts.status
					if (opts.title) body.title = opts.title
					if (opts.description) body.description = opts.description
					if (opts.priority) body.priority = opts.priority
					if (opts.assign) body.assigned_to = opts.assign

					if (Object.keys(body).length === 0) {
						console.error(error('No updates provided. Use --status, --title, etc.'))
						process.exit(1)
					}

					const res = await client.api.tasks[':id'].$patch({
						param: { id },
						json: body,
					})

					if (!res.ok) {
						console.error(error(`Failed to update task: ${id}`))
						process.exit(1)
					}

					const task = (await res.json()) as { id: string; status: string }
					console.log(success(`Task ${task.id} updated (status: ${task.status})`))
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

tasksCmd.addCommand(
	new Command('approve')
		.description('Approve a task waiting on a human_approval step')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].approve.$post({ param: { id } })
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Approval failed'))
					process.exit(1)
				}
				const result = (await res.json()) as {
					task: { id: string; status: string; workflow_step?: string }
					actions: string[]
				}
				console.log(success(`Task ${id} approved`))
				console.log(dim(`  Status: ${result.task.status}`))
				if (result.task.workflow_step) console.log(dim(`  Step: ${result.task.workflow_step}`))
				console.log(dim(`  Actions: ${result.actions.join(', ')}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('reject')
		.description('Reject a task waiting on a human_approval step')
		.argument('<id>', 'Task ID')
		.requiredOption('-m, --message <message>', 'Rejection reason')
		.action(async (id: string, opts: { message: string }) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].reject.$post({
					param: { id },
					json: { message: opts.message },
				})
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Rejection failed'))
					process.exit(1)
				}
				console.log(success(`Task ${id} rejected`))
				console.log(dim(`  Reason: ${opts.message}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('reply')
		.description('Reply to a task waiting on a human_approval step and advance workflow')
		.argument('<id>', 'Task ID')
		.requiredOption('-m, --message <message>', 'Reply message (becomes instructions for next step)')
		.action(async (id: string, opts: { message: string }) => {
			try {
				const client = createApiClient()
				const res = await client.api.tasks[':id'].reply.$post({
					param: { id },
					json: { message: opts.message },
				})
				if (!res.ok) {
					const body = (await res.json()) as { error?: string }
					console.error(error(body.error ?? 'Reply failed'))
					process.exit(1)
				}
				const result = (await res.json()) as {
					task: { id: string; status: string; workflow_step?: string }
					runId: string | null
					actions: string[]
				}
				console.log(success(`Task ${id} replied`))
				console.log(dim(`  Status: ${result.task.status}`))
				if (result.runId) console.log(dim(`  Run created: ${result.runId}`))
				console.log(dim(`  Actions: ${result.actions.join(', ')}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Child / Parent / Rollup Subcommands ──────────────────────────────────

tasksCmd.addCommand(
	new Command('children')
		.description('List child tasks of a parent task')
		.argument('<id>', 'Parent task ID')
		.option('--relation <type>', 'Filter by relation type')
		.action(async (id: string, opts: { relation?: string }) => {
			try {
				const client = createApiClient()
				const query: Record<string, string> = {}
				if (opts.relation) query.relation_type = opts.relation

				const res = await client.api.tasks[':id'].children.$get({ param: { id }, query })
				if (!res.ok) {
					console.error(error(`Failed to fetch children for task ${id}`))
					process.exit(1)
				}

				const children = (await res.json()) as TaskSummary[]

				console.log(section(`Children of ${id}`))
				if (children.length === 0) {
					console.log(dim('  No child tasks'))
					return
				}

				console.log(
					table(
						children.map((t) => [
							dim(t.id),
							badge(t.status, statusColor(t.status)),
							t.title,
							t.assigned_to ? dim(`-> ${t.assigned_to}`) : '',
						]),
					),
				)
				console.log('')
				printRollupLine(countStatuses(children))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('parents')
		.description('List parent tasks of a child task')
		.argument('<id>', 'Child task ID')
		.option('--relation <type>', 'Filter by relation type')
		.action(async (id: string, opts: { relation?: string }) => {
			try {
				const client = createApiClient()
				const query: Record<string, string> = {}
				if (opts.relation) query.relation_type = opts.relation

				const res = await client.api.tasks[':id'].parents.$get({ param: { id }, query })
				if (!res.ok) {
					console.error(error(`Failed to fetch parents for task ${id}`))
					process.exit(1)
				}

				const parents = (await res.json()) as TaskSummary[]

				console.log(section(`Parents of ${id}`))
				if (parents.length === 0) {
					console.log(dim('  No parent tasks'))
					return
				}

				console.log(
					table(parents.map((t) => [dim(t.id), badge(t.status, statusColor(t.status)), t.title])),
				)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('rollup')
		.description('Show child status rollup for a parent task')
		.argument('<id>', 'Parent task ID')
		.option('--relation <type>', 'Filter by relation type')
		.action(async (id: string, opts: { relation?: string }) => {
			try {
				const client = createApiClient()
				const query: Record<string, string> = {}
				if (opts.relation) query.relation_type = opts.relation

				const res = await client.api.tasks[':id'].rollup.$get({ param: { id }, query })
				if (!res.ok) {
					console.error(error(`Failed to fetch rollup for task ${id}`))
					process.exit(1)
				}

				const rollup = (await res.json()) as ChildRollup

				console.log(section(`Rollup for ${id}`))
				if (rollup.total === 0) {
					console.log(dim('  No child tasks'))
					return
				}

				console.log(`  ${dim('Total:')}     ${rollup.total}`)
				if (rollup.done > 0) console.log(`  ${dot('green')} Done:      ${rollup.done}`)
				if (rollup.active > 0) console.log(`  ${dot('cyan')} Active:    ${rollup.active}`)
				if (rollup.blocked > 0) console.log(`  ${dot('yellow')} Blocked:   ${rollup.blocked}`)
				if (rollup.failed > 0) console.log(`  ${dot('red')} Failed:    ${rollup.failed}`)
				if (rollup.backlog > 0) console.log(`  ${dim('○')} Backlog:   ${rollup.backlog}`)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Progress Subcommand ─────────────────────────────────────────────────

interface RunSummary {
	id: string
	status: string
	agent_id: string
	task_id?: string | null
	instructions?: string | null
	summary?: string | null
	initiated_by?: string | null
	started_at?: string | null
	ended_at?: string | null
	created_at: string
	error?: string | null
}

interface WorkflowStepDef {
	id: string
	name?: string
	type: string
	agent_id?: string
	instructions?: string
}

interface WorkflowDef {
	id: string
	name: string
	description?: string
	steps: WorkflowStepDef[]
}

/** A single row in the progress timeline. */
interface TimelineEntry {
	stepId: string
	label: string
	status: 'done' | 'empty' | 'running' | 'pending' | 'failed'
	run?: RunSummary
	annotation?: string
	isHumanApproval?: boolean
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text
	return text.slice(0, maxLen - 3) + '...'
}

function formatDuration(startedAt: string | null | undefined, endedAt: string | null | undefined): string {
	if (!startedAt) return ''
	const start = new Date(startedAt).getTime()
	const end = endedAt ? new Date(endedAt).getTime() : Date.now()
	const diffMs = end - start
	if (diffMs < 0) return ''

	const totalSec = Math.floor(diffMs / 1000)
	if (totalSec < 60) return `${totalSec}s`
	const min = Math.floor(totalSec / 60)
	const sec = totalSec % 60
	if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`
	const hr = Math.floor(min / 60)
	const remainMin = min % 60
	return remainMin > 0 ? `${hr}h ${remainMin}m` : `${hr}h`
}

function shortRunId(id: string): string {
	// run-1234567890-abcdef012345 → run-abcd…
	if (id.length > 12) return id.slice(0, 10) + '\u2026'
	return id
}

/**
 * Build timeline entries by reconstructing which workflow step each run executed.
 *
 * Strategy: walk runs in chronological order, simulating the workflow step
 * progression. For each run we track the "current step pointer" and detect
 * revision loops (going backward), retries (same step), and normal advances.
 */
function buildTimeline(
	steps: WorkflowStepDef[],
	taskRuns: RunSummary[],
	currentStep: string | null,
	metadata: Record<string, unknown>,
): TimelineEntry[] {
	const entries: TimelineEntry[] = []
	const stepIndex = new Map(steps.map((s, i) => [s.id, i]))

	// Sort runs by created_at ascending
	const sortedRuns = [...taskRuns]
		.filter((r) => r.initiated_by === 'workflow-engine' || r.initiated_by === 'system')
		.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

	// Track how many times each step has been visited
	const stepVisits = new Map<string, number>()
	let pointer = 0 // index into steps array

	for (const run of sortedRuns) {
		// Try to figure out which step this run belongs to.
		// Heuristic: check if the run's instructions contain any step's instructions.
		let matchedStepIdx = -1

		// First try matching by instruction content
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]!
			if (step.type !== 'agent') continue
			if (step.instructions && run.instructions?.includes(step.instructions)) {
				matchedStepIdx = i
				break
			}
		}

		// If no match by instructions, assume it's the step at the current pointer
		if (matchedStepIdx === -1) {
			// If this run is after some completed runs, try advancing the pointer
			matchedStepIdx = pointer
		}

		const step = steps[matchedStepIdx]
		if (!step) continue

		const visits = (stepVisits.get(step.id) ?? 0) + 1
		stepVisits.set(step.id, visits)

		// Determine if this is a revision or retry
		const isRevision = matchedStepIdx < pointer
		const isRetry = matchedStepIdx === pointer && visits > 1
		const isEmpty = !run.summary || run.summary.trim() === '' || /^(no output|empty|n\/a|completed? with no output)$/i.test(run.summary?.trim() ?? '')

		let label = step.id
		if (isRevision) label = `${step.id} (revision)`
		else if (isRetry) label = `${step.id} (retry)`

		let status: TimelineEntry['status'] = 'done'
		if (run.status === 'running' || run.status === 'claimed') {
			status = 'running'
		} else if (run.status === 'failed') {
			status = 'failed'
		} else if (isEmpty && (run.status === 'completed')) {
			status = 'empty'
		}

		entries.push({ stepId: step.id, label, status, run })

		// Add revision annotation if validate step sent us back
		if (isRevision && entries.length >= 2) {
			const prevEntry = entries[entries.length - 2]
			if (prevEntry && prevEntry.run?.summary) {
				// Look for revision reason in metadata
				const revKey = Object.keys(metadata).find(
					(k) => k.startsWith('_revisions:') && k.includes(step.id),
				)
				if (revKey) {
					const reason = prevEntry.run.summary
					entries.splice(entries.length - 1, 0, {
						stepId: prevEntry.stepId,
						label: `  \u21b3 revision ${visits - 1}`,
						status: 'done',
						annotation: truncate(reason, 80),
					})
				}
			}
		}

		if (isEmpty && run.status === 'completed') {
			entries.push({
				stepId: step.id,
				label: `  \u21b3 retry (empty output)`,
				status: 'empty',
			})
		}

		// Advance pointer
		if (!isRevision && run.status === 'completed' && !isEmpty) {
			// Move pointer to the next step
			pointer = matchedStepIdx + 1
		} else if (isRevision) {
			// Revision: pointer goes back to matched step
			pointer = matchedStepIdx
		}
	}

	// Add remaining pending steps
	for (let i = pointer; i < steps.length; i++) {
		const step = steps[i]!
		// Skip if the step is the current running step already in entries
		const alreadyShown = entries.some(
			(e) => e.stepId === step.id && (e.status === 'running' || e.status === 'pending'),
		)
		if (alreadyShown) continue

		const isCurrent = step.id === currentStep
		if (isCurrent) {
			// Current step might be running without a run yet (e.g. human_approval)
			const hasRunning = entries.some((e) => e.stepId === step.id && e.status === 'running')
			if (!hasRunning) {
				entries.push({
					stepId: step.id,
					label: step.id,
					status: 'pending',
					isHumanApproval: step.type === 'human_approval',
				})
			}
		} else {
			entries.push({
				stepId: step.id,
				label: step.type === 'done' ? 'done' : step.id,
				status: 'pending',
				isHumanApproval: step.type === 'human_approval',
			})
		}
	}

	return entries
}

tasksCmd.addCommand(
	new Command('progress')
		.description('Show workflow step timeline with revision loops and summaries')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				// 1. Fetch task
				const taskRes = await client.api.tasks[':id'].$get({ param: { id } })
				if (!taskRes.ok) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				const task = (await taskRes.json()) as {
					id: string
					title: string
					status: string
					workflow_id?: string | null
					workflow_step?: string | null
					metadata?: string | null
				}

				if (!task.workflow_id) {
					console.error(error(`Task ${id} has no workflow attached`))
					process.exit(1)
				}

				// 2. Fetch workflow definition
				const authHeaders: Record<string, string> = { ...getAuthHeaders() }
				if (Object.keys(authHeaders).length === 0) authHeaders['X-Local-Dev'] = 'true'
				const wfRes = await fetch(`${getBaseUrl()}/api/config/workflows`, {
					headers: authHeaders,
				})
				if (!wfRes.ok) {
					console.error(error('Failed to fetch workflow definitions'))
					process.exit(1)
				}
				const workflows = (await wfRes.json()) as WorkflowDef[]
				const workflow = workflows.find((w) => w.id === task.workflow_id)
				if (!workflow) {
					console.error(error(`Workflow not found: ${task.workflow_id}`))
					process.exit(1)
				}

				// 3. Fetch all runs for this task
				const runsRes = await client.api.runs.$get({ query: { task_id: id } })
				if (!runsRes.ok) {
					console.error(error('Failed to fetch runs'))
					process.exit(1)
				}
				const taskRuns = (await runsRes.json()) as RunSummary[]

				// 4. Parse metadata for revision info
				let metadata: Record<string, unknown> = {}
				try {
					metadata = JSON.parse(task.metadata ?? '{}')
				} catch (err) {
					console.debug('[progress] malformed task metadata:', err instanceof Error ? err.message : String(err))
				}

				// 5. Build and render timeline
				const entries = buildTimeline(
					workflow.steps,
					taskRuns,
					task.workflow_step ?? null,
					metadata,
				)

				// ── Header ──
				console.log('')
				console.log(
					`  ${header(task.title)}  ${badge(task.status, statusColor(task.status))}${task.workflow_step ? ` ${dim('\u2192 ' + task.workflow_step)}` : ''}`,
				)
				console.log('')

				// ── Column headers ──
				const colStep = 'Step'
				const colStatus = 'Status'
				const colRun = 'Run'
				const colDur = 'Duration'
				const colSummary = 'Summary'
				console.log(
					dim(
						`  ${colStep.padEnd(26)}${colStatus.padEnd(11)}${colRun.padEnd(17)}${colDur.padEnd(10)}${colSummary}`,
					),
				)
				console.log(dim(`  ${'\u2500'.repeat(76)}`))

				// ── Timeline rows ──
				for (const entry of entries) {
					// Annotation-only rows (revision arrows)
					if (entry.annotation !== undefined && !entry.run) {
						console.log(
							`  ${dim(entry.label.padEnd(26))}${''.padEnd(11)}${''.padEnd(17)}${''.padEnd(10)}${dim('"' + entry.annotation + '"')}`,
						)
						continue
					}

					// Status icon + text
					let statusIcon: string
					let statusText: string
					switch (entry.status) {
						case 'done':
							statusIcon = success('\u2713')
							statusText = success('done')
							break
						case 'empty':
							statusIcon = warning('\u26a0')
							statusText = warning('empty')
							break
						case 'running':
							statusIcon = '\u{1f504}'
							statusText = badge('run', 'cyan')
							break
						case 'failed':
							statusIcon = error('\u2717')
							statusText = error('fail')
							break
						case 'pending':
						default:
							statusIcon = dim('\u25cb')
							statusText = dim('pending')
							break
					}

					const stepLabel = (entry.status === 'pending' || (entry.status === 'done' && !entry.run))
						? `${statusIcon} ${dim(entry.label)}`
						: `${statusIcon} ${entry.label}`

					const runId = entry.run ? dim(shortRunId(entry.run.id)) : ''
					const duration = entry.run
						? formatDuration(entry.run.started_at, entry.run.ended_at)
						: ''

					let summaryText = ''
					if (entry.run?.summary) {
						summaryText = truncate(entry.run.summary.replace(/\n/g, ' '), 100)
					} else if (entry.run && entry.status === 'empty') {
						summaryText = dim('[no output]')
					} else if (entry.isHumanApproval) {
						summaryText = dim('(human approval)')
					} else if (entry.run?.status === 'running') {
						summaryText = dim('Running...')
					}

					// Build the padded row — account for ANSI escape sequences in padding
					const stepColWidth = 26
					const statusColWidth = 11
					const runColWidth = 17
					const durColWidth = 10

					const stepVisible = stripAnsi(stepLabel).length
					const stepPadded = stepLabel + ' '.repeat(Math.max(0, stepColWidth - stepVisible))

					const statusVisible = stripAnsi(statusText).length
					const statusPadded = statusText + ' '.repeat(Math.max(0, statusColWidth - statusVisible))

					const runVisible = stripAnsi(runId).length
					const runPadded = runId + ' '.repeat(Math.max(0, runColWidth - runVisible))

					const durPadded = duration.padEnd(durColWidth)

					console.log(`  ${stepPadded}${statusPadded}${runPadded}${durPadded}${summaryText}`)
				}

				// ── Footer ──
				console.log('')
				console.log(dim(`  Branch: autopilot/${task.id}`))
				console.log(dim(`  Worktree: .worktrees/${task.id}`))

				// Show revision counts from metadata
				const revisionKeys = Object.keys(metadata).filter((k) => k.startsWith('_revisions:'))
				if (revisionKeys.length > 0) {
					const parts = revisionKeys.map((k) => {
						const loop = k.replace('_revisions:', '')
						const count = metadata[k] as number
						return `${loop.replace('\u2192', '\u2192')}: ${count}/3`
					})
					console.log(dim(`  Revisions: ${parts.join(', ')}`))
				}
				console.log('')
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── Helpers ──────────────────────────────────────────────────────────────

function statusColor(status: string): string {
	if (status === 'done') return 'green'
	if (status === 'failed') return 'red'
	if (status === 'blocked') return 'yellow'
	return 'cyan'
}

function countStatuses(tasks: TaskSummary[]): ChildRollup {
	const r: ChildRollup = {
		total: tasks.length,
		active: 0,
		blocked: 0,
		done: 0,
		failed: 0,
		backlog: 0,
	}
	for (const t of tasks) {
		if (t.status === 'done') r.done++
		else if (t.status === 'failed') r.failed++
		else if (t.status === 'blocked') r.blocked++
		else if (t.status === 'backlog' || t.status === 'pending') r.backlog++
		else r.active++
	}
	return r
}

function printRollupLine(r: ChildRollup): void {
	const parts: string[] = []
	if (r.done > 0) parts.push(`${r.done} done`)
	if (r.active > 0) parts.push(`${r.active} active`)
	if (r.blocked > 0) parts.push(`${r.blocked} blocked`)
	if (r.failed > 0) parts.push(`${r.failed} failed`)
	if (r.backlog > 0) parts.push(`${r.backlog} backlog`)
	console.log(dim(`  ${r.total} children: ${parts.join(', ')}`))
}

/** Check if a blocked task has children via the rollup endpoint (ground truth). */
async function getChildCount(
	client: ReturnType<typeof createApiClient>,
	taskId: string,
): Promise<number> {
	try {
		const res = await client.api.tasks[':id'].rollup.$get({ param: { id: taskId }, query: {} })
		if (!res.ok) return 0
		const rollup = (await res.json()) as ChildRollup
		return rollup.total
	} catch (err) {
		console.debug('[tasks] rollup fetch failed:', err instanceof Error ? err.message : String(err))
		return 0
	}
}

async function printRollupSummary(
	client: ReturnType<typeof createApiClient>,
	taskId: string,
): Promise<void> {
	try {
		const res = await client.api.tasks[':id'].rollup.$get({ param: { id: taskId }, query: {} })
		if (!res.ok) return

		const rollup = (await res.json()) as ChildRollup
		if (rollup.total === 0) {
			console.log(dim('  No child tasks found'))
			return
		}

		const parts: string[] = []
		if (rollup.done > 0) parts.push(`${rollup.done} done`)
		if (rollup.active > 0) parts.push(`${rollup.active} active`)
		if (rollup.failed > 0) parts.push(`${rollup.failed} failed`)
		if (rollup.blocked > 0) parts.push(`${rollup.blocked} blocked`)
		if (rollup.backlog > 0) parts.push(`${rollup.backlog} backlog`)

		console.log(dim(`  Children: ${rollup.total} (${parts.join(', ')})`))
		console.log(dim(`  Use: autopilot tasks children ${taskId}`))
	} catch (err) {
		console.debug('[tasks] rollup summary fetch failed:', err instanceof Error ? err.message : String(err))
	}
}

/** Show the last completed run's summary for a task (useful for blocked tasks). */
async function printLastRunSummary(
	client: ReturnType<typeof createApiClient>,
	taskId: string,
): Promise<void> {
	try {
		const runsRes = await client.api.runs.$get({ query: { task_id: taskId, status: 'completed' } })
		if (!runsRes.ok) return

		const runs = (await runsRes.json()) as Array<{
			id: string
			summary?: string | null
			ended_at?: string | null
		}>
		const lastRun = runs[runs.length - 1]
		if (lastRun?.summary) {
			console.log('')
			console.log(dim('Last run summary:'))
			console.log(`  ${lastRun.summary.slice(0, 300)}`)
		}
	} catch (err) {
		console.debug('[tasks] last run summary fetch failed:', err instanceof Error ? err.message : String(err))
	}
}

program.addCommand(tasksCmd)
