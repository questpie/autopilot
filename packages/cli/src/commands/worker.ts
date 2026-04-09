import { Command } from 'commander'
import { AutopilotWorker, type RuntimeConfig } from '@questpie/autopilot-worker'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { success, dim, error, warning, dot, separator } from '../utils/format'
import { DEFAULT_LOCAL_WORKER_CONCURRENCY, resolveWorkerConcurrency } from '../utils/worker-concurrency'

/** Create a worker for local dev convenience (autopilot start). Uses local dev bypass. */
export function createLocalWorker(opts: {
	orchestratorUrl: string
	workDir: string
	name?: string
	runtime?: string
	binaryPath?: string
	sessionPersistence?: 'local' | 'off'
	concurrency?: number
}): AutopilotWorker {
	const rtConfig: RuntimeConfig = {
		runtime: (opts.runtime ?? 'claude-code') as RuntimeConfig['runtime'],
		binaryPath: opts.binaryPath,
		useMcp: true,
		sessionPersistence: opts.sessionPersistence ?? 'local',
	}

	return new AutopilotWorker({
		orchestratorUrl: opts.orchestratorUrl,
		deviceId: `local-${process.pid}`,
		name: opts.name ?? 'local-worker',
		runtimes: [rtConfig],
		pollInterval: 3_000,
		heartbeatInterval: 15_000,
		repoRoot: opts.workDir,
		maxConcurrentRuns: opts.concurrency ?? DEFAULT_LOCAL_WORKER_CONCURRENCY,
		localDev: true,
	})
}

function printWorkerStatus(worker: AutopilotWorker, opts: {
	name: string
	url: string
	workDir: string
}) {
	const resolved = worker.getResolvedRuntimes()
	const capabilities = worker.getCapabilities()
	const enrolled = worker.isEnrolled()
	console.log(`${dot('green')} ${success(`Worker "${opts.name}" connected to ${opts.url}`)}`)
	console.log('')
	console.log(dim(`  Worker ID:   ${worker.getWorkerId() ?? 'pending'}`))
	console.log(dim(`  Auth:        ${enrolled ? 'enrolled (machine credential)' : 'local dev bypass'}`))
	for (const rt of resolved) {
		const advertised = capabilities.find((cap) => cap.runtime === rt.config.runtime)
		console.log(dim(`  Runtime:     ${rt.config.runtime}`))
		console.log(dim(`  Binary:      ${rt.resolvedBinaryPath}`))
		console.log(dim(`  Models:      ${rt.capability.models.join(', ') || '(default)'}`))
		console.log(dim(`  MCP:         ${rt.config.useMcp !== false ? 'enabled' : 'disabled'}`))
		console.log(dim(`  Sessions:    ${rt.config.sessionPersistence ?? 'local'}`))
		console.log(dim(`  Concurrency: ${advertised?.maxConcurrent ?? rt.capability.maxConcurrent}`))
	}
	console.log(dim(`  Repo root:   ${opts.workDir}`))
	console.log('')
	console.log(separator())
	console.log(dim('  Press Ctrl+C to stop'))
	console.log('')
}

const workerCmd = new Command('worker').description('Manage workers')

workerCmd.addCommand(
	new Command('start')
		.description('Start a worker and connect to an orchestrator')
		.option('-u, --url <url>', 'Orchestrator URL', 'http://localhost:7778')
		.option('-n, --name <name>', 'Worker name', 'local-worker')
		.option('-t, --token <token>', 'Join token for first-time enrollment')
		.option('--runtime <runtime>', 'Runtime to host (claude-code)', 'claude-code')
		.option('--binary <path>', 'Explicit path to runtime binary')
		.option('--session-persistence <mode>', 'Session persistence: local or off', 'local')
		.option('-c, --concurrency <n>', 'Max concurrent runs (defaults to company setting or 4)')
		.action(
			async (opts: {
				url: string
				name: string
				token?: string
				runtime: string
				binary?: string
				sessionPersistence: string
				concurrency?: string
			}) => {
				let worker: AutopilotWorker | null = null

				try {
					let workDir: string
					try {
						workDir = await findCompanyRoot()
					} catch (err) {
						console.warn(`[worker] no company root found, using cwd: ${(err as Error).message}`)
						workDir = process.cwd()
					}

					const rtConfig: RuntimeConfig = {
						runtime: (opts.runtime ?? 'claude-code') as RuntimeConfig['runtime'],
						binaryPath: opts.binary,
						useMcp: true,
						sessionPersistence: opts.sessionPersistence as 'local' | 'off',
					}

					const concurrency = await resolveWorkerConcurrency(workDir, opts.concurrency)

					worker = new AutopilotWorker({
						orchestratorUrl: opts.url,
						deviceId: `${opts.name}-${process.pid}`,
						name: opts.name,
						runtimes: [rtConfig],
						pollInterval: 3_000,
						heartbeatInterval: 15_000,
						repoRoot: workDir,
						maxConcurrentRuns: concurrency,
						joinToken: opts.token,
					})

					await worker.start()

					printWorkerStatus(worker, {
						name: opts.name,
						url: opts.url,
						workDir,
					})

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
			},
		),
)

// ─── Token management ───────────────────────────────────────────────────────

const tokenCmd = new Command('token').description('Manage worker join tokens')

tokenCmd.addCommand(
	new Command('create')
		.description('Create a join token for worker enrollment')
		.option('-d, --description <desc>', 'Description (e.g. "Andrej laptop")')
		.option('--ttl <seconds>', 'Token lifetime in seconds', '3600')
		.action(async (opts: { description?: string; ttl: string }) => {
			try {
				const { createApiClient } = await import('../utils/client')
				const client = createApiClient()

				const res = await client.api.enrollment.tokens.$post({
					json: {
						description: opts.description,
						ttl_seconds: Number.parseInt(opts.ttl, 10),
					},
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error: string }
					console.error(error(`Failed: ${body.error}`))
					process.exit(1)
				}

				const token = (await res.json()) as {
					token_id: string
					secret: string
					expires_at: string
				}

				console.log(success('Join token created'))
				console.log('')
				console.log(`  ${dim('Token ID:')}   ${token.token_id}`)
				console.log(`  ${dim('Secret:')}     ${token.secret}`)
				console.log(`  ${dim('Expires:')}    ${token.expires_at}`)
				console.log('')
				console.log(dim('  Use this to enroll a worker:'))
				console.log(dim(`  autopilot worker start --url <orchestrator> --token ${token.secret}`))
				console.log('')
				console.log(warning('  The secret is shown only once. Store it securely.'))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

workerCmd.addCommand(tokenCmd)

workerCmd.addCommand(
	new Command('list')
		.description('List registered workers')
		.action(async () => {
			try {
				const { createApiClient } = await import('../utils/client')
				const { section, dim, badge, table, separator } = await import('../utils/format')
				const client = createApiClient()

				const res = await client.api.workers.$get()
				if (!res.ok) {
					const { error: errUtil } = await import('../utils/format')
					console.error(errUtil('Failed to fetch workers'))
					process.exit(1)
				}

				const workers = (await res.json()) as Array<{
					id: string
					status: string
					name?: string | null
					capabilities?: string | null
					last_heartbeat?: string | null
				}>

				console.log(section('Workers'))
				if (workers.length === 0) {
					console.log(dim('  No workers registered'))
					return
				}

				console.log(
					table(
						workers.map((w) => {
							let caps = ''
							try {
								const parsed = JSON.parse(w.capabilities ?? '[]') as Array<{ runtime: string; tags?: string[] }>
								caps = parsed.map((c) => {
									const tags = c.tags?.length ? ` [${c.tags.join(',')}]` : ''
									return `${c.runtime}${tags}`
								}).join(', ')
							} catch (err) { console.debug('[worker] malformed capabilities JSON:', (err as Error).message) }
							return [
								dim(w.id),
								badge(
									w.status,
									w.status === 'online' ? 'green' : w.status === 'busy' ? 'cyan' : 'red',
								),
								w.name ?? '',
								caps ? dim(caps) : '',
								w.last_heartbeat ? dim(w.last_heartbeat) : '',
							]
						}),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${workers.length} worker(s)`))
			} catch (err) {
				const { error: errUtil } = await import('../utils/format')
				console.error(errUtil(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(workerCmd)
