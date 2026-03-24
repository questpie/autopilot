import { Command } from 'commander'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { readYamlUnsafe, writeYaml } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, dim, table, success, error, badge, separator } from '../utils/format'

const secretsCmd = new Command('secrets')
	.description('Manage secrets (API keys, tokens, credentials)')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const dir = join(root, 'secrets')
			let files: string[]
			try {
				files = await readdir(dir)
			} catch {
				files = []
			}

			const secrets = files.filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, ''))

			console.log(section('Secrets'))
			if (secrets.length === 0) {
				console.log(dim('  No secrets found'))
				return
			}

			console.log(
				table(
					secrets.map((name) => [
						badge(name, 'cyan'),
						dim('********'),
					]),
				),
			)
			console.log('')
			console.log(separator())
			console.log(dim(`${secrets.length} secret(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

secretsCmd.addCommand(
	new Command('list')
		.description('List all secrets with metadata (names only, not values)')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dir = join(root, 'secrets')
				let files: string[]
				try {
					files = await readdir(dir)
				} catch {
					files = []
				}

				const secrets: Array<{ name: string; data: Record<string, unknown> }> = []
				for (const file of files) {
					if (!file.endsWith('.yaml')) continue
					try {
						const data = await readYamlUnsafe(join(dir, file)) as Record<string, unknown>
						secrets.push({ name: file.replace(/\.yaml$/, ''), data })
					} catch {
						// skip invalid
					}
				}

				console.log(section('Secrets'))
				if (secrets.length === 0) {
					console.log(dim('  No secrets found'))
					return
				}

				console.log(
					table(
						secrets.map((s) => [
							badge(s.name, 'cyan'),
							dim(String(s.data.type ?? 'api_token')),
							s.data.allowed_agents
								? dim(`agents: ${(s.data.allowed_agents as string[]).join(', ')}`)
								: dim('agents: all'),
						]),
					),
				)
				console.log('')
				console.log(separator())
				console.log(dim(`${secrets.length} secret(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

secretsCmd.addCommand(
	new Command('add')
		.description('Add a new secret')
		.argument('<name>', 'Secret name (used as filename)')
		.option('--value <value>', 'Secret value (API key, token)')
		.option('--agents <agents>', 'Comma-separated list of allowed agent IDs')
		.option('--type <type>', 'Secret type (e.g. api_token, oauth, ssh_key)', 'api_token')
		.action(async (name: string, opts: { value?: string; agents?: string; type: string }) => {
			try {
				if (!opts.value) {
					console.error(error('--value is required'))
					console.error(dim('Run "autopilot secrets add --help" for usage information.'))
					process.exit(1)
				}

				const root = await findCompanyRoot()
				const filePath = join(root, 'secrets', `${name}.yaml`)

				const secret = {
					service: name,
					type: opts.type,
					value: opts.value,
					allowed_agents: opts.agents ? opts.agents.split(',').map((a) => a.trim()) : [],
					created_at: new Date().toISOString(),
					created_by: 'human:owner',
					usage: {},
				}

				await writeYaml(filePath, secret)
				console.log(success(`Secret '${name}' added.`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

secretsCmd.addCommand(
	new Command('remove')
		.description('Remove a secret by name')
		.argument('<name>', 'Secret name to remove')
		.action(async (name: string) => {
			try {
				const root = await findCompanyRoot()
				const filePath = join(root, 'secrets', `${name}.yaml`)

				try {
					await rm(filePath)
					console.log(success(`Secret '${name}' removed.`))
				} catch {
					console.error(error(`Secret not found: ${name}`))
					console.error(dim('Use "autopilot secrets list" to see available secrets.'))
					process.exit(1)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(secretsCmd)
