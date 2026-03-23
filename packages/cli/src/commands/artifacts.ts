import { Command } from 'commander'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ArtifactRouter } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, success, error, warning } from '../utils/format'

async function listArtifactConfigs(root: string): Promise<Array<{ id: string; name: string; serve: string }>> {
	const dir = join(root, 'artifacts')
	let entries: string[]
	try {
		const dirEntries = await readdir(dir, { withFileTypes: true })
		entries = dirEntries.filter((d) => d.isDirectory()).map((d) => d.name)
	} catch {
		return []
	}

	const results: Array<{ id: string; name: string; serve: string }> = []
	const router = new ArtifactRouter(root)

	for (const id of entries) {
		try {
			const config = await router.readConfig(id)
			results.push({ id, name: config.name, serve: config.serve })
		} catch {
			// skip directories without valid .artifact.yaml
		}
	}

	return results
}

const artifactsCmd = new Command('artifacts')
	.description('List and manage artifacts (dev servers)')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const artifacts = await listArtifactConfigs(root)

			console.log(header('Artifacts'))
			if (artifacts.length === 0) {
				console.log(dim('  No artifacts found'))
				console.log(dim('  Create artifacts/ directories with .artifact.yaml configs.'))
				return
			}

			console.log(
				table(
					artifacts.map((a) => [
						badge(a.id, 'cyan'),
						a.name,
						dim(a.serve),
					]),
				),
			)
			console.log('')
			console.log(dim(`${artifacts.length} artifact(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

artifactsCmd.addCommand(
	new Command('open')
		.description('Open an artifact in the browser (cold-starts if not running)')
		.argument('<name>', 'Artifact ID to open')
		.action(async (name: string) => {
			try {
				const root = await findCompanyRoot()
				const router = new ArtifactRouter(root)

				console.log(dim('Starting artifact...'))
				const { url } = await router.route(name)

				console.log(success(`Artifact "${name}" is running`))
				console.log(`  ${dim('URL:')} ${url}`)
				console.log('')

				// Try to open in browser
				const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
				try {
					Bun.spawn([openCmd, url], { stdout: 'ignore', stderr: 'ignore' })
					console.log(dim('Opened in browser.'))
				} catch {
					console.log(dim(`Open manually: ${url}`))
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

artifactsCmd.addCommand(
	new Command('stop')
		.description('Stop a running artifact dev server')
		.argument('<name>', 'Artifact ID to stop')
		.action(async (name: string) => {
			try {
				const root = await findCompanyRoot()
				const router = new ArtifactRouter(root)

				await router.stop(name)
				console.log(success(`Artifact "${name}" stopped.`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(artifactsCmd)
