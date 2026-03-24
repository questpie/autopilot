import { Command } from 'commander'
import { loadCompany, loadAgents } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { brandHeader, section, badge, dim, table, error, dot, separator } from '../utils/format'
import { getClient } from '../utils/client'

program.addCommand(
	new Command('status')
		.description('Show company overview, agents, and task summary')
		.option('-a, --activity <count>', 'Number of recent activity entries to show (default: 3)', '3')
		.action(async (options: { activity?: string }) => {
			try {
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)
				const client = getClient()

				const tasksRes = await client.api.tasks.$get({ query: {} })
				const tasks = tasksRes.ok ? ((await tasksRes.json()) as Array<{ id: string; status: string }>) : []

				const statusCounts: Record<string, number> = {}
				for (const task of tasks) {
					statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1
				}

				console.log(brandHeader(`${company.name}  \u2502  slug: ${company.slug}  \u2502  tz: ${company.timezone}`))
				console.log('')

				// Running sessions
				const statusRes = await client.api.status.$get()
				const statusData = statusRes.ok ? ((await statusRes.json()) as { sessions?: Array<{ sessionId: string; agentId: string }> }) : null
				const sessions = statusData?.sessions ?? []
				if (sessions.length > 0) {
					console.log(section('Running Sessions'))
					console.log(
						table(
							sessions.map((s) => [
								`${dot('green')} ${s.agentId}`,
								dim(s.sessionId),
							]),
						),
					)
					console.log('')
				}

				// Last activity
				const activityLimit = Math.min(Math.max(parseInt(options.activity || '3', 10) || 3, 1), 20)
				const activityRes = await client.api.activity.$get({ query: { limit: String(activityLimit) } })
				const activity = activityRes.ok ? ((await activityRes.json()) as Array<{ at: string; agent: string; summary: string }>) : []
				if (activity.length > 0) {
					const activityHeader = activityLimit > 3 ? `Recent Activity (${activityLimit})` : 'Recent Activity'
					console.log(section(activityHeader))
					for (const entry of activity) {
						const time = new Date(entry.at).toLocaleTimeString('en-GB', {
							hour: '2-digit',
							minute: '2-digit',
						})
						console.log(`  ${dim(time)} ${badge(entry.agent, 'cyan')} ${entry.summary}`)
					}
					console.log('')
				}

				console.log(section('Agents'))
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

				console.log(section('Tasks'))
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
				console.log(separator())
				console.log(dim(`Total: ${tasks.length} tasks | ${agents.length} agents`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
