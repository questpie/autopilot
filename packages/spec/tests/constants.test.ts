import { describe, expect, test } from 'bun:test'
import {
	AGENT_ROLES,
	GATE_TYPES,
	PIN_TYPES,
	PRIORITIES,
	SESSION_STATUSES,
	TASK_STATUSES,
	TASK_TYPES,
	TRANSPORT_TYPES,
	TRIGGER_TYPES,
	WORKFLOW_STEP_TYPES,
} from '../src/constants'

describe('constants', () => {
	const allConstants = {
		AGENT_ROLES,
		TASK_STATUSES,
		TASK_TYPES,
		PRIORITIES,
		WORKFLOW_STEP_TYPES,
		TRIGGER_TYPES,
		TRANSPORT_TYPES,
		PIN_TYPES,
		SESSION_STATUSES,
		GATE_TYPES,
	}

	for (const [name, values] of Object.entries(allConstants)) {
		test(`${name} is a non-empty readonly array`, () => {
			expect(Array.isArray(values)).toBe(true)
			expect(values.length).toBeGreaterThan(0)
		})
	}

	test('AGENT_ROLES contains expected roles', () => {
		expect(AGENT_ROLES).toContain('developer')
		expect(AGENT_ROLES).toContain('meta')
		expect(AGENT_ROLES).toContain('strategist')
		expect(AGENT_ROLES).toContain('reviewer')
	})

	test('TASK_STATUSES contains expected statuses', () => {
		expect(TASK_STATUSES).toContain('in_progress')
		expect(TASK_STATUSES).toContain('done')
		expect(TASK_STATUSES).toContain('blocked')
	})

	test('PRIORITIES are ordered critical to low', () => {
		expect(PRIORITIES[0]).toBe('critical')
		expect(PRIORITIES[PRIORITIES.length - 1]).toBe('low')
	})
})
