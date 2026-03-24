import { Command } from 'commander'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { brandHeader, success, dim, error, createSpinner } from '../utils/format'
import { getClient } from '../utils/client'

program.addCommand(
	new Command('ask')
		.description('Submit a high-level intent for the AI team to execute')
		.argument('<intent>', 'What you want done (natural language)')
		.action(async (intent: string) => {
			try {
				findCompanyRoot()

				console.log(brandHeader())
				const spin = createSpinner('Submitting intent...')
				spin.start()

				const now = new Date().toISOString()
				const client = getClient()

				const res = await client.api.tasks.$post({
					json: {
						id: crypto.randomUUID(),
						title: intent,
						description: intent,
						type: 'intent',
						status: 'backlog',
						assigned_to: 'ceo',
						created_by: 'human',
						workflow: 'development',
						created_at: now,
						updated_at: now,
					},
				})

				if (!res.ok) {
					spin.stop()
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed: ${body.error}`))
					process.exit(1)
				}

				const task = (await res.json()) as { id: string }

				spin.stop()
				console.log(success('Intent submitted!'))
				console.log('')
				console.log(`  ${dim('Task ID:')}   ${task.id}`)
				console.log('')
				console.log(dim('CEO agent will decompose your intent into tasks.'))
				console.log(dim("Run 'autopilot attach ceo' to watch, or 'autopilot inbox' for updates."))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
