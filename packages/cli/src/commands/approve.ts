import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { success, dim, error } from '../utils/format'
import { getClient } from '../utils/client'

program.addCommand(
	new Command('approve')
		.description('Approve a task (shortcut for "tasks approve")')
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
				console.log(dim('Workflow advancement triggered.'))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
