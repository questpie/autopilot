import { Command } from 'commander'
import { AutopilotWorker, ClaudeCodeAdapter } from '@questpie/autopilot-worker'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { success, dim, error, warning, dot } from '../utils/format'

export function createLocalWorker(opts: {
	orchestratorUrl: string
	workDir: string
	name?: string
}): AutopilotWorker {
	const worker = new AutopilotWorker({
		orchestratorUrl: opts.orchestratorUrl,
		apiKey: '', // Worker routes are public (machine-to-machine)
		deviceId: `local-${process.pid}`,
		name: opts.name ?? 'local-worker',
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

	worker.registerAdapter(
		'claude-code',
		new ClaudeCodeAdapter({
			useMcp: true,
			workDir: opts.workDir,
		}),
	)

	return worker
}

const workerCmd = new Command('worker').description('Manage workers')

workerCmd.addCommand(
	new Command('start')
		.description('Start a worker and connect to an orchestrator')
		.option('-u, --url <url>', 'Orchestrator URL', 'http://localhost:7778')
		.option('-n, --name <name>', 'Worker name', 'local-worker')
		.action(async (opts: { url: string; name: string }) => {
			let worker: AutopilotWorker | null = null

			try {
				let workDir: string
				try {
					workDir = await findCompanyRoot()
				} catch {
					workDir = process.cwd()
				}

				worker = createLocalWorker({
					orchestratorUrl: opts.url,
					workDir,
					name: opts.name,
				})

				await worker.start()

				console.log(`${dot('green')} ${success(`Worker "${opts.name}" connected to ${opts.url}`)}`)
				console.log(dim('  Runtime: claude-code + MCP'))
				console.log(dim('  Press Ctrl+C to stop'))
				console.log('')

				const shutdown = async () => {
					console.log('')
					console.log(warning('Shutting down worker...'))
					if (worker) await worker.stop()
					console.log(success('Worker stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				if (worker) await worker.stop().catch(() => {})
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(workerCmd)
