import { Command } from 'commander'
import { loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, error } from '../utils/format'

const agentsCmd = new Command('agents')
	.description('List all agents')
	.action(async () => {
		try {
			const root = await findCompanyRoot()
			const agents = await loadAgents(root)

			console.log(header('Agents'))
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
			console.log(dim(`${agents.length} agent(s)`))
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			if (message.includes('company.yaml')) {
				console.log(error('No company directory found.'))
				console.log(dim("Run 'autopilot init' to create one first."))
			} else {
				console.log(error(`Failed to load agents: ${message}`))
			}
			process.exit(1)
		}
	})

agentsCmd.addCommand(
	new Command('show')
		.description('Show agent details')
		.argument('<id>', 'Agent ID')
		.action(async (id: string) => {
			try {
				const root = await findCompanyRoot()
				const agents = await loadAgents(root)
				const agent = agents.find((a) => a.id === id)

				if (!agent) {
					console.log(error(`Agent not found: ${id}`))
					console.log(dim('Use `autopilot agents` to list all agents.'))
					process.exit(1)
				}

				console.log(header(agent.name))
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
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes('company.yaml')) {
					console.log(error('No company directory found.'))
					console.log(dim("Run 'autopilot init' to create one first."))
				} else {
					console.log(error(`Failed to load agent: ${message}`))
				}
				process.exit(1)
			}
		}),
)

program.addCommand(agentsCmd)
