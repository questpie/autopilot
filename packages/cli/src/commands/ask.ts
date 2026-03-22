import { Command } from 'commander'
import { createTask } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, success, dim, error } from '../utils/format'

program.addCommand(
	new Command('ask')
		.description('Submit a high-level intent for the AI team')
		.argument('<intent>', 'What you want done (natural language)')
		.action(async (intent: string) => {
			try {
				const root = await findCompanyRoot()

				console.log(header('QUESTPIE Autopilot'))
				console.log(dim('Submitting intent...\n'))

				const now = new Date().toISOString()

				const task = await createTask(root, {
					title: intent,
					description: intent,
					type: 'intent',
					status: 'backlog',
					assigned_to: 'ceo',
					created_by: 'human',
					workflow: 'development',
					created_at: now,
					updated_at: now,
				})

				console.log(success('Intent submitted!'))
				console.log('')
				console.log(`  ${dim('Task ID:')}   ${task.id}`)
				console.log('')
				console.log(dim('CEO agent will decompose your intent into tasks.'))
				console.log(dim("Run 'autopilot attach ceo' to watch, or 'autopilot inbox' for updates."))
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes('company.yaml')) {
					console.log(error('No company directory found.'))
					console.log(dim("Run 'autopilot init' to create one first."))
				} else {
					console.log(error(`Failed to submit intent: ${message}`))
				}
				process.exit(1)
			}
		}),
)
