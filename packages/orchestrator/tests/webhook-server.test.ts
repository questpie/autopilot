import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { join } from 'node:path'
import { WebhookServer } from '../src/webhook/server'
import { createTestCompany } from './helpers'
import { writeYaml } from '../src/fs/yaml'
import type { Webhook } from '@questpie/autopilot-spec'

describe('WebhookServer', () => {
	let companyRoot: string
	let cleanup: () => Promise<void>
	let port: number

	beforeEach(async () => {
		const tc = await createTestCompany()
		companyRoot = tc.root
		cleanup = tc.cleanup
		// Use random port to avoid conflicts
		port = 10000 + Math.floor(Math.random() * 50000)
	})

	afterEach(async () => {
		await cleanup()
	})

	async function setupWebhooks(webhooks: Array<Record<string, unknown>>) {
		await writeYaml(join(companyRoot, 'team', 'webhooks.yaml'), {
			webhooks,
		})
	}

	test('server starts and responds to health check', async () => {
		await setupWebhooks([])

		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async () => {},
		})

		await server.start()

		const res = await fetch(`http://localhost:${port}/health`)
		expect(res.status).toBe(404)

		server.stop()
	})

	test('returns 404 for unknown webhook path', async () => {
		await setupWebhooks([
			{
				id: 'github-push',
				path: '/webhooks/github',
				agent: 'dev',
				auth: 'none',
				action: { type: 'spawn_agent' },
				enabled: true,
			},
		])

		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async () => {},
		})

		await server.start()

		const res = await fetch(`http://localhost:${port}/webhooks/unknown`, {
			method: 'POST',
		})
		expect(res.status).toBe(404)

		server.stop()
	})

	test('matches webhook by path and returns 200', async () => {
		await setupWebhooks([
			{
				id: 'github-push',
				path: '/webhooks/github',
				agent: 'dev',
				auth: 'none',
				action: { type: 'spawn_agent' },
				enabled: true,
			},
		])

		const received: Array<{ webhook: Webhook; payload: unknown }> = []
		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async (webhook, payload) => {
				received.push({ webhook, payload })
			},
		})

		await server.start()

		const res = await fetch(`http://localhost:${port}/webhooks/github`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ref: 'refs/heads/main' }),
		})

		expect(res.status).toBe(200)
		expect(received).toHaveLength(1)
		expect(received[0].webhook.id).toBe('github-push')
		expect(received[0].payload).toEqual({ ref: 'refs/heads/main' })

		server.stop()
	})

	test('returns 401 for bearer token auth without header', async () => {
		await setupWebhooks([
			{
				id: 'secure-hook',
				path: '/webhooks/secure',
				agent: 'dev',
				auth: 'bearer_token',
				action: { type: 'spawn_agent' },
				enabled: true,
			},
		])

		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async () => {},
		})

		await server.start()

		const res = await fetch(`http://localhost:${port}/webhooks/secure`, {
			method: 'POST',
		})
		expect(res.status).toBe(401)

		server.stop()
	})

	test('disabled webhooks are not matched', async () => {
		await setupWebhooks([
			{
				id: 'disabled-hook',
				path: '/webhooks/disabled',
				agent: 'dev',
				auth: 'none',
				action: { type: 'spawn_agent' },
				enabled: false,
			},
		])

		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async () => {},
		})

		await server.start()

		const res = await fetch(`http://localhost:${port}/webhooks/disabled`, {
			method: 'POST',
		})
		expect(res.status).toBe(404)

		server.stop()
	})

	test('stop can be called multiple times safely', async () => {
		await setupWebhooks([])

		const server = new WebhookServer({
			port,
			companyRoot,
			onWebhook: async () => {},
		})

		await server.start()
		server.stop()
		server.stop() // Should not throw
	})
})
