import dns from 'node:dns/promises'
import { container } from '../../container'
import { indexerFactory } from '../../db/indexer'
import type { Indexer } from '../../db/indexer'

/** Best-effort resolve the indexer for real-time index updates. */
export async function getIndexer(): Promise<Indexer | null> {
	try {
		const { indexer } = await container.resolveAsync([indexerFactory])
		return indexer
	} catch {
		return null
	}
}

// ─── SSRF protection helpers ───────────────────────────────────────────────

export const PRIVATE_IP_RANGES = [
	// 127.0.0.0/8
	/^127\./,
	// 10.0.0.0/8
	/^10\./,
	// 172.16.0.0/12
	/^172\.(1[6-9]|2\d|3[01])\./,
	// 192.168.0.0/16
	/^192\.168\./,
	// 169.254.0.0/16 (link-local)
	/^169\.254\./,
	// IPv6 loopback
	/^::1$/,
	// IPv6 unique local (fd00::/8)
	/^fd[0-9a-f]{2}:/i,
]

export function isPrivateIp(ip: string): boolean {
	return PRIVATE_IP_RANGES.some((re) => re.test(ip))
}

export async function checkSsrf(url: string): Promise<string | null> {
	let parsed: URL
	try {
		parsed = new URL(url)
	} catch {
		return 'Invalid URL'
	}
	const hostname = parsed.hostname

	// Resolve hostname to IP
	let addresses: string[]
	try {
		const results = await dns.lookup(hostname, { all: true })
		addresses = results.map((r) => r.address)
	} catch {
		// DNS resolution failed — block to be safe
		return 'Could not resolve hostname'
	}

	for (const addr of addresses) {
		if (isPrivateIp(addr)) {
			return 'Blocked: requests to private/internal IPs are not allowed'
		}
	}
	return null
}
