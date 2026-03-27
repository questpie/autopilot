import { Command } from 'commander'
import { readdir, rm, access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, table, success, error, warning, separator } from '../utils/format'

const DASHBOARD_PORT = 3000

const dashboardCmd = new Command('dashboard')
	.description('Manage the Living Dashboard')
	.action(async () => {
		try {
			const url = `http://localhost:${DASHBOARD_PORT}`
			console.log(dim(`Opening dashboard at ${url}...`))

			const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
			try {
				Bun.spawn([openCmd, url], { stdout: 'ignore', stderr: 'ignore' })
				console.log(success(`Dashboard opened in browser: ${url}`))
			} catch {
				console.log(dim(`Open manually: ${url}`))
			}
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

dashboardCmd.addCommand(
	new Command('dev')
		.description('Start Vite dev server with HMR for live editing')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dashboardDir = join(root, 'dashboard')

				try {
					await access(dashboardDir)
				} catch {
					console.error(error('Dashboard directory not found.'))
					console.error(dim(`Expected at: ${dashboardDir}`))
					process.exit(1)
				}

				console.log(section('Dashboard Dev Mode'))
				console.log(dim('Starting Vite dev server with HMR...\n'))

				const proc = Bun.spawn(
					['bunx', 'vite', '--port', String(DASHBOARD_PORT)],
					{
						cwd: dashboardDir,
						stdout: 'inherit',
						stderr: 'inherit',
					},
				)

				process.on('SIGINT', () => {
					proc.kill()
					process.exit(0)
				})

				await proc.exited
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

dashboardCmd.addCommand(
	new Command('build')
		.description('Build dashboard for production (static files)')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dashboardDir = join(root, 'dashboard')

				try {
					await access(dashboardDir)
				} catch {
					console.error(error('Dashboard directory not found.'))
					console.error(dim(`Expected at: ${dashboardDir}`))
					process.exit(1)
				}

				console.log(section('Dashboard Build'))
				console.log(dim('Building dashboard for production...\n'))

				const proc = Bun.spawn(['bunx', 'vite', 'build'], {
					cwd: dashboardDir,
					stdout: 'inherit',
					stderr: 'inherit',
				})

				const exitCode = await proc.exited
				if (exitCode === 0) {
					console.log('')
					console.log(success('Dashboard built successfully.'))
					console.log(dim('Static files are in dashboard/dist/'))
				} else {
					console.error(error(`Build failed with exit code ${exitCode}`))
					process.exit(1)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

dashboardCmd.addCommand(
	new Command('reset')
		.description('Reset dashboard to default (removes overrides, widgets, pages)')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dashboardDir = join(root, 'dashboard')

				const dirsToRemove = ['overrides', 'widgets', 'pages']

				console.log(section('Dashboard Reset'))
				console.log(dim('Removing customizations...\n'))

				for (const dir of dirsToRemove) {
					const dirPath = join(dashboardDir, dir)
					try {
						await access(dirPath)
						await rm(dirPath, { recursive: true })
						console.log(`  ${success('Removed')} ${dim(dir + '/')}`)
					} catch {
						console.log(`  ${dim('Skipped')} ${dim(dir + '/ (not found)')}`)
					}
				}

				console.log('')
				console.log(success('Dashboard reset to default.'))
				console.log(dim('Preserved: .artifact.yaml, pins/, groups.yaml'))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

dashboardCmd.addCommand(
	new Command('widgets')
		.description('List custom dashboard widgets')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const widgetsDir = join(root, 'dashboard', 'widgets')

				console.log(section('Dashboard Widgets'))

				let entries: string[]
				try {
					const dirEntries = await readdir(widgetsDir, { withFileTypes: true })
					entries = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name)
				} catch {
					console.log(dim('  No widgets directory found.'))
					console.log(dim('  Widgets live in dashboard/widgets/{name}/'))
					return
				}

				if (entries.length === 0) {
					console.log(dim('  No widgets found.'))
					return
				}

				const rows: string[][] = []
				for (const name of entries) {
					const yamlPath = join(widgetsDir, name, 'widget.yaml')
					try {
						const content = await readFile(yamlPath, 'utf-8')
						const meta = parse(content) as Record<string, unknown>
						rows.push([
							badge(name, 'cyan'),
							String(meta.title ?? name),
							dim(String(meta.size ?? 'medium')),
							dim(`${meta.refresh ?? 0}ms`),
						])
					} catch {
						rows.push([
							badge(name, 'yellow'),
							name,
							dim('unknown'),
							dim('—'),
						])
					}
				}

				console.log(table(rows))
				console.log('')
				console.log(separator())
				console.log(dim(`${entries.length} widget(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

dashboardCmd.addCommand(
	new Command('pages')
		.description('List custom dashboard pages')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const registryPath = join(root, 'dashboard', 'pages', 'registry.yaml')

				console.log(section('Dashboard Pages'))

				let content: string
				try {
					content = await readFile(registryPath, 'utf-8')
				} catch {
					console.log(dim('  No pages registry found.'))
					console.log(dim('  Create dashboard/pages/registry.yaml to register custom pages.'))
					return
				}

				const registry = parse(content) as { pages?: Array<Record<string, unknown>> }
				const pages = registry.pages ?? []

				if (pages.length === 0) {
					console.log(dim('  No custom pages registered.'))
					return
				}

				const rows: string[][] = []
				for (const page of pages) {
					rows.push([
						badge(String(page.id ?? 'unknown'), 'cyan'),
						String(page.title ?? ''),
						dim(String(page.path ?? '')),
						page.nav ? success('nav') : dim('hidden'),
					])
				}

				console.log(table(rows))
				console.log('')
				console.log(separator())
				console.log(dim(`${pages.length} page(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

program.addCommand(dashboardCmd)
