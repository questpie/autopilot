/**
 * Durable preview serving route.
 *
 * Serves preview_file artifacts stored inline in the artifacts table.
 * Works independently of worker uptime — content is on the orchestrator.
 *
 * Route: GET /api/previews/:runId/*path
 *
 * Auth: uses the same auth as the parent app context (user auth or local dev bypass).
 */
import { Hono } from 'hono'
import type { AppEnv } from '../app'

const previews = new Hono<AppEnv>()
	.get('/:runId/*', async (c) => {
		const { artifactService } = c.get('services')
		const runId = c.req.param('runId')
		const filePath = c.req.param('*') || 'index.html'

		// Look up preview_file artifact by run_id + relative path (stored in title)
		const runArtifacts = await artifactService.listForRun(runId)
		const match = runArtifacts.find(
			(a) => a.kind === 'preview_file' && a.ref_kind === 'inline' && a.title === filePath,
		)

		if (!match) {
			return c.text('Not found', 404)
		}

		return new Response(match.ref_value, {
			headers: {
				'Content-Type': match.mime_type || 'text/plain',
				'Cache-Control': 'public, max-age=3600',
			},
		})
	})

export { previews }
