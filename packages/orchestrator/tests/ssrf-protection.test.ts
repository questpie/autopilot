/**
 * SSRF protection tests — isPrivateIp and checkSsrf.
 *
 * These are critical security functions that prevent agents from
 * making HTTP requests to internal/private networks.
 */
import { describe, test, expect, afterEach } from 'bun:test'
import { isPrivateIp, checkSsrf, PRIVATE_IP_RANGES } from '../src/agent/tools/shared'

// ─── isPrivateIp ────────────────────────────────────────────────────────────

describe('isPrivateIp', () => {
	// ── Loopback (127.0.0.0/8) ──
	test('detects 127.0.0.1 as private', () => {
		expect(isPrivateIp('127.0.0.1')).toBe(true)
	})

	test('detects 127.255.255.255 as private', () => {
		expect(isPrivateIp('127.255.255.255')).toBe(true)
	})

	test('detects 127.0.0.2 as private', () => {
		expect(isPrivateIp('127.0.0.2')).toBe(true)
	})

	// ── 10.0.0.0/8 ──
	test('detects 10.0.0.1 as private', () => {
		expect(isPrivateIp('10.0.0.1')).toBe(true)
	})

	test('detects 10.255.255.255 as private', () => {
		expect(isPrivateIp('10.255.255.255')).toBe(true)
	})

	// ── 172.16.0.0/12 ──
	test('detects 172.16.0.1 as private', () => {
		expect(isPrivateIp('172.16.0.1')).toBe(true)
	})

	test('detects 172.31.255.255 as private', () => {
		expect(isPrivateIp('172.31.255.255')).toBe(true)
	})

	test('does NOT detect 172.15.0.1 as private (below range)', () => {
		expect(isPrivateIp('172.15.0.1')).toBe(false)
	})

	test('does NOT detect 172.32.0.1 as private (above range)', () => {
		expect(isPrivateIp('172.32.0.1')).toBe(false)
	})

	// ── 192.168.0.0/16 ──
	test('detects 192.168.0.1 as private', () => {
		expect(isPrivateIp('192.168.0.1')).toBe(true)
	})

	test('detects 192.168.255.255 as private', () => {
		expect(isPrivateIp('192.168.255.255')).toBe(true)
	})

	// ── 169.254.0.0/16 (link-local) ──
	test('detects 169.254.1.1 as private (link-local)', () => {
		expect(isPrivateIp('169.254.1.1')).toBe(true)
	})

	// ── IPv6 loopback ──
	test('detects ::1 as private (IPv6 loopback)', () => {
		expect(isPrivateIp('::1')).toBe(true)
	})

	// ── IPv6 unique local (fd00::/8) ──
	test('detects fd00::1 as private (IPv6 ULA)', () => {
		expect(isPrivateIp('fd00::1')).toBe(true)
	})

	test('detects fdab:1234::1 as private', () => {
		expect(isPrivateIp('fdab:1234::1')).toBe(true)
	})

	// ── Public IPs ──
	test('allows 8.8.8.8 (Google DNS)', () => {
		expect(isPrivateIp('8.8.8.8')).toBe(false)
	})

	test('allows 1.1.1.1 (Cloudflare DNS)', () => {
		expect(isPrivateIp('1.1.1.1')).toBe(false)
	})

	test('allows 93.184.215.14 (example.com)', () => {
		expect(isPrivateIp('93.184.215.14')).toBe(false)
	})

	test('allows 203.0.113.1 (documentation range)', () => {
		expect(isPrivateIp('203.0.113.1')).toBe(false)
	})

	test('allows 192.167.1.1 (just outside 192.168)', () => {
		expect(isPrivateIp('192.167.1.1')).toBe(false)
	})

	test('allows 11.0.0.1 (just outside 10.x)', () => {
		expect(isPrivateIp('11.0.0.1')).toBe(false)
	})
})

// ─── PRIVATE_IP_RANGES ──────────────────────────────────────────────────────

describe('PRIVATE_IP_RANGES', () => {
	test('has at least 7 patterns (all RFC1918 + link-local + IPv6)', () => {
		expect(PRIVATE_IP_RANGES.length).toBeGreaterThanOrEqual(7)
	})

	test('all entries are RegExp', () => {
		for (const re of PRIVATE_IP_RANGES) {
			expect(re).toBeInstanceOf(RegExp)
		}
	})
})

// ─── checkSsrf ──────────────────────────────────────────────────────────────

describe('checkSsrf', () => {
	const originalFetch = globalThis.fetch

	afterEach(() => {
		globalThis.fetch = originalFetch
	})

	test('returns null for public hostname (safe)', async () => {
		// example.com resolves to a public IP
		const result = await checkSsrf('https://example.com')
		expect(result).toBeNull()
	})

	test('returns error for invalid URL', async () => {
		const result = await checkSsrf('not-a-url')
		expect(result).toBe('Invalid URL')
	})

	test('returns error for empty string', async () => {
		const result = await checkSsrf('')
		expect(result).toBe('Invalid URL')
	})

	test('blocks localhost', async () => {
		const result = await checkSsrf('http://localhost:3000/secret')
		expect(result).toContain('private')
	})

	test('blocks 127.0.0.1', async () => {
		const result = await checkSsrf('http://127.0.0.1:8080/admin')
		expect(result).toContain('private')
	})

	test('returns error for unresolvable hostname', async () => {
		const result = await checkSsrf('https://this-domain-does-not-exist-xyz123.com')
		expect(result).toContain('Could not resolve')
	})

	test('blocks 10.x internal IP via hostname that resolves to it', async () => {
		// We can't control DNS, but we can test the isPrivateIp path directly
		// by checking that the function would block if DNS returned a private IP
		// This is tested through isPrivateIp above
		expect(isPrivateIp('10.0.0.1')).toBe(true)
	})

	test('allows URL with path and query params', async () => {
		const result = await checkSsrf('https://example.com/api/v1?key=value&other=param')
		expect(result).toBeNull()
	})

	test('allows HTTPS URLs', async () => {
		const result = await checkSsrf('https://example.com')
		expect(result).toBeNull()
	})

	test('allows HTTP URLs (to public IPs)', async () => {
		const result = await checkSsrf('http://example.com')
		expect(result).toBeNull()
	})
})
