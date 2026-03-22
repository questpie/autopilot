import { Command } from 'commander'
import { listTasks } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, error } from '../utils/format'

program.addCommand(
	new Command('inbox')
		.description('Show tasks requiring human attention')
		.action(async () => {
			try {
				const root = await findCompanyRoot()

				const reviewTasks = await listTasks(root, { status: 'review' })
				const blockedTasks = await listTasks(root, { status: 'blocked' })

				const inbox = [...reviewTasks, ...blockedTasks]

				console.log(header('Inbox'))
				console.log(dim('Tasks requiring your attention\n'))

				if (inbox.length === 0) {
					console.log(dim('  All clear — nothing needs your attention.'))
					return
				}

				console.log(
					table(
						inbox.map((t) => [
							dim(t.id),
							badge(
								t.status,
								t.status === 'review' ? 'yellow' : 'red',
							),
							t.title,
							t.assigned_to ? dim(`→ ${t.assigned_to}`) : '',
						]),
					),
				)
				console.log('')
				console.log(dim(`${inbox.length} item(s) need attention`))
				console.log(dim('Use `autopilot tasks approve <id>` or `autopilot tasks reject <id>` to respond.'))
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes('company.yaml')) {
					console.log(error('No company directory found.'))
					console.log(dim("Run 'autopilot init' to create one first."))
				} else {
					console.log(error(`Failed to load inbox: ${message}`))
				}
				process.exit(1)
			}
		}),
)
