import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { warning, dim, error } from '../utils/format'
import { getClient } from '../utils/client'

program.addCommand(
	new Command('reject')
		.description('Reject a task (shortcut for "tasks reject")')
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
