import { timingSafeEqual } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Webhook } from '@questpie/autopilot-spec'
import { PATHS, WebhookSchema } from '@questpie/autopilot-spec'
/**
 * Hono route that handles incoming webhook requests.
 *
 * Replaces the standalone WebhookServer — webhooks are now served on the
 * same port as the rest of the API under `/webhooks/:path`.
 *
 * This route MUST be mounted BEFORE the auth middleware because external
 * services do not carry Bearer tokens.
 */
import { Hono } from 'hono'
import { container } from '../../container'
import { readYaml } from '../../fs/yaml'
import { logger } from '../../logger'
import { notifierFactory } from '../../notifier'
import { readSecretRecord } from '../../secrets/store'
import { webhookHandlerRegistry } from '../../webhook'
import type { AppEnv } from '../app'

/**
 * Timing-safe string comparison to prevent timing attacks on secrets.
 * Returns false immediately if lengths differ (length is not secret information).
 */
function safeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) return false
	return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

async function loadWebhooks(companyRoot: string): Promise<Webhook[]> {
	const dir = join(companyRoot, PATHS.WEBHOOKS_DIR.slice(1))
	const webhooks: Webhook[] = []
	if (existsSync(dir)) {
		const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
		for (const file of files) {
			try {
				const webhook = await readYaml(join(dir, file), WebhookSchema)
				webhooks.push(webhook)
			} catch {
				// skip invalid
			}
		}
	}
	return webhooks.filter((w) => w.enabled)
}

function matchWebhook(webhooks: Webhook[], path: string): Webhook | undefined {
	return webhooks.find((w) => {
		return path === w.path || path === `/${w.path}` || path === w.path.replace(/^\//, '')
	})
}

async function verifyAuth(
	request: Request,
	webhook: Webhook,
	companyRoot: string,
): Promise<boolean> {
	if (webhook.auth === 'none') return true

	if (webhook.auth === 'bearer_token') {
		const authHeader = request.headers.get('authorization')
		if (!authHeader?.startsWith('Bearer ')) return false

		if (!webhook.secret_ref) {
			logger.warn(
				'webhook',
				`bearer_token auth for "${webhook.id}" has no secret_ref — rejecting (configure secret_ref to enable)`,
			)
			return false
		}

		try {
			const secret = await readSecretRecord(companyRoot, webhook.secret_ref)
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

		if (!webhook.secret_ref) {
			logger.warn(
				'webhook',
				`hmac_sha256 auth for "${webhook.id}" has no secret_ref — rejecting (configure secret_ref to enable)`,
			)
			return false
		}

		try {
			const secret = await readSecretRecord(companyRoot, webhook.secret_ref)
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

export const webhooks = new Hono<AppEnv>()

webhooks.post('/*', async (c) => {
	const companyRoot = c.get('companyRoot')
	const url = new URL(c.req.url)
	// Strip the /webhooks prefix to get the webhook path
	const webhookPath = url.pathname.replace(/^\/webhooks/, '')

	let allWebhooks: Webhook[]
	try {
		allWebhooks = await loadWebhooks(companyRoot)
	} catch (err) {
		logger.error('webhook', 'failed to load webhook config files', {
			error: err instanceof Error ? err.message : String(err),
		})
		return c.json({ error: 'webhook configuration unavailable' }, 500)
	}

	const webhook = matchWebhook(allWebhooks, webhookPath)
	if (!webhook) {
		return c.json({ error: 'not found' }, 404)
	}

	const authValid = await verifyAuth(c.req.raw, webhook, companyRoot)
	if (!authValid) {
		return c.json({ error: 'unauthorized' }, 401)
	}

	let payload: unknown = null
	try {
		const text = await c.req.text()
		if (text) {
			payload = JSON.parse(text)
		}
	} catch {
		payload = null
	}

	try {
		// Dispatch to handler registry (same as Orchestrator.handleWebhook)
		if (webhookHandlerRegistry.has(webhook.id)) {
			const result = await webhookHandlerRegistry.dispatch(webhook.id, payload, {
				companyRoot,
			})
			if (result.handled) {
				const { notifier } = await container.resolveAsync([notifierFactory])
				await notifier.notify({
					type: 'alert',
					title: `Webhook handled: ${webhook.id}`,
					message: `Webhook ${webhook.id} routed to agent ${result.agentId ?? 'unknown'}`,
					priority: 'normal',
					agentId: result.agentId,
				})
			}
		} else {
			// No specific handler — send generic notification
			const { notifier } = await container.resolveAsync([notifierFactory])
			await notifier.notify({
				type: 'alert',
				title: `Webhook received: ${webhook.id}`,
				message: `Webhook ${webhook.id} triggered for agent ${webhook.agent}`,
				priority: webhook.action.priority === 'urgent' ? 'urgent' : 'normal',
				agentId: webhook.agent,
			})
		}
	} catch (err) {
		logger.error('webhook', `error handling ${webhook.id}`, {
			error: err instanceof Error ? err.message : String(err),
		})
		return c.json({ error: 'internal error' }, 500)
	}

	return c.json({ ok: true }, 200)
})
