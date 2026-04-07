/**
 * `autopilot schedule` — manage schedules.
 *
 * Commands:
 *   list              — list all schedules
 *   show <id>         — show schedule details
 *   create            — create a new schedule
 *   enable <id>       — enable a schedule
 *   disable <id>      — disable a schedule
 *   delete <id>       — delete a schedule
 */
import { Command } from 'commander'
import { program } from '../program'
import { getBaseUrl } from '../utils/client'
import { dim, success, error, badge, table, section } from '../utils/format'
import { getAuthHeaders } from './auth'

interface ScheduleSummary {
	id: string
	name: string
	cron: string
	timezone: string | null
	agent_id: string
	workflow_id: string | null
	enabled: boolean | number | null
	last_run_at: string | null
	next_run_at: string | null
	created_at: string
}

function isEnabled(val: boolean | number | null): boolean {
	if (typeof val === 'boolean') return val
	if (typeof val === 'number') return val !== 0
	return false
}

function getHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		...getAuthHeaders(),
		'Content-Type': 'application/json',
	}
	if (!headers['Authorization'] && !headers['X-API-Key']) {
		headers['X-Local-Dev'] = 'true'
	}
	return headers
}

const scheduleCmd = new Command('schedule').description('Manage schedules')

// ─── list ─────────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('list')
		.description('List all schedules')
		.action(async () => {
			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules`, { headers: getHeaders() })

				if (!res.ok) {
					console.error(error('Failed to fetch schedules'))
					process.exit(1)
				}

				const items = (await res.json()) as ScheduleSummary[]

				console.log(section('Schedules'))
				if (items.length === 0) {
					console.log(dim('  No schedules found'))
					return
				}

				console.log(
					table(
						items.map((s) => [
							dim(s.id),
							isEnabled(s.enabled) ? badge('on', 'green') : badge('off', 'red'),
							s.name,
							dim(s.cron),
							dim(s.agent_id),
						]),
					),
				)
				console.log('')
				console.log(dim(`${items.length} schedule(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── show ────────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('show')
		.description('Show schedule details')
		.argument('<id>', 'Schedule ID')
		.action(async (id: string) => {
			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules/${encodeURIComponent(id)}`, {
					headers: getHeaders(),
				})

				if (!res.ok) {
					console.error(error(`Schedule not found: ${id}`))
					process.exit(1)
				}

				const s = (await res.json()) as ScheduleSummary & {
					description?: string | null
					task_template?: string | null
					created_by?: string | null
					updated_at?: string
				}

				console.log(section(s.name))
				console.log('')
				console.log(`  ${dim('ID:')}          ${s.id}`)
				console.log(`  ${dim('Status:')}      ${isEnabled(s.enabled) ? badge('enabled', 'green') : badge('disabled', 'red')}`)
				console.log(`  ${dim('Cron:')}        ${s.cron}`)
				console.log(`  ${dim('Timezone:')}    ${s.timezone ?? 'UTC'}`)
				console.log(`  ${dim('Agent:')}       ${s.agent_id}`)
				if (s.workflow_id) console.log(`  ${dim('Workflow:')}    ${s.workflow_id}`)
				if (s.description) console.log(`  ${dim('Description:')} ${s.description}`)
				if (s.last_run_at) console.log(`  ${dim('Last run:')}   ${s.last_run_at}`)
				if (s.next_run_at) console.log(`  ${dim('Next run:')}   ${s.next_run_at}`)
				if (s.created_by) console.log(`  ${dim('Created by:')} ${s.created_by}`)
				console.log(`  ${dim('Created at:')} ${s.created_at}`)

				if (s.task_template && s.task_template !== '{}') {
					console.log('')
					console.log(dim('Task template:'))
					try {
						const tmpl = JSON.parse(s.task_template)
						for (const [k, v] of Object.entries(tmpl)) {
							console.log(`  ${dim(k + ':')} ${String(v)}`)
						}
					} catch (err) {
						console.debug('[schedule] failed to parse task_template JSON:', err instanceof Error ? err.message : String(err))
						console.log(`  ${s.task_template}`)
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── create ─────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('create')
		.description('Create a new schedule')
		.requiredOption('--name <name>', 'Schedule name')
		.requiredOption('--cron <expr>', 'Cron expression (e.g. "0 9 * * *")')
		.requiredOption('--agent <agent_id>', 'Agent ID')
		.option('--workflow <workflow_id>', 'Workflow ID')
		.option('--title <title>', 'Task template title')
		.option('--type <type>', 'Task template type')
		.option('--description <desc>', 'Schedule description')
		.option('--timezone <tz>', 'Timezone (default: UTC)')
		.option('--disabled', 'Create in disabled state')
		.action(async (opts: {
			name: string
			cron: string
			agent: string
			workflow?: string
			title?: string
			type?: string
			description?: string
			timezone?: string
			disabled?: boolean
		}) => {
			try {
				const taskTemplate: Record<string, string> = {}
				if (opts.title) taskTemplate.title = opts.title
				if (opts.type) taskTemplate.type = opts.type

				const body: Record<string, unknown> = {
					name: opts.name,
					cron: opts.cron,
					agent_id: opts.agent,
				}
				if (opts.workflow) body.workflow_id = opts.workflow
				if (opts.description) body.description = opts.description
				if (opts.timezone) body.timezone = opts.timezone
				if (opts.disabled) body.enabled = false
				if (Object.keys(taskTemplate).length > 0) {
					body.task_template = JSON.stringify(taskTemplate)
				}

				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules`, {
					method: 'POST',
					headers: getHeaders(),
					body: JSON.stringify(body),
				})

				if (!res.ok) {
					const errBody = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
					console.error(error(errBody.error ?? 'Failed to create schedule'))
					process.exit(1)
				}

				const created = (await res.json()) as { id: string; name: string }
				console.log(success(`Schedule created: ${created.id}`))
				console.log(dim(`  ${created.name}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── enable ─────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('enable')
		.description('Enable a schedule')
		.argument('<id>', 'Schedule ID')
		.action(async (id: string) => {
			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: getHeaders(),
					body: JSON.stringify({ enabled: true }),
				})

				if (!res.ok) {
					console.error(error(`Schedule not found: ${id}`))
					process.exit(1)
				}

				console.log(success(`Schedule ${id} enabled`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── disable ────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('disable')
		.description('Disable a schedule')
		.argument('<id>', 'Schedule ID')
		.action(async (id: string) => {
			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					headers: getHeaders(),
					body: JSON.stringify({ enabled: false }),
				})

				if (!res.ok) {
					console.error(error(`Schedule not found: ${id}`))
					process.exit(1)
				}

				console.log(success(`Schedule ${id} disabled`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ─── delete ─────────────────────────────────────────────────────────────

scheduleCmd.addCommand(
	new Command('delete')
		.description('Delete a schedule')
		.argument('<id>', 'Schedule ID')
		.action(async (id: string) => {
			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/schedules/${encodeURIComponent(id)}`, {
					method: 'DELETE',
					headers: getHeaders(),
				})

				if (!res.ok) {
					const errBody = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
					console.error(error(errBody.error ?? `Failed to delete schedule: ${id}`))
					process.exit(1)
				}

				const deleted = (await res.json()) as { id: string; name: string }
				console.log(success(`Schedule deleted: ${deleted.id}`))
				console.log(dim(`  ${deleted.name}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(scheduleCmd)
