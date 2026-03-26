import { createMiddleware } from 'hono/factory'

const isDev = process.env.NODE_ENV !== 'production'

export function securityHeaders() {
	return createMiddleware(async (c, next) => {
		await next()

		const path = new URL(c.req.url).pathname
		const isArtifactProxy = path.startsWith('/artifacts/')

		// Artifact proxy responses are returned as raw Response objects
		// and carry their own headers — skip CSP/framing for them.
		if (isArtifactProxy) return

		c.header(
			'Content-Security-Policy',
			[
				"default-src 'self'",
				"script-src 'self' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data: blob:",
				isDev ? "connect-src 'self' http://localhost:*" : "connect-src 'self'",
				isDev ? "frame-src 'self' http://localhost:*" : "frame-src 'self'",
				"font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
			].join('; '),
		)
		c.header('X-Content-Type-Options', 'nosniff')
		c.header('X-Frame-Options', 'DENY')
		c.header('X-XSS-Protection', '0')
		c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
		if (!isDev) {
			c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
		}
	})
}
