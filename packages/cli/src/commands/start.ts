import { Command } from 'commander'
import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { Orchestrator, loadCompany, loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { brandHeader, success, dim, error, warning, separator, dot } from '../utils/format'

const CLI_ROOT = resolve(import.meta.dir, '..', '..')

/**
 * Resolve dashboard directory.
 * When installed from npm: packages/cli/../../apps/dashboard-v2
 * In Docker: /app/apps/dashboard-v2
 */
async function resolveDashboardDir(): Promise<string | null> {
	const candidates = [
		resolve(CLI_ROOT, '..', '..', 'apps', 'dashboard-v2'),
		'/app/apps/dashboard-v2',
	]
	for (const dir of candidates) {
		try {
			await access(join(dir, 'package.json'))
			return dir
		} catch {}
	}
	return null
}

program.addCommand(
	new Command('start')
		.description('Start the Autopilot orchestrator + dashboard')
		.option('-p, --port <port>', 'Server port', '7778')
		.option('--no-dashboard', 'Skip starting the dashboard')
		.option('--dashboard-port <port>', 'Dashboard dev server port', '3000')
		.action(async (opts: { port: string; dashboard: boolean; dashboardPort: string }) => {
			let dashboardProc: ChildProcess | null = null

			try {
				const root = await findCompanyRoot()
				const port = Number.parseInt(opts.port, 10)
				const dashboardPort = Number.parseInt(opts.dashboardPort, 10)

				const orchestrator = new Orchestrator({
					companyRoot: root,
					port,
				})

				await orchestrator.start()

				const company = await loadCompany(root)
				const agents = await loadAgents(root)

				// Start dashboard — static build served by API server, dev server spawned only if no build
				let dashboardBuilt = false
				if (opts.dashboard) {
					const dashDir = await resolveDashboardDir()
					if (dashDir) {
						const hasViteBuild = await access(join(dashDir, 'dist', 'index.html')).then(() => true).catch(() => false)
						const hasNitroBuild = await access(join(dashDir, '.output', 'public', 'index.html')).then(() => true).catch(() => false)
						dashboardBuilt = hasViteBuild || hasNitroBuild

						if (!dashboardBuilt) {
							// No static build — spawn dev server with HMR
							dashboardProc = spawn('bun', ['run', 'dev'], {
								cwd: dashDir,
								stdio: 'pipe',
								env: { ...process.env, PORT: String(dashboardPort) },
							})

							dashboardProc.stderr?.on('data', (data: Buffer) => {
								const line = data.toString().trim()
								if (line) console.log(dim(`  [dashboard] ${line}`))
							})

							dashboardProc.on('exit', (code) => {
								if (code && code !== 0) {
									console.log(warning(`Dashboard exited with code ${code}`))
								}
								dashboardProc = null
							})
						}
					} else {
						console.log(dim('  Dashboard not found, skipping (use --no-dashboard to suppress)'))
					}
				}

				console.log('')
				console.log(brandHeader(`${company.name}  │  ${agents.length} agents  │  ${root}`))
				console.log('')
				console.log(dim('  Endpoints:'))
				console.log(dim(`    Server     http://localhost:${port}`))
				console.log(dim(`    API        http://localhost:${port}/api/status`))
				console.log(dim(`    Webhooks   http://localhost:${port}/webhooks/`))
				console.log(dim(`    Files      http://localhost:${port}/fs/`))
				console.log(dim(`    Tasks      http://localhost:${port}/api/tasks`))
				console.log(dim(`    Agents     http://localhost:${port}/api/agents`))
				console.log(dim(`    Activity   http://localhost:${port}/api/activity`))
				if (dashboardBuilt) {
					console.log(dim(`    Dashboard  http://localhost:${port}`))
				} else if (dashboardProc) {
					console.log(dim(`    Dashboard  http://localhost:${dashboardPort} (dev)`))
				}
				console.log('')
				console.log(separator())
				console.log(`${dot('green')} ${success('Orchestrator is running.')}`)
				if (dashboardBuilt) {
					console.log(`${dot('green')} ${success('Dashboard served at /')}`)
				} else if (dashboardProc) {
					console.log(`${dot('green')} ${success('Dashboard dev server starting...')}`)
				}
				console.log(dim('Press Ctrl+C to stop'))
				console.log('')

				const shutdown = async () => {
					console.log('')
					console.log(warning('Shutting down...'))
					if (dashboardProc) {
						dashboardProc.kill('SIGTERM')
					}
					await orchestrator.stop()
					console.log(success('Stopped.'))
					process.exit(0)
				}

				process.on('SIGINT', shutdown)
				process.on('SIGTERM', shutdown)
			} catch (err) {
				if (dashboardProc) dashboardProc.kill('SIGTERM')
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
