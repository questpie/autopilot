import { Command } from 'commander'
import { loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { section, badge, dim, table, error, separator } from '../utils/format'

const agentsCmd = new Command('agents')
	.description('List all configured agents')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const agents = await loadAgents(root)

			console.log(section('Agents'))
			console.log('')
			console.log(
				table(
					agents.map((a) => [
						badge(a.role, 'cyan'),
						a.name,
						dim(a.id),
						dim(a.model),
					]),
				),
			)
			console.log('')
			console.log(separator())
			console.log(dim(`${agents.length} agent(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

agentsCmd.addCommand(
	new Command('show')
		.description('Show detailed information about a specific agent')
		.argument('<id>', 'Agent ID to inspect')
		.action(async (id: string) => {
			try {
				const root = await findCompanyRoot()
				const agents = await loadAgents(root)
				const agent = agents.find((a) => a.id === id)

				if (!agent) {
					console.error(error(`Agent not found: ${id}`))
					console.error(dim('Use "autopilot agents" to list all agents.'))
					process.exit(1)
				}

				console.log(section(agent.name))
				console.log('')
				console.log(`  ${dim('ID:')}          ${agent.id}`)
				console.log(`  ${dim('Role:')}        ${badge(agent.role, 'cyan')}`)
				console.log(`  ${dim('Model:')}       ${agent.model}`)
				console.log(`  ${dim('Description:')} ${agent.description}`)
				console.log('')
				console.log(dim('Tools:'))
				for (const tool of agent.tools) {
					console.log(`  - ${tool}`)
				}
				if (agent.mcps.length > 0) {
					console.log('')
					console.log(dim('MCPs:'))
					for (const mcp of agent.mcps) {
						console.log(`  - ${mcp}`)
					}
				}
				console.log('')
				console.log(dim('FS Scope:'))
				console.log(`  ${dim('Read:')}   ${agent.fs_scope.read.join(', ')}`)
				console.log(`  ${dim('Write:')}  ${agent.fs_scope.write.join(', ')}`)

				if (agent.triggers.length > 0) {
					console.log('')
					console.log(dim('Triggers:'))
					for (const trigger of agent.triggers) {
						const parts = [`on: ${trigger.on}`]
						if (trigger.status) parts.push(`status: ${trigger.status}`)
						if (trigger.cron) parts.push(`cron: ${trigger.cron}`)
						console.log(`  - ${parts.join(', ')}`)
					}
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(agentsCmd)
