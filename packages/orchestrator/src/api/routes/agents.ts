import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { AgentSchema } from '@questpie/autopilot-spec'
import { loadAgents } from '../../fs/company'
import { container } from '../../container'
import { streamManagerFactory } from '../../session/stream'
import { eventBus } from '../../events/event-bus'
import type { AppEnv } from '../app'

/** Extended agent detail schema with memory stats and recent tasks. */
const AgentDetailSchema = AgentSchema.extend({
	memory: z
		.object({
			facts: z.number(),
			decisions: z.number(),
			mistakes: z.number(),
			patterns: z.number(),
		})
		.optional(),
	recentTasks: z
		.array(
			z.object({
				id: z.string(),
				title: z.string(),
				status: z.string(),
				created_at: z.string(),
			}),
		)
		.optional(),
	sessionStatus: z.enum(['working', 'idle']).optional(),
})

const agents = new Hono<AppEnv>()
	.get(
		'/',
		describeRoute({
			tags: ['agents'],
			description: 'List all agents defined in agents.yaml',
			responses: {
				200: {
					description: 'Array of agents',
					content: {
						'application/json': {
							schema: resolver(z.array(AgentSchema)),
						},
					},
				},
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const result = await loadAgents(root)
			return c.json(result, 200)
		},
	)
	.get(
		'/:id',
		describeRoute({
			tags: ['agents'],
			description:
				'Get extended agent detail including memory stats and recent tasks',
			responses: {
				200: {
					description: 'Agent detail',
					content: {
						'application/json': {
							schema: resolver(AgentDetailSchema),
						},
					},
				},
				404: { description: 'Agent not found' },
			},
		}),
		zValidator('param', z.object({ id: z.string() })),
		async (c) => {
			const root = c.get('companyRoot')
			const storage = c.get('storage')
			const { id } = c.req.valid('param')

			const allAgents = await loadAgents(root)
			const agent = allAgents.find((a) => a.id === id)
			if (!agent) return c.json({ error: 'agent not found' }, 404)

			let memory: z.infer<typeof AgentDetailSchema>['memory']
			try {
				const memoryPath = join(root, `team/${id}/memory.yaml`)
				const memFile = Bun.file(memoryPath)
				if (await memFile.exists()) {
					const content = await memFile.text()
					const countSection = (section: string): number => {
						const regex = new RegExp(`^${section}:([\\s\\S]*?)(?=^\\w|$)`, 'm')
						const match = content.match(regex)
						if (!match?.[1]) return 0
						return (match[1].match(/^\s*-\s/gm) ?? []).length
					}
					memory = {
						facts: countSection('facts'),
						decisions: countSection('decisions'),
						mistakes: countSection('mistakes'),
						patterns: countSection('patterns'),
					}
				}
			} catch {
				// Memory file may not exist
			}

			let recentTasks: z.infer<typeof AgentDetailSchema>['recentTasks']
			try {
				const allTasks = await storage.listTasks({ assigned_to: id })
				recentTasks = (allTasks as Array<{ id: string; title: string; status: string; created_at: string }>)
					.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
					.slice(0, 10)
					.map((t) => ({ id: t.id, title: t.title, status: t.status, created_at: t.created_at }))
			} catch {
				// Tasks may not exist
			}

			const { streamManager } = container.resolve([streamManagerFactory])
			const isWorking = streamManager.getActiveStreams().some((s) => s.agentId === id)

			return c.json({
				...agent,
				memory,
				recentTasks,
				sessionStatus: isWorking ? 'working' as const : 'idle' as const,
			}, 200)
		},
	)

	// ── PATCH /agents/:id — update agent fields (model, etc.) ────────────
	.patch(
		'/:id',
		describeRoute({
			tags: ['agents'],
			description: 'Update specific fields of an agent (e.g., model)',
			responses: {
				200: { description: 'Agent updated' },
				404: { description: 'Agent not found' },
			},
		}),
		zValidator('param', z.object({ id: z.string() })),
		zValidator('json', z.object({
			model: z.string().optional(),
			web_search: z.boolean().optional(),
		})),
		async (c) => {
			const actor = c.get('actor')
			if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) {
				return c.json({ error: 'only admin or owner can modify agents' }, 403)
			}

			const root = c.get('companyRoot')
			const { id } = c.req.valid('param')
			const updates = c.req.valid('json')

			const agentsPath = join(root, 'agents.yaml')
			const raw = await readFile(agentsPath, 'utf-8')
			const doc = parseYaml(raw) as { agents: Array<Record<string, unknown>> }

			if (!doc?.agents || !Array.isArray(doc.agents)) {
				return c.json({ error: 'Invalid agents.yaml structure' }, 400)
			}

			const agentIdx = doc.agents.findIndex((a) => a.id === id)
			if (agentIdx < 0) return c.json({ error: 'agent not found' }, 404)

			// Apply updates
			if (updates.model) {
				doc.agents[agentIdx]!.model = updates.model
			}
			if (updates.web_search !== undefined) {
				doc.agents[agentIdx]!.web_search = updates.web_search
			}

			await writeFile(agentsPath, stringifyYaml(doc, { lineWidth: 120 }), 'utf-8')
			eventBus.emit({ type: 'settings_changed' })

			return c.json({ ok: true, agent: doc.agents[agentIdx] }, 200)
		},
	)

export { agents }
