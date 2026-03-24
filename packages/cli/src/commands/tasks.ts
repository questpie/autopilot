import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, table, success, error, warning, separator } from '../utils/format'
import { getClient } from '../utils/client'

const tasksCmd = new Command('tasks')
	.description('List and manage tasks in the backlog')
	.option('-s, --status <status>', 'Filter by task status (backlog, active, review, done, blocked)')
	.option('-a, --agent <agent>', 'Filter by assigned agent ID')
	.action(async (opts: { status?: string; agent?: string }) => {
		try {
			await findCompanyRoot()
			const client = getClient()

			const query: Record<string, string> = {}
			if (opts.status) query.status = opts.status
			if (opts.agent) query.agent = opts.agent

			const res = await client.api.tasks.$get({ query })
			if (!res.ok) {
				console.error(error('Failed to fetch tasks'))
				process.exit(1)
			}

			const tasks = (await res.json()) as Array<{
				id: string
				status: string
				title: string
				assigned_to?: string
			}>

			console.log(section('Tasks'))
			if (tasks.length === 0) {
				console.log(dim('  No tasks found'))
				if (opts.status || opts.agent) {
					console.log(dim(`  Filters: ${opts.status ? `status=${opts.status}` : ''} ${opts.agent ? `agent=${opts.agent}` : ''}`))
				}
				return
			}

			console.log(
				table(
					tasks.map((t) => [
						dim(t.id),
						badge(t.status, t.status === 'done' ? 'green' : t.status === 'blocked' ? 'red' : 'cyan'),
						t.title,
						t.assigned_to ? dim(`→ ${t.assigned_to}`) : '',
					]),
				),
			)
			console.log('')
			console.log(separator())
			console.log(dim(`${tasks.length} task(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

tasksCmd.addCommand(
	new Command('show')
		.description('Show detailed information about a specific task')
		.argument('<id>', 'Task ID to inspect')
		.action(async (id: string) => {
			try {
				await findCompanyRoot()
				const client = getClient()

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
					priority: string
					assigned_to?: string
					created_by: string
					created_at: string
					updated_at: string
					description?: string
					history: Array<{ at: string; by: string; action: string; note?: string }>
				}

				console.log(section(task.title))
				console.log('')
				console.log(`  ${dim('ID:')}          ${task.id}`)
				console.log(`  ${dim('Status:')}      ${badge(task.status)}`)
				console.log(`  ${dim('Type:')}        ${task.type}`)
				console.log(`  ${dim('Priority:')}    ${task.priority}`)
				console.log(`  ${dim('Assigned:')}    ${task.assigned_to ?? 'unassigned'}`)
				console.log(`  ${dim('Created by:')}  ${task.created_by}`)
				console.log(`  ${dim('Created at:')}  ${task.created_at}`)
				console.log(`  ${dim('Updated at:')}  ${task.updated_at}`)

				if (task.description) {
					console.log('')
					console.log(dim('Description:'))
					console.log(`  ${task.description}`)
				}

				if (task.history.length > 0) {
					console.log('')
					console.log(dim('History:'))
					for (const entry of task.history) {
						console.log(`  ${dim(entry.at)} ${entry.by} ${entry.action}${entry.note ? ` — ${entry.note}` : ''}`)
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('approve')
		.description('Approve a task and move it to done')
		.argument('<id>', 'Task ID to approve')
		.action(async (id: string) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.tasks[':id'].approve.$post({ param: { id } })

				if (!res.ok) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				console.log(success(`Task ${id} approved and moved to done.`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

tasksCmd.addCommand(
	new Command('reject')
		.description('Reject a task and move it to blocked')
		.argument('<id>', 'Task ID to reject')
		.argument('[reason]', 'Reason for rejection')
		.action(async (id: string, reason?: string) => {
			try {
				await findCompanyRoot()
				const client = getClient()

				const res = await client.api.tasks[':id'].reject.$post({
					param: { id },
					json: { reason: reason ?? 'Rejected by human' },
				})

				if (!res.ok) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				console.log(warning(`Task ${id} rejected and moved to blocked.`))
				if (reason) {
					console.log(dim(`  Reason: ${reason}`))
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(tasksCmd)
