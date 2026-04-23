import { Command } from 'commander'
import { program } from '../program'
import { createApiClient, getBaseUrl } from '../utils/client'
import {
	badge,
	dim,
	dot,
	error,
	header,
	section,
	separator,
	stripAnsi,
	success,
	table,
	warning,
} from '../utils/format'
import { LiveRenderer } from '../utils/live-renderer'
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

interface RegisteredProject {
	id: string
	path: string
}

function projectHeaders(): Record<string, string> {
	const headers: Record<string, string> = { ...getAuthHeaders() }
	if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'
	return headers
}

async function detectProjectIdFromCwd(baseUrl = getBaseUrl()): Promise<string | undefined> {
	const cwd = process.cwd()
	const res = await fetch(`${baseUrl}/api/projects`, { headers: projectHeaders() }).catch(
		() => null,
	)
	if (!res?.ok) return undefined

	const projects = (await res.json()) as RegisteredProject[]
	const match = projects
		.filter((project) => cwd === project.path || cwd.startsWith(`${project.path}/`))
		.sort((a, b) => b.path.length - a.path.length)[0]

	return match?.id
}

const tasksCmd = new Command('task')
	.description('List and manage tasks')
	.option('-s, --status <status>', 'Filter by task status')
	.option('-a, --assigned <agent>', 'Filter by assigned agent ID')
	.option('-p, --project <id>', 'Filter by project ID')
	.action(async (opts: { status?: string; assigned?: string; project?: string }) => {
		try {
			const client = createApiClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.assigned) query.assigned_to = opts.assigned
			const projectId = opts.project ?? (await detectProjectIdFromCwd())
			if (projectId) query.project_id = projectId

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
		.option('-p, --project <id>', 'Project ID override')
		.option('--priority <priority>', 'Priority (low, medium, high, critical)')
		.option('--assign <agent>', 'Assign to agent ID')
		.option('--queue <name>', 'Task queue for concurrency control')
		.option('--start-after <datetime>', 'ISO datetime — task will not start before this time')
		.option('--depends-on <ids...>', 'Task IDs this task depends on')
		.action(
			async (opts: {
				title: string
				type: string
				description?: string
				project?: string
				priority?: string
				assign?: string
				queue?: string
				startAfter?: string
				dependsOn?: string[]
			}) => {
				try {
					const client = createApiClient()
					const projectId = opts.project ?? (await detectProjectIdFromCwd())

					const res = await client.api.tasks.$post({
						json: {
							title: opts.title,
							type: opts.type,
							description: opts.description,
							project_id: projectId,
							priority: opts.priority,
							assigned_to: opts.assign,
							queue: opts.queue,
							start_after: opts.startAfter,
							depends_on: opts.dependsOn,
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
	new Command('delete')
		.description('Delete a task and all associated data (runs, events, artifacts, relations)')
		.argument('<id>', 'Task ID')
		.option('-f, --force', 'Skip confirmation prompt')
		.action(async (id: string, opts: { force?: boolean }) => {
			try {
				const client = createApiClient()

				if (!opts.force) {
					// Fetch task first to show title in confirmation
					const taskRes = await client.api.tasks[':id'].$get({ param: { id } })
					if (!taskRes.ok) {
						console.error(error(`Task not found: ${id}`))
						process.exit(1)
					}
					const task = (await taskRes.json()) as { id: string; title: string }

					const answer = prompt(`Delete task "${task.title}"? (y/n) `)
					if (answer?.toLowerCase() !== 'y') {
						console.log(dim('Cancelled'))
						return
					}
				}

				const res = await client.api.tasks[':id'].$delete({
					param: { id },
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error?: string
					}
					console.error(error(body.error ?? `Failed to delete task: ${id}`))
					process.exit(1)
				}

				const deleted = (await res.json()) as { id: string; title: string }
				console.log(success(`Task deleted: ${deleted.id}`))
				console.log(dim(`  ${deleted.title}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
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
	lastEvent?: string
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text
	return `${text.slice(0, maxLen - 3)}...`
}

function formatDuration(
	startedAt: string | null | undefined,
	endedAt: string | null | undefined,
): string {
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
	if (id.length > 12) return `${id.slice(0, 10)}\u2026`
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
		const isEmpty =
			!run.summary ||
			run.summary.trim() === '' ||
			/^(no output|empty|n\/a|completed? with no output)$/i.test(run.summary?.trim() ?? '')

		let label = step.id
		if (isRevision) label = `${step.id} (revision)`
		else if (isRetry) label = `${step.id} (retry)`

		let status: TimelineEntry['status'] = 'done'
		if (run.status === 'running' || run.status === 'claimed') {
			status = 'running'
		} else if (run.status === 'failed') {
			status = 'failed'
		} else if (isEmpty && run.status === 'completed') {
			status = 'empty'
		}

		entries.push({ stepId: step.id, label, status, run })

		// Add revision annotation if validate step sent us back
		if (isRevision && entries.length >= 2) {
			const prevEntry = entries[entries.length - 2]
			if (prevEntry?.run?.summary) {
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
				label: '  \u21b3 retry (empty output)',
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

// ── Progress rendering (pure function — returns lines, no side effects) ─────

interface ProgressData {
	task: {
		id: string
		title: string
		status: string
		workflow_id?: string | null
		workflow_step?: string | null
		metadata?: string | null
	}
	workflow: WorkflowDef
	taskRuns: RunSummary[]
	/** Last SSE event summary for the currently running step */
	runningEventSummary?: string
}

function renderProgressLines(data: ProgressData): string[] {
	const { task, workflow, taskRuns, runningEventSummary } = data
	const lines: string[] = []

	// Parse metadata for revision info
	let metadata: Record<string, unknown> = {}
	try {
		metadata = JSON.parse(task.metadata ?? '{}')
	} catch (err) {
		// malformed metadata — ignore
		void err
	}

	// Build timeline
	const entries = buildTimeline(workflow.steps, taskRuns, task.workflow_step ?? null, metadata)

	// Inject last event summary into running entry
	const runningEntry = entries.find((e) => e.status === 'running' && e.run)
	if (runningEntry && runningEventSummary) {
		runningEntry.lastEvent = truncate(runningEventSummary.replace(/\n/g, ' '), 90)
	}

	// ── Header ──
	lines.push('')
	lines.push(
		`  ${header(task.title)}  ${badge(task.status, statusColor(task.status))}${task.workflow_step ? ` ${dim(`\u2192 ${task.workflow_step}`)}` : ''}`,
	)
	lines.push('')

	// ── Column headers ──
	lines.push(
		dim(
			`  ${'Step'.padEnd(26)}${'Status'.padEnd(11)}${'Run'.padEnd(17)}${'Duration'.padEnd(10)}Summary`,
		),
	)
	lines.push(dim(`  ${'\u2500'.repeat(76)}`))

	// ── Timeline rows ──
	for (const entry of entries) {
		// Annotation-only rows (revision arrows)
		if (entry.annotation !== undefined && !entry.run) {
			lines.push(
				`  ${dim(entry.label.padEnd(26))}${''.padEnd(11)}${''.padEnd(17)}${''.padEnd(10)}${dim(`"${entry.annotation}"`)}`,
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
			default:
				statusIcon = dim('\u25cb')
				statusText = dim('pending')
				break
		}

		const stepLabel =
			entry.status === 'pending' || (entry.status === 'done' && !entry.run)
				? `${statusIcon} ${dim(entry.label)}`
				: `${statusIcon} ${entry.label}`

		const runId = entry.run ? dim(shortRunId(entry.run.id)) : ''
		const duration = entry.run ? formatDuration(entry.run.started_at, entry.run.ended_at) : ''

		let summaryText = ''
		if (entry.run?.summary) {
			summaryText = truncate(entry.run.summary.replace(/\n/g, ' '), 100)
		} else if (entry.run && entry.status === 'empty') {
			summaryText = dim('[no output]')
		} else if (entry.isHumanApproval) {
			summaryText = dim('(human approval)')
		} else if (entry.run?.status === 'running') {
			summaryText = dim(entry.lastEvent ?? 'Running...')
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

		lines.push(`  ${stepPadded}${statusPadded}${runPadded}${durPadded}${summaryText}`)
	}

	// ── Footer ──
	const revisionKeys = Object.keys(metadata).filter((k) => k.startsWith('_revisions:'))

	lines.push('')
	lines.push(dim(`  Branch: autopilot/${task.id}`))
	lines.push(dim(`  Worktree: .worktrees/${task.id}`))
	if (revisionKeys.length > 0) {
		const parts = revisionKeys.map((k) => {
			const loop = k.replace('_revisions:', '')
			const count = typeof metadata[k] === 'number' ? metadata[k] : 0
			return `${loop.replace('\u2192', '\u2192')}: ${count}/3`
		})
		lines.push(dim(`  Revisions: ${parts.join(', ')}`))
	}
	lines.push('')

	return lines
}

// ── Progress data fetching ──────────────────────────────────────────────────

interface FetchProgressResult {
	task: ProgressData['task']
	workflow: WorkflowDef
	taskRuns: RunSummary[]
	runIds: Set<string>
	hasRunningStep: boolean
}

async function fetchProgressData(
	client: ReturnType<typeof createApiClient>,
	taskId: string,
	authHeaders: Record<string, string>,
): Promise<FetchProgressResult | null> {
	const taskRes = await client.api.tasks[':id'].$get({ param: { id: taskId } })
	if (!taskRes.ok) return null

	const task = (await taskRes.json()) as ProgressData['task']

	if (!task.workflow_id) return null

	// Raw fetch: /api/config/* routes are defined inline on the Hono app,
	// not via .route(), so they are not part of the typed AppType chain.
	const baseUrl = getBaseUrl()
	const wfRes = await fetch(`${baseUrl}/api/config/workflows`, { headers: authHeaders })
	if (!wfRes.ok) return null

	const workflows = (await wfRes.json()) as WorkflowDef[]
	const workflow = workflows.find((w) => w.id === task.workflow_id)
	if (!workflow) return null

	const runsRes = await client.api.runs.$get({ query: { task_id: taskId } })
	if (!runsRes.ok) return null

	const taskRuns = (await runsRes.json()) as RunSummary[]
	const runIds = new Set(taskRuns.map((r) => r.id))
	const hasRunningStep = taskRuns.some((r) => r.status === 'running' || r.status === 'claimed')

	return { task, workflow, taskRuns, runIds, hasRunningStep }
}

/** Fetch the last event summary for a running run. */
async function fetchLastEventSummary(
	client: ReturnType<typeof createApiClient>,
	runId: string,
): Promise<string | undefined> {
	try {
		const eventsRes = await client.api.runs[':id'].events.$get({ param: { id: runId } })
		if (!eventsRes.ok) return undefined

		const events = (await eventsRes.json()) as Array<{ type: string; summary?: string }>
		const last = events.filter((e) => e.type === 'progress' || e.type === 'tool_use').pop()
		if (last?.summary) return last.summary
	} catch (err) {
		void err
	}
	return undefined
}

/** Check if a task status is terminal (no more progress expected). */
function isTerminalState(status: string, hasRunningStep: boolean): boolean {
	if (hasRunningStep) return false
	return status === 'done' || status === 'failed' || status === 'blocked'
}

// ── Progress command ────────────────────────────────────────────────────────

tasksCmd.addCommand(
	new Command('progress')
		.description('Show workflow step timeline with revision loops and summaries')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()
				const authHeaders: Record<string, string> = { ...getAuthHeaders() }
				if (Object.keys(authHeaders).length === 0) authHeaders['X-Local-Dev'] = 'true'

				// ── Initial fetch ──
				const progressData = await fetchProgressData(client, id, authHeaders)
				if (!progressData) {
					console.error(error(`Task not found or has no workflow: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				const { task, workflow, taskRuns, runIds, hasRunningStep } = progressData

				// Fetch initial last event for running step
				const runningRun = taskRuns.find((r) => r.status === 'running' || r.status === 'claimed')
				let runningEventSummary: string | undefined
				if (runningRun) {
					runningEventSummary = await fetchLastEventSummary(client, runningRun.id)
				}

				// ── Initial render ──
				const renderer = new LiveRenderer()
				const initialLines = renderProgressLines({ task, workflow, taskRuns, runningEventSummary })
				renderer.render(initialLines)

				// If already terminal, exit immediately
				if (isTerminalState(task.status, hasRunningStep)) {
					return
				}

				// ── SSE live loop ──
				const baseUrl = getBaseUrl()
				const controller = new AbortController()

				process.on('SIGINT', () => {
					controller.abort()
					process.stdout.write('\n')
					process.exit(0)
				})

				// Throttle: track last render time
				let lastRenderTime = Date.now()
				let pendingRender = false
				let renderTimeout: ReturnType<typeof setTimeout> | null = null

				// Mutable state for the live loop
				let currentRunIds = runIds
				let currentEventSummary = runningEventSummary

				const doRender = async (full: boolean): Promise<boolean> => {
					try {
						if (full) {
							const freshData = await fetchProgressData(client, id, authHeaders)
							if (!freshData) return false

							currentRunIds = freshData.runIds

							// Fetch last event for running step
							const freshRunning = freshData.taskRuns.find(
								(r) => r.status === 'running' || r.status === 'claimed',
							)
							if (freshRunning) {
								const evtSummary = await fetchLastEventSummary(client, freshRunning.id)
								if (evtSummary) currentEventSummary = evtSummary
							} else {
								currentEventSummary = undefined
							}

							const lines = renderProgressLines({
								task: freshData.task,
								workflow: freshData.workflow,
								taskRuns: freshData.taskRuns,
								runningEventSummary: currentEventSummary,
							})

							if (isTerminalState(freshData.task.status, freshData.hasRunningStep)) {
								renderer.finish(lines)
								return true // signal: terminal
							}

							renderer.render(lines)
						} else {
							// Lightweight re-render with updated event summary only
							const freshData = await fetchProgressData(client, id, authHeaders)
							if (!freshData) return false

							currentRunIds = freshData.runIds

							const lines = renderProgressLines({
								task: freshData.task,
								workflow: freshData.workflow,
								taskRuns: freshData.taskRuns,
								runningEventSummary: currentEventSummary,
							})

							if (isTerminalState(freshData.task.status, freshData.hasRunningStep)) {
								renderer.finish(lines)
								return true
							}

							renderer.render(lines)
						}
					} catch (err) {
						void err
					}
					return false
				}

				const scheduleRender = (full: boolean): void => {
					const now = Date.now()
					const elapsed = now - lastRenderTime
					const MIN_INTERVAL = 1000

					if (elapsed >= MIN_INTERVAL && !pendingRender) {
						pendingRender = true
						lastRenderTime = now
						doRender(full)
							.then((terminal) => {
								pendingRender = false
								if (terminal) {
									controller.abort()
								}
							})
							.catch(() => {
								pendingRender = false
							})
					} else if (!renderTimeout) {
						// Schedule a deferred render
						const delay = MIN_INTERVAL - elapsed
						renderTimeout = setTimeout(() => {
							renderTimeout = null
							lastRenderTime = Date.now()
							pendingRender = true
							doRender(full)
								.then((terminal) => {
									pendingRender = false
									if (terminal) {
										controller.abort()
									}
								})
								.catch(() => {
									pendingRender = false
								})
						}, delay)
					}
				}

				// SSE connection with reconnection
				const connectSSE = async (): Promise<void> => {
					while (!controller.signal.aborted) {
						try {
							const sseRes = await fetch(`${baseUrl}/api/events`, {
								headers: authHeaders,
								signal: controller.signal,
							})
							if (!sseRes.ok || !sseRes.body) {
								// Wait before reconnecting
								await new Promise((resolve) => setTimeout(resolve, 3000))
								continue
							}

							const reader = sseRes.body.getReader()
							const decoder = new TextDecoder()
							let buffer = ''

							while (!controller.signal.aborted) {
								const { done, value } = await reader.read()
								if (done) break

								buffer += decoder.decode(value, { stream: true })
								const sseLines = buffer.split('\n')
								buffer = sseLines.pop() ?? ''

								for (const line of sseLines) {
									if (!line.startsWith('data: ')) continue
									const json = line.slice(6)

									try {
										const event = JSON.parse(json) as {
											type: string
											runId?: string
											taskId?: string
											status?: string
											eventType?: string
											summary?: string
											agentId?: string
										}

										if (event.type === 'heartbeat') continue

										// run_event: update the running step's last event summary
										if (
											event.type === 'run_event' &&
											event.runId &&
											currentRunIds.has(event.runId)
										) {
											if (event.summary) {
												currentEventSummary = event.summary
											}
											scheduleRender(false)
											continue
										}

										// run_started / run_completed: full re-render (step progression)
										if (
											(event.type === 'run_started' || event.type === 'run_completed') &&
											event.runId &&
											currentRunIds.has(event.runId)
										) {
											scheduleRender(true)
											continue
										}

										// task_changed: full re-render if it's our task
										if (event.type === 'task_changed' && event.taskId === id) {
											scheduleRender(true)
											continue
										}

										// A new run might have been started for our task that we don't
										// know about yet — pick it up on the next full render triggered
										// by run_started with an unknown runId. We can't filter by
										// task here since run_started only has runId + agentId, so
										// do a speculative full render for any unrecognized run_started.
										if (
											event.type === 'run_started' &&
											event.runId &&
											!currentRunIds.has(event.runId)
										) {
											scheduleRender(true)
										}
									} catch (err) {
										void err
									}
								}
							}
						} catch (err) {
							if (controller.signal.aborted) return
							void err
							// Reconnect after delay
							await new Promise((resolve) => setTimeout(resolve, 3000))
						}
					}
				}

				await connectSSE()

				// Clean up timeout if any
				if (renderTimeout) clearTimeout(renderTimeout)
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
		console.debug(
			'[tasks] rollup summary fetch failed:',
			err instanceof Error ? err.message : String(err),
		)
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
		console.debug(
			'[tasks] last run summary fetch failed:',
			err instanceof Error ? err.message : String(err),
		)
	}
}

// ─── Dependency Subcommands ──────────────────────────────────────────────

tasksCmd.addCommand(
	new Command('depend')
		.description('Add dependencies to a task')
		.argument('<id>', 'Task ID')
		.requiredOption('--on <ids...>', 'Task IDs this task depends on')
		.action(async (id: string, opts: { on: string[] }) => {
			try {
				const client = createApiClient()

				const res = await client.api.tasks[':id'].dependencies.$post({
					param: { id },
					json: { depends_on: opts.on },
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error?: string
					}
					console.error(error(body.error ?? `Failed to add dependencies to task ${id}`))
					process.exit(1)
				}

				const result = (await res.json()) as {
					task_id: string
					dependencies: Array<{ depends_on: string; status: string }>
				}

				console.log(section(`Dependencies for ${id}`))
				for (const dep of result.dependencies) {
					const icon =
						dep.status === 'added'
							? success('+')
							: dep.status === 'cycle_detected'
								? error('!')
								: dim('?')
					console.log(`  ${icon} ${dep.depends_on} — ${dep.status}`)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('dependencies')
		.description('List tasks this task depends on')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			try {
				const client = createApiClient()

				const res = await client.api.tasks[':id'].dependencies.$get({
					param: { id },
				})

				if (!res.ok) {
					console.error(error(`Failed to fetch dependencies for task ${id}`))
					process.exit(1)
				}

				const deps = (await res.json()) as TaskSummary[]

				console.log(section(`Dependencies of ${id}`))
				if (deps.length === 0) {
					console.log(dim('  No dependencies'))
					return
				}

				console.log(
					table(deps.map((t) => [dim(t.id), badge(t.status, statusColor(t.status)), t.title])),
				)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(tasksCmd)
