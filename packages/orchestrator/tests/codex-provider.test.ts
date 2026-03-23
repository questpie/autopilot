import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { CodexSDKProvider } from '../src/agent/providers/codex-sdk'
import { getProvider, registerProvider } from '../src/agent/spawner'
import type { AgentSpawnOptions, AgentEvent } from '../src/agent/provider'

// ── CodexSDKProvider ──────────────────────────────────────────────────

describe('CodexSDKProvider', () => {
	test('has correct name', () => {
		const provider = new CodexSDKProvider()
		expect(provider.name).toBe('codex-sdk')
	})

	test('implements AgentProvider interface', () => {
		const provider = new CodexSDKProvider()
		expect(typeof provider.spawn).toBe('function')
		expect(typeof provider.name).toBe('string')
	})

	test('emits error when codex-sdk is not installed', async () => {
		const provider = new CodexSDKProvider()
		const events: AgentEvent[] = []

		const result = await provider.spawn(
			{
				systemPrompt: 'You are a test agent.',
				prompt: 'Say hello',
				model: 'gpt-4o',
				tools: [],
				toolContext: { companyRoot: '/tmp/test', agentId: 'test' },
				maxTurns: 1,
			},
			(event) => events.push(event),
		)

		// Since @openai/codex-sdk is not installed in dev deps, it should fail gracefully
		expect(result.error).toBeDefined()
		expect(events.some((e) => e.type === 'error')).toBe(true)
	})
})

// ── Provider Registry ─────────────────────────────────────────────────

describe('Provider Registry', () => {
	test('codex-sdk provider is registered', () => {
		const provider = getProvider('codex-sdk')
		expect(provider).toBeDefined()
		expect(provider.name).toBe('codex-sdk')
	})

	test('claude-agent-sdk provider is registered', () => {
		const provider = getProvider('claude-agent-sdk')
		expect(provider).toBeDefined()
		expect(provider.name).toBe('claude-agent-sdk')
	})

	test('unknown provider falls back to claude-agent-sdk', () => {
		const provider = getProvider('nonexistent-provider')
		expect(provider).toBeDefined()
		expect(provider.name).toBe('claude-agent-sdk')
	})

	test('spawnAgent resolves codex-sdk provider by name', () => {
		const provider = getProvider('codex-sdk')
		expect(provider).toBeInstanceOf(CodexSDKProvider)
	})
})
