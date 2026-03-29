/**
 * Security headers middleware tests.
 *
 * Verifies that the securityHeaders() middleware sets all required
 * HTTP security headers on responses — CSP, X-Frame-Options, etc.
 */
import { describe, test, expect } from 'bun:test'
import { Hono } from 'hono'
import { securityHeaders } from '../src/api/middleware/security-headers'

function createTestApp() {
	const app = new Hono()
	app.use('*', securityHeaders())
	app.get('/api/test', (c) => c.json({ ok: true }))
	app.get('/artifacts/proxy', (c) => c.json({ artifact: true }))
	return app
}

describe('securityHeaders middleware', () => {
	test('sets Content-Security-Policy header', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		const csp = res.headers.get('Content-Security-Policy')
		expect(csp).toBeTruthy()
		expect(csp).toContain("default-src 'self'")
	})

	test('CSP includes script-src', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		const csp = res.headers.get('Content-Security-Policy')!
		expect(csp).toContain("script-src 'self'")
	})

	test('CSP includes style-src', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		const csp = res.headers.get('Content-Security-Policy')!
		expect(csp).toContain("style-src 'self'")
	})

	test('CSP includes img-src with data: and blob:', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		const csp = res.headers.get('Content-Security-Policy')!
		expect(csp).toContain('img-src')
		expect(csp).toContain('data:')
		expect(csp).toContain('blob:')
	})

	test('CSP includes font-src for Google Fonts', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		const csp = res.headers.get('Content-Security-Policy')!
		expect(csp).toContain('fonts.googleapis.com')
		expect(csp).toContain('fonts.gstatic.com')
	})

	test('sets X-Content-Type-Options: nosniff', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
	})

	test('sets X-Frame-Options: DENY', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		expect(res.headers.get('X-Frame-Options')).toBe('DENY')
	})

	test('sets X-XSS-Protection: 0 (modern best practice)', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		expect(res.headers.get('X-XSS-Protection')).toBe('0')
	})

	test('sets Referrer-Policy', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
	})

	test('skips headers for /artifacts/* path', async () => {
		const app = createTestApp()
		const res = await app.request('/artifacts/proxy')
		// Artifact proxy should NOT have CSP (it carries its own headers)
		const csp = res.headers.get('Content-Security-Policy')
		expect(csp).toBeNull()
	})

	test('response body is unaffected', async () => {
		const app = createTestApp()
		const res = await app.request('/api/test')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body).toEqual({ ok: true })
	})

	test('applies to all non-artifact paths', async () => {
		const app = createTestApp()
		// Also test root path
		app.get('/', (c) => c.text('home'))
		const res = await app.request('/')
		expect(res.headers.get('X-Frame-Options')).toBe('DENY')
	})
})
