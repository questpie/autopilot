import { Command } from 'commander'
import { createTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, success, dim } from '../utils/format'

program.addCommand(
	new Command('ask')
		.description('Submit a high-level intent for the AI team')
		.argument('<intent>', 'What you want done (natural language)')
		.action(async (intent: string) => {
			const root = await findCompanyRoot()

			console.log(header('QUESTPIE Autopilot'))
			console.log(dim('Submitting intent...\n'))

			const task = await createTask(root, {
				title: intent,
				description: `User intent: ${intent}`,
				type: 'intent',
				status: 'backlog',
				priority: 'medium',
				created_by: 'human:owner',
				assigned_to: 'ceo',
			})

			console.log(success('Intent submitted!'))
			console.log('')
			console.log(`  ${dim('Task ID:')}   ${task.id}`)
			console.log(`  ${dim('Title:')}     ${task.title}`)
			console.log(`  ${dim('Status:')}    ${task.status}`)
			console.log(`  ${dim('Assigned:')}  ${task.assigned_to}`)
			console.log('')
			console.log(dim('The CEO agent will break this down into actionable tasks.'))
		}),
)
