/**
 * IP allowlist middleware — restricts API access to configured CIDR ranges.
 * Empty allowlist = allow all. Exempt: /hooks/* and /api/status.
 */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'

/**
 * Parse a CIDR notation string into network and mask.
 * Supports "192.168.1.0/24" and single IPs "1.2.3.4" (auto /32).
 * IPv4 only. Returns null for invalid input.
 */
export function parseCidr(cidr: string): { network: number; mask: number } | null {
	const parts = cidr.split('/')
	const ipStr = parts[0]
	if (!ipStr) return null

	const prefix = parts.length === 2 ? parseInt(parts[1]!, 10) : 32
	if (isNaN(prefix) || prefix < 0 || prefix > 32) return null

	const octets = ipStr.split('.')
	if (octets.length !== 4) return null

	let ip = 0
	for (const octet of octets) {
		const n = parseInt(octet, 10)
		if (isNaN(n) || n < 0 || n > 255) return null
		ip = (ip << 8) | n
	}

	// Convert to unsigned 32-bit
	ip = ip >>> 0

	const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0
	const network = (ip & mask) >>> 0

	return { network, mask }
}

/**
 * Check if an IP address falls within any of the given CIDR ranges.
 */
export function isIpAllowed(
	ip: string,
	cidrs: Array<{ network: number; mask: number }>,
): boolean {
	const octets = ip.split('.')
	if (octets.length !== 4) return false

	let ipNum = 0
	for (const octet of octets) {
		const n = parseInt(octet, 10)
		if (isNaN(n) || n < 0 || n > 255) return false
		ipNum = (ipNum << 8) | n
	}
	ipNum = ipNum >>> 0

	for (const cidr of cidrs) {
		if ((ipNum & cidr.mask) >>> 0 === cidr.network) {
			return true
		}
	}

	return false
}

/**
 * Extract client IP from request headers.
 * Priority: X-Forwarded-For (first entry) -> x-real-ip -> fallback '127.0.0.1'
 */
export function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
	const xff = c.req.header('x-forwarded-for')
	if (xff) {
		const first = xff.split(',')[0]?.trim()
		if (first) return first
	}
	const realIp = c.req.header('x-real-ip')
	if (realIp) return realIp
	return '127.0.0.1'
}

/**
 * Hono middleware that blocks requests from IPs not in the allowlist.
 * Empty allowlist = allow all traffic.
 * Exempt paths: /hooks/* (webhooks) and /api/status (healthcheck).
 */
export function ipAllowlist() {
	return createMiddleware<AppEnv>(async (c, next) => {
		const companyRoot = c.get('companyRoot')
		let allowlist: string[] = []
		try {
			const { readYamlUnsafe } = await import('../../fs/yaml')
			const { join } = await import('node:path')
			const company = await readYamlUnsafe(join(companyRoot, 'company.yaml')) as { settings?: { auth?: { ip_allowlist?: string[] } } }
			allowlist = company?.settings?.auth?.ip_allowlist ?? []
		} catch {
			// No company.yaml or no allowlist — allow all
		}

		if (allowlist.length === 0) return next()

		const path = new URL(c.req.url).pathname
		// Exempt: webhooks and healthcheck
		if (path.startsWith('/hooks/') || path === '/api/status') return next()

		const clientIp = getClientIp(c)
		const cidrs = allowlist.map(parseCidr).filter((x): x is NonNullable<typeof x> => x !== null)

		if (!isIpAllowed(clientIp, cidrs)) {
			return c.json({ error: 'IP not allowed' }, 403)
		}
		return next()
	})
}
