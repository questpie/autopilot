import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { StatusResponseSchema } from '@questpie/autopilot-spec'
import { loadCompany, loadAgents } from '../../fs/company'
import type { AppEnv } from '../app'

const status = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['status'],
		description: 'Company health check — name, agent count, active tasks, pending approvals',
		responses: {
			200: { description: 'Company status', content: { 'application/json': { schema: resolver(StatusResponseSchema) } } },
		},
	}),
	async (c) => {
		const actor = c.get('actor')

		// Unauthenticated requests receive minimal response
		if (!actor) {
			return c.json({ status: 'ok' })
		}

		const root = c.get('companyRoot')
		const storage = c.get('storage')

		const company = await loadCompany(root)

		let agents: unknown[] = []
		try {
			agents = await loadAgents(root)
		} catch {
			// no agents file
		}

		const [activeTasks, reviewTasks, blockedTasks] = await Promise.all([
			storage.listTasks({ status: 'in_progress' }).catch(() => []),
			storage.listTasks({ status: 'review' }).catch(() => []),
			storage.listTasks({ status: 'blocked' }).catch(() => []),
		])

		return c.json({
			company: company.name,
			agentCount: agents.length,
			activeTasks: activeTasks.length,
			runningSessions: 0,
			pendingApprovals: reviewTasks.length + blockedTasks.length,
		})
	},
)

export { status }
