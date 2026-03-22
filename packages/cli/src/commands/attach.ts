import { Command } from 'commander'
import { program } from '../program'
import { dim, warning } from '../utils/format'

program.addCommand(
	new Command('attach')
		.description('Attach to a live agent session')
		.argument('<agent>', 'Agent ID to attach to')
		.action(async (agent: string) => {
			console.log(warning('Session streaming coming soon'))
			console.log('')
			console.log(dim(`Will connect to agent "${agent}" via WebSocket.`))
			console.log(dim('This feature is under active development.'))
		}),
)
