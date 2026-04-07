import { describe, expect, test } from 'bun:test'
import { resolveModel, type RuntimeConfig } from '../src/runtime-config'

describe('resolveModel', () => {
	test('returns null when no model provided', () => {
		const config: RuntimeConfig = { runtime: 'claude-code' }
		expect(resolveModel(config, null)).toBeNull()
		expect(resolveModel(config, undefined)).toBeNull()
	})

	test('passes canonical model through when no modelMap', () => {
		const config: RuntimeConfig = { runtime: 'claude-code' }
		expect(resolveModel(config, 'claude-sonnet-4')).toBe('claude-sonnet-4')
	})

	test('passes canonical model through when not in modelMap', () => {
		const config: RuntimeConfig = {
			runtime: 'claude-code',
			modelMap: { 'gpt-4o': 'gpt-4o-2024-08-06' },
		}
		expect(resolveModel(config, 'claude-sonnet-4')).toBe('claude-sonnet-4')
	})

	test('resolves model through modelMap', () => {
		const config: RuntimeConfig = {
			runtime: 'claude-code',
			modelMap: {
				'claude-sonnet-4': 'claude-sonnet-4-20250514',
				'claude-opus-4': 'claude-opus-4-20250514',
			},
		}
		expect(resolveModel(config, 'claude-sonnet-4')).toBe('claude-sonnet-4-20250514')
		expect(resolveModel(config, 'claude-opus-4')).toBe('claude-opus-4-20250514')
	})

	test('resolves opencode provider/model format', () => {
		const config: RuntimeConfig = {
			runtime: 'opencode',
			modelMap: {
				'claude-sonnet-4': 'anthropic/claude-sonnet-4-5',
				'gpt-4o': 'openai/gpt-4o',
			},
		}
		expect(resolveModel(config, 'claude-sonnet-4')).toBe('anthropic/claude-sonnet-4-5')
		expect(resolveModel(config, 'gpt-4o')).toBe('openai/gpt-4o')
	})

	test('empty modelMap passes through', () => {
		const config: RuntimeConfig = {
			runtime: 'codex',
			modelMap: {},
		}
		expect(resolveModel(config, 'gpt-4o')).toBe('gpt-4o')
	})
})
