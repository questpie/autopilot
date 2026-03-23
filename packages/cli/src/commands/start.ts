import { Command } from 'commander'
import { Orchestrator, loadCompany, loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, success, dim, error, warning } from '../utils/format'

program.addCommand(
	new Command('start')
		.description('Start the Autopilot orchestrator daemon')
		.option('-p, --port <port>', 'Webhook server port', '7777')
		.action(async (opts: { port: string }) => {
			try {
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)
				const port = Number.parseInt(opts.port, 10)

				const orchestrator = new Orchestrator({
					companyRoot: root,
					webhookPort: port,
				})

				await orchestrator.start()

				const apiPort = port + 1

				console.log('')
				console.log(header('QUESTPIE Autopilot'))
				console.log(dim(`Company:  ${company.name}`))
				console.log(dim(`Agents:   ${agents.length}`))
				console.log(dim(`Root:     ${root}`))
				console.log('')
				console.log(dim('Endpoints:'))
				console.log(dim(`  Webhooks   http://localhost:${port}`))
				console.log(dim(`  API        http://localhost:${apiPort}/api/status`))
				console.log(dim(`  Files      http://localhost:${apiPort}/fs/`))
				console.log(dim(`  Tasks      http://localhost:${apiPort}/api/tasks`))
				console.log(dim(`  Agents     http://localhost:${apiPort}/api/agents`))
				console.log(dim(`  Activity   http://localhost:${apiPort}/api/activity`))
				console.log('')
				console.log(success('Orchestrator is running.'))
				console.log(dim('Press Ctrl+C to stop'))
				console.log('')

				const shutdown = async () => {
					console.log('')
					console.log(warning('Shutting down...'))
					await orchestrator.stop()
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
