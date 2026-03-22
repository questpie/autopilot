import { Command } from 'commander'
import { listTasks, readTask, moveTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, success, error, warning } from '../utils/format'

const tasksCmd = new Command('tasks')
	.description('List and manage tasks')
	.option('-s, --status <status>', 'Filter by status')
	.option('-a, --agent <agent>', 'Filter by assigned agent')
	.action(async (opts: { status?: string; agent?: string }) => {
		const root = await findCompanyRoot()
		const tasks = await listTasks(root, {
			status: opts.status,
			agent: opts.agent,
		})

		console.log(header('Tasks'))
		if (tasks.length === 0) {
			console.log(dim('  No tasks found'))
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
	})

tasksCmd.addCommand(
	new Command('show')
		.description('Show task details')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			const root = await findCompanyRoot()
			const task = await readTask(root, id)

			if (!task) {
				console.log(error(`Task not found: ${id}`))
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
		}),
)

tasksCmd.addCommand(
	new Command('approve')
		.description('Approve a task (move to done)')
		.argument('<id>', 'Task ID')
		.action(async (id: string) => {
			const root = await findCompanyRoot()
			const task = await readTask(root, id)

			if (!task) {
				console.log(error(`Task not found: ${id}`))
				process.exit(1)
			}

			await moveTask(root, id, 'done', 'human:owner')
			console.log(success(`Task ${id} approved and moved to done.`))
		}),
)

tasksCmd.addCommand(
	new Command('reject')
		.description('Reject a task (move back to backlog)')
		.argument('<id>', 'Task ID')
		.argument('[reason]', 'Rejection reason')
		.action(async (id: string, reason?: string) => {
			const root = await findCompanyRoot()
			const task = await readTask(root, id)

			if (!task) {
				console.log(error(`Task not found: ${id}`))
				process.exit(1)
			}

			await moveTask(root, id, 'backlog', 'human:owner')
			console.log(warning(`Task ${id} rejected and moved to backlog.`))
			if (reason) {
				console.log(dim(`  Reason: ${reason}`))
			}
		}),
)

program.addCommand(tasksCmd)
