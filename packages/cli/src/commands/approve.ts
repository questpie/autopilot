import { Command } from 'commander'
import { readTask, moveTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { success, dim, error } from '../utils/format'

program.addCommand(
	new Command('approve')
		.description('Approve a task (shortcut for "tasks approve")')
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
				console.log(dim('Workflow advancement triggered.'))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
