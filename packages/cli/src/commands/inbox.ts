import { Command } from 'commander'
import { listTasks } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, table, error, separator } from '../utils/format'

program.addCommand(
	new Command('inbox')
		.description('Show tasks requiring human attention (review + blocked)')
		.action(async () => {
			try {
				const root = await findCompanyRoot()

				const reviewTasks = await listTasks(root, { status: 'review' })
				const blockedTasks = await listTasks(root, { status: 'blocked' })

				const inbox = [...reviewTasks, ...blockedTasks]

				console.log(section('Inbox'))
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
				console.log(separator())
				console.log(dim(`${inbox.length} item(s) need attention`))
				console.log(dim('Use "autopilot tasks approve <id>" or "autopilot tasks reject <id>" to respond.'))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
