import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { z } from 'zod'
import { loadSkillCatalog } from '../../skills'
import type { AppEnv } from '../app'

const SkillMetadataSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	path: z.string(),
	roles: z.array(z.string()),
	size: z.number(),
	format: z.string(),
})

const SkillCatalogResponseSchema = z.object({
	skills: z.array(SkillMetadataSchema),
})

const skills = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['skills'],
		description: 'List the full skill catalog (agentskills, legacy, claude formats)',
		responses: {
			200: {
				description: 'Skill catalog',
				content: { 'application/json': { schema: resolver(SkillCatalogResponseSchema) } },
			},
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const catalog = await loadSkillCatalog(root)
		return c.json(catalog)
	},
)

export { skills }
