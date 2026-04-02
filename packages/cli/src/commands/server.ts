import { Command } from 'commander'
import { startServer } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { brandHeader, success, dim, error, warning, separator, dot } from '../utils/format'

const serverCmd = new Command('server').description('Manage the orchestrator server')

serverCmd.addCommand(
	new Command('start')
		.description('Start the orchestrator server')
		.option('-p, --port <port>', 'Server port', '7778')
		.action(async (opts: { port: string }) => {
			try {
				const root = await findCompanyRoot()
				const port = Number.parseInt(opts.port, 10)

				const { server } = await startServer({ companyRoot: root, port })
				const url = `http://localhost:${server.port}`

				console.log('')
				console.log(brandHeader(root))
				console.log('')
				console.log(dim('  Endpoints:'))
				console.log(dim(`    API        ${url}/api`))
				console.log(dim(`    Health     ${url}/api/health`))
				console.log(dim(`    Tasks      ${url}/api/tasks`))
				console.log(dim(`    Runs       ${url}/api/runs`))
				console.log(dim(`    Workers    ${url}/api/workers`))
				console.log(dim(`    Events     ${url}/api/events`))
				console.log('')
				console.log(separator())
				console.log(`${dot('green')} ${success('Orchestrator is running.')}`)
				console.log(dim('Press Ctrl+C to stop'))
				console.log('')

				const shutdown = () => {
					console.log('')
					console.log(warning('Shutting down...'))
					server.stop()
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(serverCmd)
