import { Hono } from 'hono'
import { validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import type { AppEnv } from '../app'

const projectInputSchema = z.object({
	name: z.string().min(1).optional(),
	path: z.string().min(1),
	git_remote: z.string().optional(),
	default_branch: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
})

const projectsRoute = new Hono<AppEnv>()
	.get('/', async (c) => {
		const { projectService } = c.get('services')
		return c.json(await projectService.list(), 200)
	})
	.get('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
		const { projectService } = c.get('services')
		const { id } = c.req.valid('param')
		const project = await projectService.get(id)
		if (!project) return c.json({ error: 'project not found' }, 404)
		return c.json(project, 200)
	})
	.post('/', zValidator('json', projectInputSchema), async (c) => {
		const { projectService } = c.get('services')
		const body = c.req.valid('json')
		return c.json(await projectService.register(body), 200)
	})
	.delete('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
		const { projectService } = c.get('services')
		const { id } = c.req.valid('param')
		const deleted = await projectService.unregister(id)
		if (!deleted) return c.json({ error: 'project not found' }, 404)
		return c.json({ ok: true, deleted: id }, 200)
	})

export { projectsRoute }
