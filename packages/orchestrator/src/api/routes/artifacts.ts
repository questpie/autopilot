import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ArtifactRouter } from '../../artifact'
import type { AppEnv } from '../app'

/** Lazily-created ArtifactRouter instances keyed by companyRoot. */
const routers = new Map<string, ArtifactRouter>()

function getRouter(companyRoot: string): ArtifactRouter {
	let router = routers.get(companyRoot)
	if (!router) {
		router = new ArtifactRouter(companyRoot)
		routers.set(companyRoot, router)
	}
	return router
}

const ArtifactConfigSchema = z.object({
	id: z.string(),
	name: z.string(),
	serve: z.string(),
	build: z.string().optional(),
	health: z.string().optional(),
	timeout: z.string().optional(),
})

const ArtifactListResponseSchema = z.object({
	artifacts: z.array(ArtifactConfigSchema),
})

const ArtifactIdParamSchema = z.object({
	id: z.string(),
})

const ArtifactStartResponseSchema = z.object({
	id: z.string(),
	port: z.number(),
	url: z.string(),
})

const ArtifactStopResponseSchema = z.object({
	ok: z.literal(true),
})

const artifacts = new Hono<AppEnv>().get(
	'/',
	describeRoute({
		tags: ['artifacts'],
		description: 'List artifact configurations discovered under artifacts/',
		responses: {
			200: {
				description: 'Artifact listing',
				content: { 'application/json': { schema: resolver(ArtifactListResponseSchema) } },
			},
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const router = getRouter(root)
		const artifactsDir = join(root, 'artifacts')

		let entries: string[]
		try {
			entries = await readdir(artifactsDir)
		} catch {
			return c.json({ artifacts: [] })
		}

		const running = router.list()
		const runningMap = new Map(running.map((p) => [p.id, p]))

		const configs = await Promise.all(
			entries.map(async (id) => {
				try {
					const config = await router.readConfig(id)
					const proc = runningMap.get(id)
					return {
						id,
						...config,
						status: proc ? 'running' as const : 'stopped' as const,
						port: proc?.port ?? null,
					}
				} catch {
					return null
				}
			}),
		)

		return c.json({
			artifacts: configs.filter((c): c is NonNullable<typeof c> => c !== null),
		})
	},
).post(
	'/:id/start',
	describeRoute({
		tags: ['artifacts'],
		description: 'Start (cold-start) an artifact dev-server',
		responses: {
			200: {
				description: 'Artifact started',
				content: { 'application/json': { schema: resolver(ArtifactStartResponseSchema) } },
			},
		},
	}),
	zValidator('param', ArtifactIdParamSchema),
	async (c) => {
		const root = c.get('companyRoot')
		const { id } = c.req.valid('param')
		const router = getRouter(root)

		try {
			await router.readConfig(id)
		} catch {
			return c.json({ error: `Artifact "${id}" not found` }, 404)
		}

		const result = await router.route(id)
		return c.json({ id, port: result.port, url: result.url })
	},
).post(
	'/:id/stop',
	describeRoute({
		tags: ['artifacts'],
		description: 'Stop a running artifact dev-server',
		responses: {
			200: {
				description: 'Artifact stopped',
				content: { 'application/json': { schema: resolver(ArtifactStopResponseSchema) } },
			},
		},
	}),
	zValidator('param', ArtifactIdParamSchema),
	async (c) => {
		const root = c.get('companyRoot')
		const { id } = c.req.valid('param')
		const router = getRouter(root)

		await router.stop(id)
		return c.json({ ok: true as const })
	},
)

export { artifacts }
