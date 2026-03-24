import { Command } from 'commander'
import { loadCompany, loadAgents, listTasks, readActivity } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, badge, dim, table, error } from '../utils/format'

const API_BASE = 'http://localhost:7778'

async function fetchSessions(): Promise<Array<{ sessionId: string; agentId: string }>> {
	try {
		const res = await fetch(`${API_BASE}/api/status`)
		if (!res.ok) return []
		const data = (await res.json()) as { sessions?: Array<{ sessionId: string; agentId: string }> }
		return data.sessions ?? []
	} catch {
		return []
	}
}

program.addCommand(
	new Command('status')
		.description('Show company overview, agents, and task summary')
		.option('-a, --activity <count>', 'Number of recent activity entries to show (default: 3)', '3')
		.action(async (options: { activity?: string }) => {
			try {
				const root = await findCompanyRoot()
				const company = await loadCompany(root)
				const agents = await loadAgents(root)
				const tasks = await listTasks(root)

				const statusCounts: Record<string, number> = {}
				for (const task of tasks) {
					statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1
				}

				console.log(header(`QUESTPIE Autopilot \u2014 ${company.name}`))
				console.log(dim(`slug: ${company.slug} | timezone: ${company.timezone}`))
				console.log('')

				// Running sessions
				const sessions = await fetchSessions()
				if (sessions.length > 0) {
					console.log(header('Running Sessions'))
					console.log(
						table(
							sessions.map((s) => [
								badge(s.agentId, 'green'),
								dim(s.sessionId),
							]),
						),
					)
					console.log('')
				}

				// Last activity
				const activityLimit = Math.min(Math.max(parseInt(options.activity || '3', 10) || 3, 1), 20)
				const activity = await readActivity(root, { limit: activityLimit })
				if (activity.length > 0) {
					const activityHeader = activityLimit > 3 ? `Recent Activity (${activityLimit})` : 'Recent Activity'
					console.log(header(activityHeader))
					for (const entry of activity) {
						const time = new Date(entry.at).toLocaleTimeString('en-GB', {
							hour: '2-digit',
							minute: '2-digit',
						})
						console.log(`  ${dim(time)} ${badge(entry.agent, 'cyan')} ${entry.summary}`)
					}
					console.log('')
				}

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
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
