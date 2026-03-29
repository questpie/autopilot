/**
 * HTTP reverse proxy for artifact dev-servers.
 *
 * Routes `/artifacts/:id/*` to the internal dev-server port, cold-starting
 * the artifact on first request. This allows the dashboard to embed
 * artifacts via a single exposed port instead of per-artifact ports.
 */
import { Hono } from 'hono'
import { getRouter } from '../../artifact'
import type { AppEnv } from '../app'

/** Headers that should NOT be forwarded to the upstream dev-server. */
const HOP_BY_HOP = new Set([
	'connection',
	'keep-alive',
	'transfer-encoding',
	'te',
	'trailer',
	'upgrade',
	'host',
])

function filterRequestHeaders(headers: Headers): Headers {
	const filtered = new Headers()
	for (const [key, value] of headers.entries()) {
		if (!HOP_BY_HOP.has(key.toLowerCase())) {
			filtered.set(key, value)
		}
	}
	return filtered
}

function buildResponseHeaders(upstream: Headers, artifactId: string): Headers {
	const headers = new Headers()
	for (const [key, value] of upstream.entries()) {
		if (HOP_BY_HOP.has(key.toLowerCase())) continue
		// Rewrite Location headers from localhost:port to /artifacts/:id/
		if (key.toLowerCase() === 'location') {
			const rewritten = value.replace(/http:\/\/localhost:\d+\/?/, `/artifacts/${artifactId}/`)
			headers.set(key, rewritten)
		} else {
			headers.set(key, value)
		}
	}
	// Allow embedding in iframes from same origin
	headers.set('X-Frame-Options', 'SAMEORIGIN')
	return headers
}

async function proxyHandler(c: import('hono').Context<AppEnv>) {
	const id = c.req.param('id') ?? ''
	const root = c.get('companyRoot')
	const router = getRouter(root)

	let result: { port: number; url: string }
	try {
		result = await router.route(id)
	} catch {
		return c.json({ error: `Artifact "${id}" not found or failed to start` }, 502)
	}

	// Build upstream URL — strip the /artifacts/:id prefix
	const url = new URL(c.req.url)
	const prefix = `/artifacts/${id}`
	const remainingPath = url.pathname.slice(prefix.length) || '/'
	const upstream = `http://localhost:${result.port}${remainingPath}${url.search}`

	try {
		const upstreamRes = await fetch(upstream, {
			method: c.req.method,
			headers: filterRequestHeaders(c.req.raw.headers),
			body: c.req.raw.body,
			redirect: 'manual',
		})

		return new Response(upstreamRes.body, {
			status: upstreamRes.status,
			headers: buildResponseHeaders(upstreamRes.headers, id),
		})
	} catch {
		return c.json({ error: `Failed to reach artifact "${id}" upstream` }, 502)
	}
}

const artifactProxy = new Hono<AppEnv>().all('/:id/*', proxyHandler).all('/:id', proxyHandler)

export { artifactProxy }
