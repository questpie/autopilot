import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ZodError } from 'zod'
import { DeploymentModeSchema, DEPLOYMENT_MODES, resolveDeploymentMode } from '../src/schemas'

describe('DeploymentModeSchema', () => {
	test('defaults to selfhosted when undefined', () => {
		const result = DeploymentModeSchema.parse(undefined)
		expect(result).toBe('selfhosted')
	})

	test('accepts selfhosted', () => {
		const result = DeploymentModeSchema.parse('selfhosted')
		expect(result).toBe('selfhosted')
	})

	test('accepts cloud', () => {
		const result = DeploymentModeSchema.parse('cloud')
		expect(result).toBe('cloud')
	})

	test('rejects invalid values', () => {
		expect(() => DeploymentModeSchema.parse('hybrid')).toThrow(ZodError)
		expect(() => DeploymentModeSchema.parse('onprem')).toThrow(ZodError)
		expect(() => DeploymentModeSchema.parse('')).toThrow(ZodError)
		expect(() => DeploymentModeSchema.parse(42)).toThrow(ZodError)
	})

	test('DEPLOYMENT_MODES contains exactly selfhosted and cloud', () => {
		expect(DEPLOYMENT_MODES).toEqual(['selfhosted', 'cloud'])
	})
})

describe('resolveDeploymentMode', () => {
	let originalEnv: string | undefined

	beforeEach(() => {
		originalEnv = process.env.DEPLOYMENT_MODE
	})

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env.DEPLOYMENT_MODE
		} else {
			process.env.DEPLOYMENT_MODE = originalEnv
		}
	})

	test('returns selfhosted when env var is not set', () => {
		delete process.env.DEPLOYMENT_MODE
		expect(resolveDeploymentMode()).toBe('selfhosted')
	})

	test('returns cloud when env var is cloud', () => {
		process.env.DEPLOYMENT_MODE = 'cloud'
		expect(resolveDeploymentMode()).toBe('cloud')
	})

	test('returns selfhosted when env var is selfhosted', () => {
		process.env.DEPLOYMENT_MODE = 'selfhosted'
		expect(resolveDeploymentMode()).toBe('selfhosted')
	})

	test('returns selfhosted for invalid env var values', () => {
		process.env.DEPLOYMENT_MODE = 'invalid'
		expect(resolveDeploymentMode()).toBe('selfhosted')
	})
})
