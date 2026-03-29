import { Hono } from 'hono'
import { resolve, join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { z } from 'zod'
import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'
import { OkResponseSchema } from '@questpie/autopilot-spec'
import type { AppEnv } from '../app'

const upload = new Hono<AppEnv>().post(
	'/',
	describeRoute({
		tags: ['files'],
		description: 'Upload a file via multipart form data',
		responses: {
			200: {
				description: 'File uploaded',
				content: { 'application/json': { schema: resolver(OkResponseSchema.extend({ path: z.string() })) } },
			},
			400: { description: 'No file provided' },
			403: { description: 'Forbidden — path traversal' },
		},
	}),
	async (c) => {
		const root = c.get('companyRoot')
		const formData = await c.req.formData()
		const file = formData.get('file') as File | null
		const targetDir = (formData.get('path') as string) ?? ''

		if (!file) return c.json({ error: 'no file provided' }, 400)

		const fullDir = resolve(root, targetDir)
		if (!fullDir.startsWith(resolve(root))) {
			return c.json({ error: 'forbidden' }, 403)
		}

		await mkdir(fullDir, { recursive: true })
		const fullPath = join(fullDir, file.name)
		// Stream to disk — avoids buffering entire file in RAM
		await Bun.write(fullPath, file.stream())
		return c.json({ ok: true as const, path: join(targetDir, file.name) }, 200)
	},
)

export { upload }
