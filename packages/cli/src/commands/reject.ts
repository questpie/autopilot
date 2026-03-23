import { Command } from 'commander'
import { readTask, moveTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { warning, dim, error } from '../utils/format'

program.addCommand(
	new Command('reject')
		.description('Reject a task (shortcut for "tasks reject")')
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
