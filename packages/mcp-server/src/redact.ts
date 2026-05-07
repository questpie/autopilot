/**
 * Redaction helper for MCP tool telemetry.
 *
 * Replaces obvious secrets in argument payloads before they reach run events
 * or activity rows. The intent is defensive — telemetry should never carry
 * Bearer tokens, API keys, or large opaque blobs even when an operator
 * accidentally passes one through a tool argument.
 *
 * Rules (intentionally conservative):
 * - Top-level (and one nested level) keys whose name looks secret-shaped get
 *   their value replaced with '<redacted>'.
 * - Long strings (>500 chars) are truncated.
 * - Strings that look like base64 blobs (>=500 chars of base64 alphabet) are
 *   replaced with a size marker.
 * - Plain values pass through unchanged.
 * - Never throws — telemetry must never break a tool call.
 */

const SECRET_KEY_RE = /secret|password|token|key|credential|api[-_]?key|authorization|bearer/i
const BASE64_RE = /^[A-Za-z0-9+/]{500,}={0,2}$/
const MAX_STRING_LEN = 500

function redactString(value: string): string {
	if (BASE64_RE.test(value)) {
		return `<base64 redacted ${value.length} bytes>`
	}
	if (value.length > MAX_STRING_LEN) {
		const head = value.slice(0, MAX_STRING_LEN)
		const dropped = value.length - MAX_STRING_LEN
		return `${head}…(truncated ${dropped} bytes)`
	}
	return value
}

/**
 * Walk a value, applying key-name redaction at each object/array level until
 * the depth budget is exhausted. depth = 0 means "we're at the call site"
 * (top-level), depth = 1 means "one level nested". Anything deeper is left
 * intact to keep telemetry small and avoid runaway traversal.
 */
function redactValue(value: unknown, depth: number): unknown {
	if (value === null || value === undefined) return value
	if (typeof value === 'string') return redactString(value)
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return value
	}
	if (Array.isArray(value)) {
		if (depth > 1) return value
		return value.map((item) => redactValue(item, depth + 1))
	}
	if (typeof value === 'object') {
		if (depth > 1) return value
		const obj = value as Record<string, unknown>
		const out: Record<string, unknown> = {}
		for (const [key, raw] of Object.entries(obj)) {
			if (SECRET_KEY_RE.test(key)) {
				out[key] = '<redacted>'
			} else {
				out[key] = redactValue(raw, depth + 1)
			}
		}
		return out
	}
	return value
}

export function redactArgs(args: unknown): unknown {
	try {
		return redactValue(args, 0)
	} catch (err) {
		console.warn(
			'[mcp-telemetry] redactArgs failed',
			err instanceof Error ? err.message : String(err),
		)
		return '<redaction-failed>'
	}
}
