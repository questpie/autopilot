import { Command } from 'commander'
import { startServer } from '@questpie/autopilot-orchestrator'
import { AutopilotWorker, ClaudeCodeAdapter } from '@questpie/autopilot-worker'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { brandHeader, success, dim, error, warning, separator, dot } from '../utils/format'

program.addCommand(
	new Command('start')
		.description('Start the Autopilot orchestrator + local worker')
		.option('-p, --port <port>', 'Server port', '7778')
		.option('--no-worker', 'Skip starting the local worker')
		.action(async (opts: { port: string; worker: boolean }) => {
			let worker: AutopilotWorker | null = null

			try {
				const root = await findCompanyRoot()
				const port = Number.parseInt(opts.port, 10)

				// ── 1. Start orchestrator ─────────────────────────────────────
				const { server } = await startServer({ companyRoot: root, port })

				// ── 2. Start local worker ─────────────────────────────────────
				if (opts.worker) {
					const orchestratorUrl = `http://localhost:${server.port}`
					// For local mode, use a known local API key (no auth bypass needed
					// because the worker authenticates via X-API-Key header which the
					// auth middleware accepts)
					const localApiKey = `local-worker-${Date.now()}`

					worker = new AutopilotWorker({
						orchestratorUrl,
						apiKey: localApiKey,
						deviceId: `local-${process.pid}`,
						name: 'local-worker',
						capabilities: [
							{
								runtime: 'claude-code',
								models: ['claude-sonnet-4-20250514'],
								maxConcurrent: 1,
							},
						],
						pollInterval: 3_000,
						heartbeatInterval: 15_000,
					})

					worker.registerAdapter('claude-code', new ClaudeCodeAdapter())

					await worker.start()
				}

				// ── 3. Print status ───────────────────────────────────────────
				console.log('')
				console.log(brandHeader(root))
				console.log('')
				console.log(dim('  Endpoints:'))
				console.log(dim(`    API        http://localhost:${server.port}/api`))
				console.log(dim(`    Health     http://localhost:${server.port}/api/health`))
				console.log(dim(`    Tasks      http://localhost:${server.port}/api/tasks`))
				console.log(dim(`    Runs       http://localhost:${server.port}/api/runs`))
				console.log(dim(`    Workers    http://localhost:${server.port}/api/workers`))
				console.log(dim(`    Events     http://localhost:${server.port}/api/events`))
				console.log('')
				console.log(separator())
				console.log(`${dot('green')} ${success('Orchestrator is running.')}`)
				if (worker) {
					console.log(`${dot('green')} ${success('Local worker started (claude-code).')}`)
				}
				console.log(dim('Press Ctrl+C to stop'))
				console.log('')

				// ── 4. Graceful shutdown ──────────────────────────────────────
				const shutdown = async () => {
					console.log('')
					console.log(warning('Shutting down...'))
					if (worker) {
						await worker.stop()
					}
					server.stop()
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				if (worker) {
					await worker.stop().catch(() => {})
				}
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
