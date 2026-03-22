import { Command } from 'commander'
import { loadCompany, loadAgents, listTasks } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, error } from '../utils/format'

program.addCommand(
	new Command('status')
		.description('Show company overview and task summary')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)
				const tasks = await listTasks(root)

				const statusCounts: Record<string, number> = {}
				for (const task of tasks) {
					statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1
				}

				console.log(header(`QUESTPIE Autopilot — ${company.name}`))
				console.log(dim(`slug: ${company.slug} | timezone: ${company.timezone}`))
				console.log('')

				console.log(header('Agents'))
				console.log(
					table(
						agents.map((a) => [
							badge(a.role, 'cyan'),
							a.name,
							dim(a.id),
						]),
					),
				)
				console.log('')

				console.log(header('Tasks'))
				if (Object.keys(statusCounts).length === 0) {
					console.log(dim('  No tasks yet'))
				} else {
					console.log(
						table(
							Object.entries(statusCounts).map(([status, count]) => [
								`  ${status}`,
								String(count),
							]),
						),
					)
				}
				console.log('')
				console.log(dim(`Total: ${tasks.length} tasks | ${agents.length} agents`))
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				if (message.includes('company.yaml')) {
					console.log(error('No company directory found.'))
					console.log(dim("Run 'autopilot init' to create one first."))
				} else {
					console.log(error(`Failed to load status: ${message}`))
				}
				process.exit(1)
			}
		}),
)
