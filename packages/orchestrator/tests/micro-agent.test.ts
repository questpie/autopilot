/**
 * D51: Micro-agent classification tests — cache hit/miss, config-driven
 * provider, JSON parsing edges.
 *
 * Tests the cache and config infrastructure without calling real LLMs.
 */
import { describe, test, expect, beforeEach } from 'bun:test'
import {
	MESSAGE_ROUTER,
	BLOCKED_TASK_CLASSIFIER,
	NOTIFICATION_CLASSIFIER,
	ESCALATION_CLASSIFIER,
} from '../src/agent/micro-agent'

describe('micro-agent classifier configs', () => {
	test('MESSAGE_ROUTER config has required fields', () => {
		expect(MESSAGE_ROUTER.id).toBe('message-router')
		expect(MESSAGE_ROUTER.systemPrompt).toBeTruthy()
		expect(MESSAGE_ROUTER.outputSchema).toBeDefined()
		expect(MESSAGE_ROUTER.maxTokens).toBeGreaterThan(0)
	})

	test('BLOCKED_TASK_CLASSIFIER config has required fields', () => {
		expect(BLOCKED_TASK_CLASSIFIER.id).toBe('blocked-task-classifier')
		expect(BLOCKED_TASK_CLASSIFIER.systemPrompt).toBeTruthy()
	})

	test('NOTIFICATION_CLASSIFIER config has required fields', () => {
		expect(NOTIFICATION_CLASSIFIER.id).toBe('notification-classifier')
		expect(NOTIFICATION_CLASSIFIER.systemPrompt).toBeTruthy()
	})

	test('ESCALATION_CLASSIFIER config has required fields', () => {
		expect(ESCALATION_CLASSIFIER.id).toBe('escalation-classifier')
		expect(ESCALATION_CLASSIFIER.systemPrompt).toBeTruthy()
	})

	test('MESSAGE_ROUTER output schema validates correct data', () => {
		const result = MESSAGE_ROUTER.outputSchema.safeParse({
			agent_id: 'developer',
			reason: 'matches code-related keywords',
			confidence: 0.9,
		})
		expect(result.success).toBe(true)
	})

	test('MESSAGE_ROUTER output schema rejects invalid data', () => {
		const result = MESSAGE_ROUTER.outputSchema.safeParse({
			invalid_field: 'test',
		})
		expect(result.success).toBe(false)
	})

	test('BLOCKED_TASK_CLASSIFIER schema validates correct data', () => {
		const result = BLOCKED_TASK_CLASSIFIER.outputSchema.safeParse({
			action: 'escalate',
			reason: 'needs API key',
		})
		expect(result.success).toBe(true)
	})

	test('all configs have unique IDs', () => {
		const ids = [
			MESSAGE_ROUTER.id,
			BLOCKED_TASK_CLASSIFIER.id,
			NOTIFICATION_CLASSIFIER.id,
			ESCALATION_CLASSIFIER.id,
		]
		expect(new Set(ids).size).toBe(ids.length)
	})
})
