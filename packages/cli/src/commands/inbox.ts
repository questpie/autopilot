/**
 * CLI inbox — actionable operator view over existing task/run/artifact state.
 *
 * `autopilot inbox`          — snapshot of items needing attention
 * `autopilot inbox --watch`  — live SSE stream of actionable changes
 */
import { Command } from 'commander'
import { program } from '../program'
import { section, badge, dim, error, separator, warning, success } from '../utils/format'
import { createApiClient, getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
	id: string
	title: string
	status: string
	type: string
	assigned_to?: string | null
	workflow_id?: string | null
	workflow_step?: string | null
	updated_at?: string
}

interface Run {
	id: string
	status: string
	agent_id: string
	task_id?: string | null
	summary?: string | null
	error?: string | null
	ended_at?: string | null
	created_at: string
}

interface Artifact {
	kind: string
	title: string
	ref_kind: string
	ref_value: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string): string {
	switch (status) {
		case 'blocked': return badge('BLOCKED', 'red')
		case 'failed': return badge('FAILED', 'red')
		case 'completed': return badge('COMPLETED', 'green')
		case 'running': return badge('RUNNING', 'cyan')
		default: return badge(status, 'yellow')
	}
}

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime()
	const mins = Math.floor(diff / 60_000)
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins}m ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}

// ─── Inbox Snapshot ──────────────────────────────────────────────────────────

async function renderInbox(): Promise<void> {
	const client = createApiClient()

	// Fetch blocked tasks + failed runs + recently completed runs in parallel
	const [tasksRes, failedRunsRes, completedRunsRes] = await Promise.all([
		client.api.tasks.$get({ query: { status: 'blocked' } }),
		client.api.runs.$get({ query: { status: 'failed' } }),
		client.api.runs.$get({ query: { status: 'completed' } }),
	])

	if (!tasksRes.ok || !failedRunsRes.ok || !completedRunsRes.ok) {
		console.error(error('Failed to fetch inbox data'))
		process.exit(1)
	}

	const blockedTasks = (await tasksRes.json()) as Task[]
	const failedRuns = (await failedRunsRes.json()) as Run[]
	const allCompleted = (await completedRunsRes.json()) as Run[]

	// Only show recently completed runs (last 24h) that have preview URLs
	const recentCutoff = Date.now() - 24 * 60 * 60 * 1000
	const recentCompleted = allCompleted.filter(
		(r) => r.ended_at && new Date(r.ended_at).getTime() > recentCutoff,
	)

	// Fetch preview URLs for recent completed runs
	const previewMap = new Map<string, string>()
	for (const run of [...recentCompleted, ...failedRuns]) {
		try {
			const artsRes = await client.api.runs[':id'].artifacts.$get({ param: { id: run.id } })
			if (artsRes.ok) {
				const arts = (await artsRes.json()) as Artifact[]
				const preview = arts.find((a) => a.kind === 'preview_url')
				if (preview) previewMap.set(run.id, preview.ref_value)
			}
		} catch { /* skip */ }
	}

	// Fetch task titles for runs
	const taskTitles = new Map<string, string>()
	const taskIds = new Set<string>()
	for (const r of [...failedRuns, ...recentCompleted]) {
		if (r.task_id) taskIds.add(r.task_id)
	}
	for (const tid of taskIds) {
		try {
			const tRes = await client.api.tasks[':id'].$get({ param: { id: tid } })
			if (tRes.ok) {
				const t = (await tRes.json()) as Task
				taskTitles.set(tid, t.title)
			}
		} catch { /* skip */ }
	}

	const completedWithPreviews = recentCompleted.filter((r) => previewMap.has(r.id))
	const totalItems = blockedTasks.length + failedRuns.length + completedWithPreviews.length

	if (totalItems === 0) {
		console.log(section('Inbox'))
		console.log('')
		console.log(success('  Nothing needs attention'))
		console.log(dim('  All tasks flowing, no failures.'))
		console.log('')
		return
	}

	console.log(section('Inbox'))
	console.log('')

	// ── Blocked tasks ────────────────────────────────────────
	if (blockedTasks.length > 0) {
		console.log(warning(`  ${blockedTasks.length} task(s) waiting for approval`))
		console.log('')

		for (const task of blockedTasks) {
			console.log(`  ${statusBadge('blocked')}  ${task.title}`)
			console.log(`  ${dim(task.id)}`)
			if (task.workflow_step) console.log(`  ${dim('Step:')} ${task.workflow_step}`)
			if (task.updated_at) console.log(`  ${dim(timeAgo(task.updated_at))}`)
			console.log('')
			console.log(dim(`    autopilot tasks approve ${task.id}`))
			console.log(dim(`    autopilot tasks reject ${task.id} -m "reason"`))
			console.log(dim(`    autopilot tasks reply ${task.id} -m "feedback"`))
			console.log('')
		}
	}

	// ── Failed runs ──────────────────────────────────────────
	if (failedRuns.length > 0) {
		console.log(error(`  ${failedRuns.length} run(s) failed`))
		console.log('')

		for (const run of failedRuns) {
			const taskTitle = run.task_id ? taskTitles.get(run.task_id) : null
			const label = taskTitle ?? run.agent_id

			console.log(`  ${statusBadge('failed')}  ${label}`)
			console.log(`  ${dim(run.id)}`)
			if (run.error) console.log(`  ${error(run.error.slice(0, 120))}`)
			if (run.ended_at) console.log(`  ${dim(timeAgo(run.ended_at))}`)
			const preview = previewMap.get(run.id)
			if (preview) console.log(`  ${dim('Preview:')} ${preview}`)
			console.log('')
			console.log(dim(`    autopilot runs show ${run.id}`))
			if (run.task_id) console.log(dim(`    autopilot tasks show ${run.task_id}`))
			console.log('')
		}
	}

	// ── Completed with previews ──────────────────────────────
	if (completedWithPreviews.length > 0) {
		console.log(success(`  ${completedWithPreviews.length} completed run(s) with previews`))
		console.log('')

		for (const run of completedWithPreviews) {
			const taskTitle = run.task_id ? taskTitles.get(run.task_id) : null
			const label = taskTitle ?? run.agent_id
			const preview = previewMap.get(run.id)!

			console.log(`  ${statusBadge('completed')}  ${label}`)
			console.log(`  ${dim(run.id)}`)
			if (run.summary) console.log(`  ${dim(run.summary.slice(0, 100))}`)
			console.log(`  ${dim('Preview:')} ${preview}`)
			console.log('')
			console.log(dim(`    autopilot runs show ${run.id}`))
			console.log('')
		}
	}

	console.log(separator())
	const parts: string[] = []
	if (blockedTasks.length > 0) parts.push(`${blockedTasks.length} blocked`)
	if (failedRuns.length > 0) parts.push(`${failedRuns.length} failed`)
	if (completedWithPreviews.length > 0) parts.push(`${completedWithPreviews.length} with previews`)
	console.log(dim(parts.join(' · ')))
}

// ─── Watch Mode ──────────────────────────────────────────────────────────────

async function runWatch(): Promise<void> {
	console.log(dim(`Connecting to ${getBaseUrl()}/api/events ...`))
	console.log(dim('Watching for actionable events. Press Ctrl+C to stop.\n'))

	const headers: Record<string, string> = { ...getAuthHeaders() }
	if (Object.keys(headers).length === 0) headers['X-Local-Dev'] = 'true'

	const res = await fetch(`${getBaseUrl()}/api/events`, { headers })
	if (!res.ok) {
		console.error(error(`Failed to connect (${res.status})`))
		process.exit(1)
	}

	const reader = res.body?.getReader()
	if (!reader) {
		console.error(error('No response body'))
		process.exit(1)
	}

	const client = createApiClient()
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
				const event = JSON.parse(json) as { type: string; [key: string]: unknown }
				await handleWatchEvent(event, client)
			} catch {
				// skip malformed
			}
		}
	}
}

async function handleWatchEvent(
	event: { type: string; [key: string]: unknown },
	client: ReturnType<typeof createApiClient>,
): Promise<void> {
	const ts = new Date().toISOString().slice(11, 19)

	switch (event.type) {
		case 'task_changed': {
			const status = event.status as string
			if (status !== 'blocked' && status !== 'needs_approval') return

			const taskId = event.taskId as string
			let title = taskId
			try {
				const tRes = await client.api.tasks[':id'].$get({ param: { id: taskId } })
				if (tRes.ok) {
					const t = (await tRes.json()) as Task
					title = t.title
				}
			} catch { /* skip */ }

			console.log(`${dim(ts)} ${statusBadge('blocked')}  ${title}`)
			console.log(`${dim('         ')} ${dim(taskId)}`)
			console.log(`${dim('         ')} ${dim(`autopilot tasks approve|reject|reply ${taskId}`)}`)
			console.log('')
			break
		}

		case 'run_completed': {
			const status = event.status as string
			const runId = event.runId as string

			if (status !== 'failed' && status !== 'completed') return

			let taskTitle: string | null = null
			let previewUrl: string | null = null
			let runError: string | null = null

			try {
				const rRes = await client.api.runs[':id'].$get({ param: { id: runId } })
				if (rRes.ok) {
					const run = (await rRes.json()) as Run
					runError = run.error ?? null
					if (run.task_id) {
						const tRes = await client.api.tasks[':id'].$get({ param: { id: run.task_id } })
						if (tRes.ok) {
							const t = (await tRes.json()) as Task
							taskTitle = t.title
						}
					}
				}
			} catch { /* skip */ }

			try {
				const artsRes = await client.api.runs[':id'].artifacts.$get({ param: { id: runId } })
				if (artsRes.ok) {
					const arts = (await artsRes.json()) as Artifact[]
					const preview = arts.find((a) => a.kind === 'preview_url')
					if (preview) previewUrl = preview.ref_value
				}
			} catch { /* skip */ }

			if (status === 'failed') {
				console.log(`${dim(ts)} ${statusBadge('failed')}  ${taskTitle ?? runId}`)
				if (runError) console.log(`${dim('         ')} ${error(runError.slice(0, 120))}`)
				console.log(`${dim('         ')} ${dim(`autopilot runs show ${runId}`)}`)
				console.log('')
			} else if (previewUrl) {
				console.log(`${dim(ts)} ${statusBadge('completed')}  ${taskTitle ?? runId}`)
				console.log(`${dim('         ')} ${dim('Preview:')} ${previewUrl}`)
				console.log(`${dim('         ')} ${dim(`autopilot runs show ${runId}`)}`)
				console.log('')
			}
			// Completed without preview — not actionable enough for watch
			break
		}

		// Skip non-actionable events
		default:
			break
	}
}

// ─── Command Registration ────────────────────────────────────────────────────

const inboxCmd = new Command('inbox')
	.description('Show actionable items: blocked tasks, failed runs, previews')
	.option('-w, --watch', 'Live-stream actionable events (SSE)')
	.action(async (opts: { watch?: boolean }) => {
		try {
			if (opts.watch) {
				await runWatch()
			} else {
				await renderInbox()
			}
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

program.addCommand(inboxCmd)
