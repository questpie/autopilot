import { Command } from 'commander'
import { program } from '../program'
import { dim, warning, header } from '../utils/format'

program.addCommand(
	new Command('attach')
		.description('Attach to a live agent session')
		.argument('<agent>', 'Agent ID to attach to')
		.action(async (agent: string) => {
			console.log(header('QUESTPIE Autopilot'))
			console.log('')
			console.log(warning('Session streaming requires a running orchestrator (autopilot start)'))
			console.log('')
			console.log(dim(`Will connect to agent "${agent}" via WebSocket at ws://localhost:7778`))
			console.log('')
			console.log(dim('Coming soon — agent sessions will stream here in real-time.'))
			console.log(dim('You will be able to watch agents think, plan, and execute tasks live.'))
		}),
)
