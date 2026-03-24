import { join } from 'node:path'
import type { Webhook } from '@questpie/autopilot-spec'
import { WebhooksFileSchema } from '@questpie/autopilot-spec'
import { readYaml } from '../fs/yaml'

/** Configuration for the incoming-webhook HTTP server. */
export interface WebhookServerOptions {
	port: number
	companyRoot: string
	onWebhook: (webhook: Webhook, payload: unknown) => Promise<void>
}

/**
 * HTTP server that receives external webhook payloads.
 *
 * Matches incoming requests to webhook definitions from `webhooks.yaml`,
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
		const webhooksPath = join(this.options.companyRoot, 'team', 'webhooks.yaml')
		const file = await readYaml(webhooksPath, WebhooksFileSchema)
		this.webhooks = file.webhooks.filter((w) => w.enabled)
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
			console.error(`[webhook] error handling ${webhook.id}:`, err)
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

			// In production, verify against secret_ref
			// For MVP, accept any bearer token if secret_ref is not set
			if (!webhook.secret_ref) return true

			const secretPath = join(this.options.companyRoot, 'secrets', `${webhook.secret_ref}.yaml`)
			try {
				const secretFile = await Bun.file(secretPath).text()
				const { parse } = await import('yaml')
				const secret = parse(secretFile)
				const token = authHeader.slice(7)
				return token === secret.value
			} catch {
				return false
			}
		}

		if (webhook.auth === 'hmac_sha256') {
			const signature = webhook.signature_header
				? request.headers.get(webhook.signature_header)
				: request.headers.get('x-signature-256') ?? request.headers.get('x-hub-signature-256')
			if (!signature) return false

			if (!webhook.secret_ref) return true

			const secretPath = join(this.options.companyRoot, 'secrets', `${webhook.secret_ref}.yaml`)
			try {
				const secretFile = await Bun.file(secretPath).text()
				const { parse } = await import('yaml')
				const secret = parse(secretFile)
				const body = await request.clone().text()
				const hmac = new Bun.CryptoHasher('sha256', secret.value)
				hmac.update(body)
				const expected = `sha256=${hmac.digest('hex')}`
				return signature === expected
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
