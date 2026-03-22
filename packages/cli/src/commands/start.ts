import { Command } from 'commander'
import { Orchestrator, loadCompany, loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, success, dim, error, warning } from '../utils/format'

program.addCommand(
	new Command('start')
		.description('Start the Autopilot orchestrator')
		.option('-p, --port <port>', 'Webhook server port', '7777')
		.action(async (opts: { port: string }) => {
			try {
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)
				const port = Number.parseInt(opts.port, 10)

				console.log('')
				console.log(header('QUESTPIE Autopilot'))
				console.log(dim(`Company: ${company.name} (${company.slug})`))
				console.log(dim(`Agents:  ${agents.length}`))
				console.log(dim(`Port:    ${port}`))
				console.log('')

				const orchestrator = new Orchestrator({
					companyRoot: root,
					webhookPort: port,
				})

				const shutdown = async () => {
					console.log('')
					console.log(warning('Received shutdown signal...'))
					await orchestrator.stop()
					console.log(success('Orchestrator stopped gracefully.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)

				await orchestrator.start()

				console.log('')
				console.log(success('Orchestrator is running.'))
				console.log(dim('Press Ctrl+C to stop.'))
				console.log('')
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes('company.yaml')) {
					console.log(error('No company directory found.'))
					console.log(dim("Run 'autopilot init' to create one first."))
				} else {
					console.log(error(`Failed to start orchestrator: ${message}`))
				}
				process.exit(1)
			}
		}),
)
