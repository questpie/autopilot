import { Command } from 'commander'
import { startServer } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot, findProjectRoot } from '../utils/find-root'
import { createLocalWorker } from './worker'
import { resolveWorkerConcurrency } from '../utils/worker-concurrency'
import { brandHeader, success, dim, error, warning, separator, dot } from '../utils/format'
import type { AutopilotWorker } from '@questpie/autopilot-worker'

/**
 * `autopilot start` — local convenience wrapper.
 * Boots orchestrator + one local worker in a single process tree.
 * For production, use `autopilot server start` + `autopilot worker start` separately.
 */
program.addCommand(
	new Command('start')
		.description('Start orchestrator + local worker (local dev/demo mode)')
		.option('-p, --port <port>', 'Server port', '7778')
		.option('-c, --concurrency <n>', 'Max concurrent runs for local worker (defaults to company setting or 4)')
		.option('--no-worker', 'Skip starting the local worker')
		.action(async (opts: { port: string; concurrency?: string; worker: boolean }) => {
			let worker: AutopilotWorker | null = null

			try {
				const root = await findCompanyRoot()
				const projectRoot = await findProjectRoot()
				const workerDir = projectRoot ?? process.cwd()
				const port = Number.parseInt(opts.port, 10)

				// ── 1. Start orchestrator ─────────────────────────────────────
				const { server, stop: stopServer, workerRegistry } = await startServer({ companyRoot: root, port, allowLocalDevBypass: true })
				const orchestratorUrl = `http://localhost:${server.port}`

				// ── 2. Start local worker ─────────────────────────────────────
				if (opts.worker) {
					const concurrency = await resolveWorkerConcurrency(root, opts.concurrency)
					worker = createLocalWorker({
						orchestratorUrl,
						workDir: workerDir,
						concurrency,
					})
					await worker.start()

					// Wire the local worker's API into VFS registry so workspace:// reads work
					const apiServer = worker.getApiServer()
					if (apiServer) {
						workerRegistry.setLocalWorker(
							worker.getWorkerId() ?? 'local-dev',
							{ baseUrl: `http://localhost:${apiServer.port}`, token: apiServer.token },
						)
					}
				}

				// ── 3. Print status ───────────────────────────────────────────
				console.log('')
				console.log(brandHeader(root))
				console.log('')
				console.log(dim('  Endpoints:'))
				console.log(dim(`    API        ${orchestratorUrl}/api`))
				console.log(dim(`    Health     ${orchestratorUrl}/api/health`))
				console.log(dim(`    Tasks      ${orchestratorUrl}/api/tasks`))
				console.log(dim(`    Runs       ${orchestratorUrl}/api/runs`))
				console.log(dim(`    Workers    ${orchestratorUrl}/api/workers`))
				console.log(dim(`    Events     ${orchestratorUrl}/api/events`))
				console.log('')
				console.log(separator())
				console.log(`${dot('green')} ${success('Orchestrator is running.')}`)
				if (worker) {
					console.log(`${dot('green')} ${success('Local worker started (claude-code + MCP).')}`)
				}
				console.log(`${dot('yellow')} ${warning('Local dev auth bypass ACTIVE (localhost only).')}`)
				console.log(dim('Press Ctrl+C to stop'))
				console.log('')

				// ── 4. Graceful shutdown ──────────────────────────────────────
				const shutdown = async () => {
					console.log('')
					console.log(warning('Shutting down...'))
					if (worker) await worker.stop()
					stopServer()
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				if (worker) await worker.stop().catch((stopErr) => console.debug('[start] worker stop error:', stopErr instanceof Error ? stopErr.message : String(stopErr)))
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
