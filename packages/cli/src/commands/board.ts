import { Command } from 'commander'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { listPins } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, dim, table, success, error, badge } from '../utils/format'

const boardCmd = new Command('board')
	.description('Show dashboard pins and alerts')
	.option('-g, --group <group>', 'Filter by group')
	.action(async (opts: { group?: string }) => {
		try {
			const root = await findCompanyRoot()
			const pins = await listPins(root, opts.group)

			console.log(header('Dashboard Board'))
			if (pins.length === 0) {
				console.log(dim('  No pins found'))
				return
			}

			// Group pins by group field
			const groups = new Map<string, typeof pins>()
			for (const pin of pins) {
				const group = pin.group ?? 'ungrouped'
				if (!groups.has(group)) groups.set(group, [])
				groups.get(group)!.push(pin)
			}

			for (const [group, groupPins] of groups) {
				console.log('')
				console.log(header(`  ${group.toUpperCase()}`))
				console.log(
					table(
						groupPins.map((p) => {
							const row = [
								dim(p.id),
								badge(p.type, p.type === 'error' ? 'red' : p.type === 'warning' ? 'yellow' : p.type === 'success' ? 'green' : 'cyan'),
								p.title,
								p.content ? dim(p.content.slice(0, 50) + (p.content.length > 50 ? '...' : '')) : '',
							]
							return row
						}),
					),
				)

				// Show actions for pins that have them
				for (const p of groupPins) {
					const meta = p.metadata as Record<string, unknown> | undefined
					const actions = meta?.actions as Array<{ label: string; action: string }> | undefined
					if (actions && actions.length > 0) {
						const actionStr = actions.map((a) => badge(a.label, 'magenta')).join(' ')
						console.log(`    ${dim(p.id)} ${actionStr}`)
					}
				}
			}

			console.log('')
			console.log(dim(`${pins.length} pin(s) in ${groups.size} group(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

boardCmd.addCommand(
	new Command('clear')
		.description('Remove all pins from the dashboard')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dir = join(root, 'dashboard', 'pins')

				let files: string[]
				try {
					files = await readdir(dir)
				} catch {
					console.log(dim('No pins to clear.'))
					return
				}

				const yamlFiles = files.filter((f) => f.endsWith('.yaml'))
				if (yamlFiles.length === 0) {
					console.log(dim('No pins to clear.'))
					return
				}

				for (const file of yamlFiles) {
					await rm(join(dir, file))
				}

				console.log(success(`Cleared ${yamlFiles.length} pin(s).`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(boardCmd)
