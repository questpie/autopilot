import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { ConfigEntityType } from '../../config/config-service'
import { listDefaultSkills, seedDefaultSkills } from '../../config/default-skills'
import type { AppEnv } from '../app'
import { requireOwnerOrAdmin } from '../middleware/roles'

const configTypeSchema = z.enum([
	'company',
	'project',
	'agents',
	'workflows',
	'environments',
	'providers',
	'capabilities',
	'skills',
	'scripts',
	'context',
])

const querySchema = z.object({
	project_id: z.string().optional(),
})

const configRoute = new Hono<AppEnv>()
	// GET /skills/_defaults — list the canonical default skill catalog (read-only).
	// Surfaces availability metadata (built_in vs plugin_backed) so the UI can
	// distinguish "configured here" from "actually installed on a worker".
	.get('/skills/_defaults', (c) => {
		const defaults = listDefaultSkills().map((skill) => ({
			id: skill.id,
			availability: skill.availability,
			name: skill.manifest.name,
			description: skill.manifest.description,
			tags: skill.manifest.tags,
			roles: skill.manifest.roles,
		}))
		return c.json(defaults, 200)
	})
	// POST /skills/_seed-defaults — idempotently insert any missing default
	// skill catalog records. Existing records are preserved.
	.post('/skills/_seed-defaults', requireOwnerOrAdmin(), async (c) => {
		const configService = c.get('services').configService
		if (!configService) return c.json({ error: 'config service not available' }, 503)
		const result = await seedDefaultSkills(configService)
		return c.json(result, 200)
	})
	.get(
		'/:type',
		zValidator('param', z.object({ type: configTypeSchema })),
		zValidator('query', querySchema),
		async (c) => {
			const configService = c.get('services').configService
			if (!configService) return c.json({ error: 'config service not available' }, 503)
			const { type } = c.req.valid('param')
			const { project_id } = c.req.valid('query')
			return c.json(await configService.list(type as ConfigEntityType, project_id ?? null), 200)
		},
	)
	.get(
		'/:type/:id',
		zValidator('param', z.object({ type: configTypeSchema, id: z.string() })),
		zValidator('query', querySchema),
		async (c) => {
			const configService = c.get('services').configService
			if (!configService) return c.json({ error: 'config service not available' }, 503)
			const { type, id } = c.req.valid('param')
			const { project_id } = c.req.valid('query')
			const record = await configService.get(type as ConfigEntityType, id, project_id ?? null)
			if (!record) return c.json({ error: 'config record not found' }, 404)
			return c.json(record, 200)
		},
	)
	.post(
		'/:type',
		requireOwnerOrAdmin(),
		zValidator('param', z.object({ type: configTypeSchema })),
		zValidator(
			'json',
			z.object({
				id: z.string().optional(),
				project_id: z.string().optional(),
				data: z.unknown(),
			}),
		),
		async (c) => {
			const configService = c.get('services').configService
			if (!configService) return c.json({ error: 'config service not available' }, 503)
			const { type } = c.req.valid('param')
			const body = c.req.valid('json')
			const id = body.id ?? (type === 'company' ? 'company' : body.project_id)
			if (!id) return c.json({ error: 'config id is required' }, 400)
			return c.json(
				await configService.set(type as ConfigEntityType, id, body.data, body.project_id ?? null),
				200,
			)
		},
	)
	.put(
		'/:type/:id',
		requireOwnerOrAdmin(),
		zValidator('param', z.object({ type: configTypeSchema, id: z.string() })),
		zValidator(
			'json',
			z.object({
				project_id: z.string().optional(),
				data: z.unknown(),
			}),
		),
		async (c) => {
			const configService = c.get('services').configService
			if (!configService) return c.json({ error: 'config service not available' }, 503)
			const { type, id } = c.req.valid('param')
			const body = c.req.valid('json')
			return c.json(
				await configService.set(type as ConfigEntityType, id, body.data, body.project_id ?? null),
				200,
			)
		},
	)
	.delete(
		'/:type/:id',
		requireOwnerOrAdmin(),
		zValidator('param', z.object({ type: configTypeSchema, id: z.string() })),
		zValidator('query', querySchema),
		async (c) => {
			const configService = c.get('services').configService
			if (!configService) return c.json({ error: 'config service not available' }, 503)
			const { type, id } = c.req.valid('param')
			const { project_id } = c.req.valid('query')
			const deleted = await configService.delete(type as ConfigEntityType, id, project_id ?? null)
			if (!deleted) return c.json({ error: 'config record not found' }, 404)
			return c.json({ ok: true, deleted: id }, 200)
		},
	)

export { configRoute }
