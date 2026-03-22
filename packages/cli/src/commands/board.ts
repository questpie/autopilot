import { Command } from 'commander'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { listPins } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, dim, table, success, error, badge } from '../utils/format'

const boardCmd = new Command('board')
	.description('Show dashboard pins and alerts')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const pins = await listPins(root)

			console.log(header('Dashboard Board'))
			if (pins.length === 0) {
				console.log(dim('  No pins found'))
				return
			}

			console.log(
				table(
					pins.map((p) => [
						dim(p.id),
						badge(p.type, p.type === 'alert' ? 'red' : p.type === 'status' ? 'green' : 'cyan'),
						badge(p.group, 'magenta'),
						p.title,
						p.content ? dim(p.content.slice(0, 60) + (p.content.length > 60 ? '...' : '')) : '',
					]),
				),
			)
			console.log('')
			console.log(dim(`${pins.length} pin(s)`))
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
