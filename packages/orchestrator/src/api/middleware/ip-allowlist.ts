/**
 * IP allowlist middleware — restricts API access to configured CIDR ranges.
 * Empty allowlist = allow all. Exempt: /hooks/* and /api/status.
 */
import { isIPv6 } from 'node:net'
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../app'

// ---------------------------------------------------------------------------
// IPv6 helpers
// ---------------------------------------------------------------------------

/**
 * Expand a compressed IPv6 address string into a full 16-byte Uint8Array.
 * Returns null if the string is not a valid IPv6 address.
 */
function expandIPv6(ip: string): Uint8Array | null {
	if (!isIPv6(ip)) return null

	// Strip brackets if present (e.g. "[::1]")
	ip = ip.replace(/^\[|\]$/g, '')

	// Handle IPv4-mapped addresses like ::ffff:192.168.1.1
	const ipv4MappedMatch = ip.match(/^(.+):(\d+\.\d+\.\d+\.\d+)$/)
	if (ipv4MappedMatch) {
		const v6prefix = ipv4MappedMatch[1]!
		const v4part = ipv4MappedMatch[2]!
		const v4octets = v4part.split('.').map((o) => parseInt(o, 10))
		if (v4octets.some((n) => isNaN(n) || n < 0 || n > 255)) return null
		// Reconstruct as pure hex groups
		const hi = ((v4octets[0]! << 8) | v4octets[1]!).toString(16).padStart(4, '0')
		const lo = ((v4octets[2]! << 8) | v4octets[3]!).toString(16).padStart(4, '0')
		ip = `${v6prefix}:${hi}:${lo}`
	}

	// Expand "::" double-colon shorthand
	const halves = ip.split('::')
	let groups: string[]
	if (halves.length === 2) {
		const left = halves[0] ? halves[0].split(':') : []
		const right = halves[1] ? halves[1].split(':') : []
		const missing = 8 - left.length - right.length
		groups = [...left, ...Array(missing).fill('0'), ...right]
	} else {
		groups = ip.split(':')
	}

	if (groups.length !== 8) return null

	const bytes = new Uint8Array(16)
	for (let i = 0; i < 8; i++) {
		const val = parseInt(groups[i]!, 16)
		if (isNaN(val) || val < 0 || val > 0xffff) return null
		bytes[i * 2] = (val >> 8) & 0xff
		bytes[i * 2 + 1] = val & 0xff
	}
	return bytes
}

/**
 * Parse an IPv6 CIDR string (e.g. "fd00::/8", "::1/128", "::1") into a
 * network byte array and prefix length. Auto-applies /128 for single IPs.
 * Returns null for invalid input.
 */
export function parseCidrV6(cidr: string): { network: Uint8Array; prefix: number } | null {
	const parts = cidr.split('/')
	const ipStr = parts[0]
	if (!ipStr) return null

	const prefix = parts.length === 2 ? parseInt(parts[1]!, 10) : 128
	if (isNaN(prefix) || prefix < 0 || prefix > 128) return null

	const network = expandIPv6(ipStr)
	if (!network) return null

	// Mask off host bits so network represents the true network address
	for (let i = 0; i < 16; i++) {
		const bits = Math.max(0, Math.min(8, prefix - i * 8))
		const maskByte = bits === 0 ? 0 : (~0 << (8 - bits)) & 0xff
		network[i] = network[i]! & maskByte
	}

	return { network, prefix }
}

/**
 * Check if an IPv6 address falls within a parsed IPv6 CIDR range.
 */
function isIPv6InCidr(ip: string, cidr: { network: Uint8Array; prefix: number }): boolean {
	const addr = expandIPv6(ip)
	if (!addr) return false

	for (let i = 0; i < 16; i++) {
		const bits = Math.max(0, Math.min(8, cidr.prefix - i * 8))
		const maskByte = bits === 0 ? 0 : (~0 << (8 - bits)) & 0xff
		if ((addr[i]! & maskByte) !== cidr.network[i]) return false
	}
	return true
}

// ---------------------------------------------------------------------------
// IPv4 helpers (unchanged)
// ---------------------------------------------------------------------------

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
 * Check if an IP address (IPv4 or IPv6) falls within any of the given CIDR ranges.
 */
export function isIpAllowed(
	ip: string,
	cidrs: Array<{ network: number; mask: number }>,
	cidrsV6?: Array<{ network: Uint8Array; prefix: number }>,
): boolean {
	if (isIPv6(ip)) {
		if (!cidrsV6 || cidrsV6.length === 0) return false
		return cidrsV6.some((cidr) => isIPv6InCidr(ip, cidr))
	}

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
		const cidrs = allowlist
			.filter((e) => !isIPv6(e.split('/')[0]!))
			.map(parseCidr)
			.filter((x): x is NonNullable<typeof x> => x !== null)
		const cidrsV6 = allowlist
			.filter((e) => isIPv6(e.split('/')[0]!))
			.map(parseCidrV6)
			.filter((x): x is NonNullable<typeof x> => x !== null)

		if (!isIpAllowed(clientIp, cidrs, cidrsV6)) {
			return c.json({ error: 'IP not allowed' }, 403)
		}
		return next()
	})
}
