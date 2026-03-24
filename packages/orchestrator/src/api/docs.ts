/**
 * API documentation routes — OpenAPI JSON + Scalar UI.
 *
 * Mount on the root app:
 *   app.route('/', docs)
 */
import { Hono } from 'hono'
import type { AppEnv } from './app'

const docs = new Hono<AppEnv>()
	/**
	 * GET /openapi.json — serves the generated OpenAPI 3.1 specification.
	 *
	 * The actual spec object will be wired up once route definitions are
	 * registered (via @hono/zod-openapi or manual spec building). For now
	 * this returns a minimal skeleton so the Scalar UI has something to load.
	 */
	.get('/openapi.json', (c) => {
		return c.json({
			openapi: '3.1.0',
			info: {
				title: 'QUESTPIE Autopilot API',
				version: '0.1.0',
				description:
					'Orchestrator REST API for the QUESTPIE Autopilot platform.',
			},
			servers: [{ url: '/' }],
			paths: {},
		})
	})
	/**
	 * GET /docs — interactive API reference powered by Scalar.
	 *
	 * Uses the 'purple' theme to match QUESTPIE branding. Loads both the
	 * main API spec and the Better Auth auto-generated schema.
	 */
	.get('/docs', (c) => {
		const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QUESTPIE Autopilot API</title>
</head>
<body>
  <script
    id="api-reference"
    data-configuration='${JSON.stringify({
			theme: 'purple',
			pageTitle: 'QUESTPIE Autopilot API',
			sources: [
				{ url: '/openapi.json', title: 'API' },
				{ url: '/api/auth/open-api/generate-schema', title: 'Auth' },
			],
		})}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`
		return c.html(html)
	})

export { docs }
