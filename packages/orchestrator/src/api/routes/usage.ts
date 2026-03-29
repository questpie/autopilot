/**
 * D39: Usage stats API — token counts per session, per agent.
 * Cloud repo polls this for billing/metering.
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import type { Client } from '@libsql/client'
import type { AppEnv } from '../app'

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
			const raw = (db as unknown as { $client: Client }).$client

			// Per-agent stats
			let perAgent: Array<{
				agent_id: string
				session_count: number
				total_tool_calls: number
				total_tokens: number
			}> = []

			try {
				const result = await raw.execute(`
					SELECT
						agent_id,
						COUNT(*) as session_count,
						COALESCE(SUM(tool_calls), 0) as total_tool_calls,
						COALESCE(SUM(tokens_used), 0) as total_tokens
					FROM agent_sessions
					GROUP BY agent_id
					ORDER BY total_tokens DESC
				`)
				perAgent = result.rows.map((r) => ({
					agent_id: r.agent_id as string,
					session_count: Number(r.session_count),
					total_tool_calls: Number(r.total_tool_calls),
					total_tokens: Number(r.total_tokens),
				}))
			} catch {
				// Table may not exist
			}

			// Totals
			let totals = { sessions: 0, tool_calls: 0, tokens: 0 }
			try {
				const result = await raw.execute(`
					SELECT
						COUNT(*) as sessions,
						COALESCE(SUM(tool_calls), 0) as tool_calls,
						COALESCE(SUM(tokens_used), 0) as tokens
					FROM agent_sessions
				`)
				const r = result.rows[0]
				if (r) {
					totals = {
						sessions: Number(r.sessions),
						tool_calls: Number(r.tool_calls),
						tokens: Number(r.tokens),
					}
				}
			} catch { /* table may not exist */ }

			// Recent 24h
			let last24h = { sessions: 0, tokens: 0 }
			try {
				const result = await raw.execute(`
					SELECT
						COUNT(*) as sessions,
						COALESCE(SUM(tokens_used), 0) as tokens
					FROM agent_sessions
					WHERE started_at > datetime('now', '-24 hours')
				`)
				const r = result.rows[0]
				if (r) {
					last24h = { sessions: Number(r.sessions), tokens: Number(r.tokens) }
				}
			} catch { /* table may not exist */ }

			return c.json({ totals, last24h, perAgent })
		},
	)

export { usage }
