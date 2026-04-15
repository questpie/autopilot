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

// TODO: this should be replaced with a proper MIME type lookup, but this is good enough for now
function guessMimeType(path: string): string {
	const lower = path.toLowerCase()
	if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8'
	if (lower.endsWith('.css')) return 'text/css; charset=utf-8'
	if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript; charset=utf-8'
	if (lower.endsWith('.json')) return 'application/json; charset=utf-8'
	if (lower.endsWith('.svg')) return 'image/svg+xml'
	if (lower.endsWith('.png')) return 'image/png'
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
	if (lower.endsWith('.woff2')) return 'font/woff2'
	if (lower.endsWith('.woff')) return 'font/woff'
	if (lower.endsWith('.gif')) return 'image/gif'
	if (lower.endsWith('.webp')) return 'image/webp'
	if (lower.endsWith('.ico')) return 'image/x-icon'
	if (lower.endsWith('.avif')) return 'image/avif'
	if (lower.endsWith('.ttf')) return 'font/ttf'
	if (lower.endsWith('.otf')) return 'font/otf'
	if (lower.endsWith('.eot')) return 'application/vnd.ms-fontobject'
	if (lower.endsWith('.wasm')) return 'application/wasm'
	return 'text/plain; charset=utf-8'
}

const previews = new Hono<AppEnv>().get('/:runId/*', async (c) => {
	const { artifactService } = c.get('services')
	const runId = c.req.param('runId')
	const routeWildcard = c.req.param('*')
	const pathPrefix = `/api/previews/${runId}/`
	const pathDerived =
		c.req.path.startsWith(pathPrefix) && c.req.path.length > pathPrefix.length
			? decodeURIComponent(c.req.path.slice(pathPrefix.length))
			: ''
	const filePath = routeWildcard || pathDerived || 'index.html'

	// Look up preview_file artifacts for this run
	const runArtifacts = await artifactService.listForRun(runId)
	const previewFiles = runArtifacts.filter(
		(a) => a.kind === 'preview_file' && (a.ref_kind === 'inline' || a.ref_kind === 'base64'),
	)

	const match = previewFiles.find((a) => a.title === filePath)

	if (match) {
		try {
			const content = await artifactService.resolveContent(match)
			const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8')
			return new Response(bytes, {
				headers: {
					'Content-Type': match.mime_type || guessMimeType(match.title),
					'Cache-Control': 'public, max-age=3600',
					'Content-Length': String(bytes.length),
				},
			})
		} catch (err) {
			console.error(`[previews] failed to resolve content for ${match.id}:`, err instanceof Error ? err.message : String(err))
			return c.text('Failed to resolve preview content', 500)
		}
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
