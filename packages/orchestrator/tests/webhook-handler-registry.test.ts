import { describe, test, expect, beforeEach } from 'bun:test'
import { WebhookHandlerRegistry } from '../src/webhook/handler'
import type { WebhookHandler, WebhookContext, WebhookResult } from '../src/webhook/handler'
import type { SessionStreamManager } from '../src/session'

function createMockHandler(id: string, handles: string[]): WebhookHandler {
	return {
		id,
		canHandle(webhookId: string, _payload: unknown): boolean {
			return handles.includes(webhookId)
		},
		async handle(_payload: unknown, _ctx: WebhookContext): Promise<WebhookResult> {
			return { handled: true, agentId: `agent-${id}` }
		},
	}
}

function createMockCtx(): WebhookContext {
	return {
		companyRoot: '/tmp/test-company',
		streamManager: {} as SessionStreamManager,
	}
}

describe('WebhookHandlerRegistry', () => {
	let registry: WebhookHandlerRegistry

	beforeEach(() => {
		registry = new WebhookHandlerRegistry()
	})

	test('register and list handlers', () => {
		registry.register(createMockHandler('telegram', ['telegram']))
		registry.register(createMockHandler('slack', ['slack']))

		expect(registry.list()).toEqual(['telegram', 'slack'])
	})

	test('has returns true for registered handler', () => {
		registry.register(createMockHandler('telegram', ['telegram']))
		expect(registry.has('telegram')).toBe(true)
	})

	test('has returns false for unregistered handler', () => {
		expect(registry.has('telegram')).toBe(false)
	})

	test('dispatch routes to correct handler via canHandle', async () => {
		registry.register(createMockHandler('telegram', ['telegram']))
		registry.register(createMockHandler('slack', ['slack']))

		const result = await registry.dispatch('telegram', {}, createMockCtx())
		expect(result.handled).toBe(true)
		expect(result.agentId).toBe('agent-telegram')
	})

	test('dispatch returns not-handled when no handler matches', async () => {
		registry.register(createMockHandler('telegram', ['telegram']))

		const result = await registry.dispatch('unknown-hook', {}, createMockCtx())
		expect(result.handled).toBe(false)
		expect(result.error).toContain('no handler registered')
	})

	test('dispatch uses first matching handler', async () => {
		const handler1: WebhookHandler = {
			id: 'first',
			canHandle: () => true,
			handle: async () => ({ handled: true, agentId: 'first' }),
		}
		const handler2: WebhookHandler = {
			id: 'second',
			canHandle: () => true,
			handle: async () => ({ handled: true, agentId: 'second' }),
		}

		registry.register(handler1)
		registry.register(handler2)

		const result = await registry.dispatch('any', {}, createMockCtx())
		expect(result.agentId).toBe('first')
	})

	test('dispatch passes payload and context to handler', async () => {
		let capturedPayload: unknown
		let capturedCtx: WebhookContext | undefined

		const handler: WebhookHandler = {
			id: 'capture',
			canHandle: () => true,
			async handle(payload, ctx) {
				capturedPayload = payload
				capturedCtx = ctx
				return { handled: true }
			},
		}

		registry.register(handler)

		const payload = { data: 'test' }
		const ctx = createMockCtx()
		await registry.dispatch('test', payload, ctx)

		expect(capturedPayload).toEqual(payload)
		expect(capturedCtx).toBe(ctx)
	})
})
