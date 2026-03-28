/**
 * API documentation routes — OpenAPI JSON + Scalar UI.
 *
 * Usage:
 *   mountDocs(app)   // call after all routes are registered
 */
import type { Hono } from 'hono'
import { openAPIRouteHandler } from 'hono-openapi'
import type { AppEnv } from './app'

/**
 * Mount documentation routes on the given Hono app.
 *
 * Must be called **after** all API routes have been registered so that
 * `openAPIRouteHandler` can introspect every `describeRoute()` decorator.
 */
export function mountDocs(app: Hono<AppEnv>) {
	app
		/**
		 * GET /openapi.json — generated OpenAPI 3.1 specification.
		 *
		 * `openAPIRouteHandler` walks the router tree, collects every
		 * `describeRoute()` decorator, and builds the full spec dynamically.
		 */
		.get(
			'/openapi.json',
			openAPIRouteHandler(app, {
				documentation: {
					info: {
						title: 'QUESTPIE Autopilot API',
						version: '0.1.0',
						description:
							'Orchestrator REST API for the QUESTPIE Autopilot platform.',
					},
					servers: [{ url: '/' }],
				},
			}),
		)
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
}
