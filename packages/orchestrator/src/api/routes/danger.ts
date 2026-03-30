/**
 * Danger zone routes — export, reset, and delete company data.
 */
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { readYamlUnsafe, fileExists } from '../../fs/yaml'
import { eventBus } from '../../events/event-bus'
import { schema } from '../../db'
import type { AppEnv } from '../app'
import { logger } from '../../logger'

// ── Schemas ─────────────────────────────────────────────────────────────────

const ConfirmSchema = z.object({ confirm: z.literal(true) })
const DeleteConfirmSchema = z.object({ confirm: z.literal('DELETE') })

const danger = new Hono<AppEnv>()
	// ── POST /export — export company data as JSON ────────────────────
	.post(
		'/export',
		describeRoute({
			tags: ['danger'],
			description: 'Export company data as a JSON download',
			responses: {
				200: { description: 'JSON export' },
				500: { description: 'Export failed' },
			},
		}),
		async (c) => {
			// Only owner or admin can export all data
			const actor = c.get('actor')
			if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
				return c.json({ error: 'only owner or admin can perform this action' }, 403)
			}

			try {
				const storage = c.get('storage')
				const companyRoot = c.get('companyRoot')

				// Collect all runtime data
				const [tasks, channels, activityEntries] = await Promise.all([
					storage.listTasks(),
					storage.listChannels(),
					storage.readActivity(),
				])

				// Collect messages per channel
				const allMessages: unknown[] = []
				for (const ch of channels) {
					const msgs = await storage.readMessages({ channel: ch.id, limit: 10000 })
					allMessages.push(...msgs)
				}

				// Read config files (best-effort)
				let company: unknown = null
				let agents: unknown = null
				let humans: unknown = null

				const companyPath = join(companyRoot, 'company.yaml')
				const agentsPath = join(companyRoot, 'team', 'agents.yaml')
				const humansPath = join(companyRoot, 'team', 'humans.yaml')

				if (await fileExists(companyPath)) {
					company = await readYamlUnsafe(companyPath)
				}
				if (await fileExists(agentsPath)) {
					agents = await readYamlUnsafe(agentsPath)
				}
				if (await fileExists(humansPath)) {
					humans = await readYamlUnsafe(humansPath)
				}

				const exportData = {
					exported_at: new Date().toISOString(),
					tasks,
					messages: allMessages,
					channels,
					activity: activityEntries,
					company,
					agents,
					humans,
				}

				const body = JSON.stringify(exportData, null, 2)
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

				return new Response(body, {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Content-Disposition': `attachment; filename="autopilot-export-${timestamp}.json"`,
					},
				})
			} catch (err) {
				logger.error('api', 'danger/export failed', { error: err instanceof Error ? err.message : String(err) })
				return c.json({ error: 'Export failed', detail: String(err) }, 500)
			}
		},
	)
	// ── POST /reset — reset runtime data ────────────────────────────
	.post(
		'/reset',
		describeRoute({
			tags: ['danger'],
			description: 'Reset all runtime data (tasks, messages, activity, sessions, pins, notifications)',
			responses: {
				200: {
					description: 'Reset complete',
					content: {
						'application/json': {
							schema: resolver(z.object({ ok: z.literal(true), message: z.string() })),
						},
					},
				},
				400: { description: 'Missing confirmation' },
				500: { description: 'Reset failed' },
			},
		}),
		zValidator('json', ConfirmSchema),
		async (c) => {
			// Only owner or admin can reset runtime data
			const actor = c.get('actor')
			if (!actor || (actor.role !== 'owner' && actor.role !== 'admin')) {
				return c.json({ error: 'only owner or admin can perform this action' }, 403)
			}

			const body = c.req.valid('json' as never) as z.infer<typeof ConfirmSchema>
			if (body.confirm !== true) {
				return c.json({ error: 'Missing confirmation. Send { "confirm": true }' }, 400)
			}

			try {
				const db = c.get('db')

				// Delete runtime tables in dependency-safe order
				await db.delete(schema.notifications)
				await db.delete(schema.pins)
				await db.delete(schema.agentSessions)
				await db.delete(schema.activity)
				await db.delete(schema.messages)
				await db.delete(schema.tasks)
				await db.delete(schema.searchIndex)

				// Clear FTS tables (raw SQL required for virtual tables)
				const raw = (db as unknown as { $client: import('@libsql/client').Client }).$client
				try { await raw.execute(`DELETE FROM search_fts`) } catch { /* may not exist */ }
				try { await raw.execute(`DELETE FROM messages_fts`) } catch { /* may not exist */ }

				// Notify dashboard to refresh
				eventBus.emit({ type: 'settings_changed' })

				return c.json({ ok: true as const, message: 'All runtime data has been reset' })
			} catch (err) {
				logger.error('api', 'danger/reset failed', { error: err instanceof Error ? err.message : String(err) })
				return c.json({ error: 'Reset failed', detail: String(err) }, 500)
			}
		},
	)
	// ── POST /delete-company — permanently delete company data ───────
	.post(
		'/delete-company',
		describeRoute({
			tags: ['danger'],
			description: 'Permanently delete all company data (.data directory)',
			responses: {
				200: {
					description: 'Company deleted',
					content: {
						'application/json': {
							schema: resolver(z.object({ ok: z.literal(true), message: z.string() })),
						},
					},
				},
				400: { description: 'Missing confirmation' },
				403: { description: 'Only the owner can delete the company' },
				500: { description: 'Delete failed' },
			},
		}),
		zValidator('json', DeleteConfirmSchema),
		async (c) => {
			const body = c.req.valid('json' as never) as z.infer<typeof DeleteConfirmSchema>
			if (body.confirm !== 'DELETE') {
				return c.json({ error: 'Missing confirmation. Send { "confirm": "DELETE" }' }, 400)
			}

			// Explicit owner check (defense-in-depth on top of RBAC middleware)
			const actor = c.get('actor')
			if (!actor || actor.role !== 'owner') {
				return c.json({ error: 'Only the owner can delete the company' }, 403)
			}

			try {
				const companyRoot = c.get('companyRoot')
				const dataDir = join(companyRoot, '.data')

				// Close the DB connection before deleting the files
				const db = c.get('db')
				const raw = (db as unknown as { $client: import('@libsql/client').Client }).$client
				try { raw.close() } catch { /* already closed */ }

				// Remove the entire .data directory
				await rm(dataDir, { recursive: true, force: true })

				return c.json({
					ok: true as const,
					message: 'Company data deleted. Please restart the server.',
				})
			} catch (err) {
				logger.error('api', 'danger/delete-company failed', { error: err instanceof Error ? err.message : String(err) })
				return c.json({ error: 'Delete failed', detail: String(err) }, 500)
			}
		},
	)

export { danger }
