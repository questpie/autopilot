import { Command } from 'commander'
import { listTasks, readTask, moveTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, success, error, warning } from '../utils/format'

const tasksCmd = new Command('tasks')
	.description('List and manage tasks in the backlog')
	.option('-s, --status <status>', 'Filter by task status (backlog, active, review, done, blocked)')
	.option('-a, --agent <agent>', 'Filter by assigned agent ID')
	.action(async (opts: { status?: string; agent?: string }) => {
		try {
			const root = await findCompanyRoot()
			const tasks = await listTasks(root, {
				status: opts.status,
				agent: opts.agent,
			})

			console.log(header('Tasks'))
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
				const root = await findCompanyRoot()
				const task = await readTask(root, id)

				if (!task) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				console.log(header(task.title))
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
				const root = await findCompanyRoot()
				const task = await readTask(root, id)

				if (!task) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				await moveTask(root, id, 'done', 'human:owner')
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
				const root = await findCompanyRoot()
				const task = await readTask(root, id)

				if (!task) {
					console.error(error(`Task not found: ${id}`))
					console.error(dim('Use "autopilot tasks" to list all tasks.'))
					process.exit(1)
				}

				await moveTask(root, id, 'blocked', 'human:owner')
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
