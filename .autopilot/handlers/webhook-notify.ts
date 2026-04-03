/**
 * Generic webhook notification handler.
 *
 * Reads a JSON envelope from stdin, POSTs a notification payload
 * to the configured webhook URL, and returns the result on stdout.
 *
 * Required config:
 *   (none — URL comes from secrets)
 *
 * Required secrets:
 *   webhook_url — the URL to POST to
 *
 * Optional config:
 *   method — HTTP method (default POST)
 */

const input = await Bun.stdin.text()
const envelope = JSON.parse(input)

const url = envelope.secrets.webhook_url
if (!url) {
	console.log(JSON.stringify({ ok: false, error: 'Missing secret: webhook_url' }))
	process.exit(0)
}

const method = envelope.config.method ?? 'POST'

try {
	const response = await fetch(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(envelope.payload),
	})

	const ok = response.ok
	const body = await response.text()

	console.log(JSON.stringify({
		ok,
		external_id: response.headers.get('x-request-id') ?? undefined,
		metadata: { status: response.status, body: body.slice(0, 500) },
		error: ok ? undefined : `HTTP ${response.status}: ${body.slice(0, 200)}`,
	}))
} catch (err) {
	console.log(JSON.stringify({
		ok: false,
		error: err instanceof Error ? err.message : String(err),
	}))
}
