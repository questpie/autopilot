/**
 * D39: Usage stats API — token counts per session, per agent.
 * Cloud repo polls this for billing/metering.
 */
import { desc, gt, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import * as schema from '../../db/schema'
import type { AppEnv } from '../app'

const sessionCountExpr = sql<number>`count(*)`
const totalToolCallsExpr = sql<number>`coalesce(sum(${schema.agentSessions.tool_calls}), 0)`
const totalTokensExpr = sql<number>`coalesce(sum(${schema.agentSessions.tokens_used}), 0)`
const recent24HoursExpr = sql`datetime('now', '-24 hours')`

const usage = new Hono<AppEnv>()
	// GET /api/usage — aggregate usage stats
	.get(
		'/',
		describeRoute({
			tags: ['usage'],
			description: 'Aggregate usage stats: tokens per agent, session counts, total tokens',
			responses: { 200: { description: 'Usage stats' } },
		}),
		async (c) => {
			const db = c.get('db')

			// Per-agent stats
			let perAgent: Array<{
				agent_id: string
				session_count: number
				total_tool_calls: number
				total_tokens: number
			}> = []

			try {
				perAgent = await db
					.select({
						agent_id: schema.agentSessions.agent_id,
						session_count: sessionCountExpr,
						total_tool_calls: totalToolCallsExpr,
						total_tokens: totalTokensExpr,
					})
					.from(schema.agentSessions)
					.groupBy(schema.agentSessions.agent_id)
					.orderBy(desc(totalTokensExpr))
			} catch {
				// Table may not exist
			}

			// Totals
			let totals = { sessions: 0, tool_calls: 0, tokens: 0 }
			try {
				const r = await db
					.select({
						sessions: sessionCountExpr,
						tool_calls: totalToolCallsExpr,
						tokens: totalTokensExpr,
					})
					.from(schema.agentSessions)
					.get()
				if (r) {
					totals = {
						sessions: r.sessions,
						tool_calls: r.tool_calls,
						tokens: r.tokens,
					}
				}
			} catch { /* table may not exist */ }

			// Recent 24h
			let last24h = { sessions: 0, tokens: 0 }
			try {
				const r = await db
					.select({
						sessions: sessionCountExpr,
						tokens: totalTokensExpr,
					})
					.from(schema.agentSessions)
					.where(gt(schema.agentSessions.started_at, recent24HoursExpr))
					.get()
				if (r) {
					last24h = { sessions: r.sessions, tokens: r.tokens }
				}
			} catch { /* table may not exist */ }

			return c.json({ totals, last24h, perAgent })
		},
	)

export { usage }
