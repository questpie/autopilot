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

		// Look up preview_file artifacts for this run
		const runArtifacts = await artifactService.listForRun(runId)
		const previewFiles = runArtifacts.filter(
			(a) => a.kind === 'preview_file' && a.ref_kind === 'inline',
		)

		const match = previewFiles.find((a) => a.title === filePath)

		if (match) {
			return new Response(match.ref_value, {
				headers: {
					'Content-Type': match.mime_type || 'text/plain',
					'Cache-Control': 'public, max-age=3600',
				},
			})
		}

		// Synthetic index: if index.html was requested but doesn't exist,
		// and other preview files do exist, render a file listing
		if (filePath === 'index.html' && previewFiles.length > 0) {
			const fileLinks = previewFiles
				.map((a) => {
					const escaped = a.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
					return `<li><a href="/api/previews/${runId}/${encodeURIComponent(a.title)}">${escaped}</a></li>`
				})
				.join('\n')

			const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview — ${runId}</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; max-width: 600px; margin: 0 auto; }
  h1 { font-size: 1rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #999; margin-bottom: 1.5rem; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { border-bottom: 1px solid #333; }
  a { display: block; padding: 0.75rem 0; color: #b700ff; text-decoration: none; font-family: monospace; font-size: 0.875rem; }
  a:hover { color: #d44fff; }
</style>
</head>
<body>
<h1>Preview Files</h1>
<ul>
${fileLinks}
</ul>
</body>
</html>`

			return c.html(html)
		}

		return c.text('Not found', 404)
	})

export { previews }
