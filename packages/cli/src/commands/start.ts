import { Command } from 'commander'
import { program } from '../program'
import { dim, warning } from '../utils/format'

program.addCommand(
	new Command('start')
		.description('Start the Autopilot orchestrator')
		.action(async () => {
			console.log(warning('Orchestrator starting...'))
			console.log('')
			console.log(dim('This will compose all orchestrator modules:'))
			console.log(dim('  - Scheduler (cron-based agent triggers)'))
			console.log(dim('  - Watcher (filesystem change detection)'))
			console.log(dim('  - Webhook server (incoming events)'))
			console.log(dim('  - Session manager (agent lifecycle)'))
			console.log('')
			console.log(dim('This feature is under active development.'))
		}),
)
