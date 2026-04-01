import { StatusResponseSchema } from '@questpie/autopilot-spec'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import * as authSchema from '../../db/auth-schema'
import { loadAgents, loadCompany } from '../../fs/company'
import { container } from '../../container'
import { streamManagerFactory } from '../../session/stream'
import type { AppEnv } from '../app'

const status = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['status'],
		description: 'Company health check — name, users, agent count, active tasks, pending approvals',
		responses: {
			200: {
				description: 'Company status',
				content: { 'application/json': { schema: resolver(StatusResponseSchema) } },
			},
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const storage = c.get('storage')
		const db = c.get('db')

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

		let userCount = 0
		try {
			const row = await db
				.select({ count: sql<number>`count(*)` })
				.from(authSchema.user)
				.get()
			userCount = row?.count ?? 0
		} catch {
			// Auth tables may not exist yet during early startup
		}

		const { streamManager } = container.resolve([streamManagerFactory])
		const runningSessions = streamManager.getActiveStreams().length

		return c.json({
			company: company.name,
			userCount,
			setupCompleted: company.setup_completed ?? false,
			onboardingChatCompleted: company.onboarding_chat_completed ?? false,
			agentCount: agents.length,
			activeTasks: activeTasks.length,
			runningSessions,
			pendingApprovals: reviewTasks.length + blockedTasks.length,
		}, 200)
	},
)

export { status }
