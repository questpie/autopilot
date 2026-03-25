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

const DEFAULT_TRUSTED_PROXIES = ['127.0.0.1', '::1', '::ffff:127.0.0.1']

/**
 * Extract client IP from request headers.
 * X-Forwarded-For is only trusted when the connecting socket IP is in trustedProxies.
 * Otherwise falls back to socket IP (x-real-ip header) or '127.0.0.1'.
 *
 * @param c - Hono context with request headers
 * @param trustedProxies - List of IPs considered trusted proxies (default: loopback addresses)
 */
export function getClientIp(
	c: { req: { header: (name: string) => string | undefined } },
	trustedProxies: string[] = DEFAULT_TRUSTED_PROXIES,
): string {
	// Determine the socket/connecting IP from x-real-ip (set by the closest proxy/server)
	const socketIp = c.req.header('x-real-ip') ?? '127.0.0.1'

	// Only trust X-Forwarded-For when the connecting IP is a known trusted proxy
	if (trustedProxies.includes(socketIp)) {
		const xff = c.req.header('x-forwarded-for')
		if (xff) {
			const first = xff.split(',')[0]?.trim()
			if (first) return first
		}
	}

	return socketIp
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
		let trustedProxies: string[] | undefined
		try {
			const { readYamlUnsafe } = await import('../../fs/yaml')
			const { join } = await import('node:path')
			const company = await readYamlUnsafe(join(companyRoot, 'company.yaml')) as {
				settings?: { auth?: { ip_allowlist?: string[]; trusted_proxies?: string[] } }
			}
			allowlist = company?.settings?.auth?.ip_allowlist ?? []
			trustedProxies = company?.settings?.auth?.trusted_proxies
		} catch {
			// No company.yaml or no allowlist — allow all
		}

		if (allowlist.length === 0) return next()

		const path = new URL(c.req.url).pathname
		// Exempt: webhooks and healthcheck
		if (path.startsWith('/hooks/') || path === '/api/status') return next()

		const clientIp = getClientIp(c, trustedProxies)
		const cidrs = allowlist.map(parseCidr).filter((x): x is NonNullable<typeof x> => x !== null)

		if (!isIpAllowed(clientIp, cidrs)) {
			return c.json({ error: 'IP not allowed' }, 403)
		}
		return next()
	})
}
