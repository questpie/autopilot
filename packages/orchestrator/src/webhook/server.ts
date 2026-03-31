import { timingSafeEqual } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Webhook } from '@questpie/autopilot-spec'
import { PATHS, WebhookSchema } from '@questpie/autopilot-spec'
import { readYaml } from '../fs/yaml'
import { logger } from '../logger'
import { readSecretRecord } from '../secrets/store'

/**
 * Timing-safe string comparison to prevent timing attacks on secrets.
 * Returns false immediately if lengths differ (length is not secret information).
 */
function safeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Configuration for the incoming-webhook HTTP server. */
export interface WebhookServerOptions {
	port: number
	companyRoot: string
	onWebhook: (webhook: Webhook, payload: unknown) => Promise<void>
}

/**
 * HTTP server that receives external webhook payloads.
 *
 * Matches incoming requests to webhook definitions from `team/webhooks/*.yaml`,
 * verifies authentication (none / bearer_token / hmac_sha256), and
 * forwards the payload to the `onWebhook` callback.
 */
export class WebhookServer {
	private server: ReturnType<typeof Bun.serve> | null = null
	private webhooks: Webhook[] = []

	constructor(private options: WebhookServerOptions) {}

	/** Load webhooks from disk and start the Bun HTTP server. */
	async start(): Promise<void> {
		await this.loadWebhooks()

		this.server = Bun.serve({
			port: this.options.port,
			fetch: (request) => this.handleRequest(request),
		})
	}

	/** Stop the HTTP server. */
	stop(): void {
		if (this.server) {
			this.server.stop()
			this.server = null
		}
	}

	private async loadWebhooks(): Promise<void> {
		const dir = join(this.options.companyRoot, PATHS.WEBHOOKS_DIR.slice(1))
		if (!existsSync(dir)) {
			this.webhooks = []
			return
		}
		const webhooks: Webhook[] = []
		const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		for (const file of files) {
			try {
				const webhook = await readYaml(join(dir, file), WebhookSchema)
				webhooks.push(webhook)
			} catch {
				// skip invalid
			}
		}
		this.webhooks = webhooks.filter((w) => w.enabled)
	}

	private async handleRequest(request: Request): Promise<Response> {
		const url = new URL(request.url)
		const webhook = this.matchWebhook(url.pathname)

		if (!webhook) {
			return new Response(JSON.stringify({ error: 'not found' }), {
				status: 404,
				headers: { 'content-type': 'application/json' },
			})
		}

		const authValid = await this.verifyAuth(request, webhook)
		if (!authValid) {
			return new Response(JSON.stringify({ error: 'unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' },
			})
		}

		let payload: unknown = null
		try {
			const text = await request.text()
			if (text) {
				payload = JSON.parse(text)
			}
		} catch {
			payload = null
		}

		try {
			await this.options.onWebhook(webhook, payload)
		} catch (err) {
			logger.error('webhook', `error handling ${webhook.id}`, {
				error: err instanceof Error ? err.message : String(err),
			})
			return new Response(JSON.stringify({ error: 'internal error' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			})
		}

		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})
	}

	private async verifyAuth(request: Request, webhook: Webhook): Promise<boolean> {
		if (webhook.auth === 'none') return true

		if (webhook.auth === 'bearer_token') {
			const authHeader = request.headers.get('authorization')
			if (!authHeader?.startsWith('Bearer ')) return false

			// Fail-secure: reject if no secret_ref configured
			if (!webhook.secret_ref) {
				logger.warn(
					'webhook',
					`bearer_token auth for "${webhook.id}" has no secret_ref — rejecting (configure secret_ref to enable)`,
				)
				return false
			}

			try {
				const secret = await readSecretRecord(this.options.companyRoot, webhook.secret_ref)
				if (!secret) return false
				const token = authHeader.slice(7)
				return safeCompare(token, secret.value)
			} catch {
				return false
			}
		}

		if (webhook.auth === 'hmac_sha256') {
			const signature = webhook.signature_header
				? request.headers.get(webhook.signature_header)
				: (request.headers.get('x-signature-256') ?? request.headers.get('x-hub-signature-256'))
			if (!signature) return false

			// Fail-secure: reject if no secret_ref configured
			if (!webhook.secret_ref) {
				logger.warn(
					'webhook',
					`hmac_sha256 auth for "${webhook.id}" has no secret_ref — rejecting (configure secret_ref to enable)`,
				)
				return false
			}

			try {
				const secret = await readSecretRecord(this.options.companyRoot, webhook.secret_ref)
				if (!secret) return false
				const body = await request.clone().text()
				const hmac = new Bun.CryptoHasher('sha256', secret.value)
				hmac.update(body)
				const expected = `sha256=${hmac.digest('hex')}`
				return safeCompare(signature, expected)
			} catch {
				return false
			}
		}

		return false
	}

	private matchWebhook(path: string): Webhook | undefined {
		return this.webhooks.find((w) => {
			// Exact match or prefix match with trailing slash
			return path === w.path || path === `/${w.path}` || path === w.path.replace(/^\//, '')
		})
	}
}
