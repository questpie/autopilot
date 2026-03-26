import { createMiddleware } from 'hono/factory'

export function securityHeaders() {
	return createMiddleware(async (c, next) => {
		await next()
		c.header(
			'Content-Security-Policy',
			[
				"default-src 'self'",
				"script-src 'self' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data: blob:",
				"connect-src 'self' http://localhost:*",
				"frame-src 'self' http://localhost:*",
				"font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
			].join('; '),
		)
		c.header('X-Content-Type-Options', 'nosniff')
		c.header('X-Frame-Options', 'DENY')
		c.header('X-XSS-Protection', '0')
		c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
		if (process.env.NODE_ENV === 'production') {
			c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
		}
	})
}
