import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import { resolver, validator as zValidator } from 'hono-openapi'
import { z } from 'zod'
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { readYamlUnsafe, fileExists } from '../../fs/yaml'
import type { AppEnv } from '../app'

const WidgetSummarySchema = z.object({
	name: z.string(),
	description: z.string().optional(),
})

const dashboard = new Hono<AppEnv>()
	// ── GET /dashboard/layout ───────────────────────────────────────────
	.get(
		'/dashboard/layout',
		describeRoute({
			tags: ['dashboard'],
			description: 'Read the dashboard layout override YAML',
			responses: {
				200: { description: 'Layout configuration' },
				404: { description: 'No layout override found' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const layoutPath = join(root, 'dashboard', 'layout.yaml')

			if (!(await fileExists(layoutPath))) {
				return c.json({ error: 'no layout override found' }, 404)
			}

			const layout = await readYamlUnsafe(layoutPath)
			return c.json(layout)
		},
	)
	// ── GET /dashboard/widgets ──────────────────────────────────────────
	.get(
		'/dashboard/widgets',
		describeRoute({
			tags: ['dashboard'],
			description: 'List available dashboard widget definitions',
			responses: {
				200: {
					description: 'Widget catalog',
					content: {
						'application/json': {
							schema: resolver(z.object({ widgets: z.array(WidgetSummarySchema) })),
						},
					},
				},
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const widgetsDir = join(root, 'dashboard', 'widgets')

			let entries: string[]
			try {
				entries = await readdir(widgetsDir)
			} catch {
				return c.json({ widgets: [] })
			}

			const widgets = await Promise.all(
				entries
					.filter((e) => e.endsWith('.yaml') || e.endsWith('.yml'))
					.map(async (file) => {
						const name = file.replace(/\.ya?ml$/, '')
						try {
							const data = (await readYamlUnsafe(join(widgetsDir, file))) as Record<string, unknown>
							return { name, description: (data.description as string) ?? undefined }
						} catch {
							return { name }
						}
					}),
			)

			return c.json({ widgets })
		},
	)
	// ── GET /dashboard/widgets/:name ────────────────────────────────────
	.get(
		'/dashboard/widgets/:name',
		describeRoute({
			tags: ['dashboard'],
			description: 'Read a single widget definition by name',
			responses: {
				200: { description: 'Widget definition' },
				404: { description: 'Widget not found' },
			},
		}),
		zValidator('param', z.object({ name: z.string() })),
		async (c) => {
			const root = c.get('companyRoot')
			const { name } = c.req.valid('param')
			const widgetPath = join(root, 'dashboard', 'widgets', `${name}.yaml`)

			if (!(await fileExists(widgetPath))) {
				return c.json({ error: 'widget not found' }, 404)
			}

			const widget = await readYamlUnsafe(widgetPath)
			return c.json(widget)
		},
	)
	// ── GET /dashboard/pages ────────────────────────────────────────────
	.get(
		'/dashboard/pages',
		describeRoute({
			tags: ['dashboard'],
			description: 'List registered dashboard pages',
			responses: {
				200: { description: 'Page registry' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const pagesPath = join(root, 'dashboard', 'pages.yaml')

			if (!(await fileExists(pagesPath))) {
				return c.json({ pages: [] })
			}

			const pages = await readYamlUnsafe(pagesPath)
			return c.json({ pages })
		},
	)
	// ── GET /groups ─────────────────────────────────────────────────────
	.get(
		'/groups',
		describeRoute({
			tags: ['dashboard'],
			description: 'List pin groups',
			responses: {
				200: { description: 'Pin groups' },
			},
		}),
		async (c) => {
			const root = c.get('companyRoot')
			const groupsPath = join(root, 'dashboard', 'groups.yaml')

			if (!(await fileExists(groupsPath))) {
				return c.json({ groups: [] })
			}

			const groups = await readYamlUnsafe(groupsPath)
			return c.json({ groups })
		},
	)

export { dashboard }
