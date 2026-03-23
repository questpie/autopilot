import { describe, test, expect } from 'bun:test'
import {
	AGENT_ROLES,
	TASK_STATUSES,
	TASK_TYPES,
	PRIORITIES,
	WORKFLOW_STEP_TYPES,
	TRIGGER_TYPES,
	PIN_TYPES,
	SESSION_STATUSES,
	GATE_TYPES,
} from '../src/constants'

describe('AGENT_ROLES', () => {
	test('is a non-empty readonly array', () => {
		expect(AGENT_ROLES.length).toBeGreaterThan(0)
		expect(Array.isArray(AGENT_ROLES)).toBe(true)
	})

	test('contains expected roles', () => {
		expect(AGENT_ROLES).toContain('meta')
		expect(AGENT_ROLES).toContain('strategist')
		expect(AGENT_ROLES).toContain('planner')
		expect(AGENT_ROLES).toContain('developer')
		expect(AGENT_ROLES).toContain('reviewer')
		expect(AGENT_ROLES).toContain('devops')
		expect(AGENT_ROLES).toContain('marketing')
		expect(AGENT_ROLES).toContain('design')
	})

	test('has exactly 8 roles', () => {
		expect(AGENT_ROLES).toHaveLength(8)
	})
})

describe('TASK_STATUSES', () => {
	test('is a non-empty readonly array', () => {
		expect(TASK_STATUSES.length).toBeGreaterThan(0)
		expect(Array.isArray(TASK_STATUSES)).toBe(true)
	})

	test('contains expected statuses', () => {
		expect(TASK_STATUSES).toContain('draft')
		expect(TASK_STATUSES).toContain('backlog')
		expect(TASK_STATUSES).toContain('assigned')
		expect(TASK_STATUSES).toContain('in_progress')
		expect(TASK_STATUSES).toContain('review')
		expect(TASK_STATUSES).toContain('blocked')
		expect(TASK_STATUSES).toContain('done')
		expect(TASK_STATUSES).toContain('cancelled')
	})

	test('has exactly 8 statuses', () => {
		expect(TASK_STATUSES).toHaveLength(8)
	})
})

describe('TASK_TYPES', () => {
	test('is a non-empty readonly array', () => {
		expect(TASK_TYPES.length).toBeGreaterThan(0)
		expect(Array.isArray(TASK_TYPES)).toBe(true)
	})

	test('contains expected types', () => {
		expect(TASK_TYPES).toContain('intent')
		expect(TASK_TYPES).toContain('planning')
		expect(TASK_TYPES).toContain('implementation')
		expect(TASK_TYPES).toContain('review')
		expect(TASK_TYPES).toContain('deployment')
		expect(TASK_TYPES).toContain('marketing')
		expect(TASK_TYPES).toContain('monitoring')
		expect(TASK_TYPES).toContain('human_required')
	})

	test('has exactly 8 types', () => {
		expect(TASK_TYPES).toHaveLength(8)
	})
})

describe('PRIORITIES', () => {
	test('is a non-empty readonly array', () => {
		expect(PRIORITIES.length).toBeGreaterThan(0)
		expect(Array.isArray(PRIORITIES)).toBe(true)
	})

	test('contains expected priorities in order', () => {
		expect(PRIORITIES[0]).toBe('critical')
		expect(PRIORITIES[1]).toBe('high')
		expect(PRIORITIES[2]).toBe('medium')
		expect(PRIORITIES[3]).toBe('low')
	})

	test('has exactly 4 priorities', () => {
		expect(PRIORITIES).toHaveLength(4)
	})
})

describe('WORKFLOW_STEP_TYPES', () => {
	test('is a non-empty readonly array', () => {
		expect(WORKFLOW_STEP_TYPES.length).toBeGreaterThan(0)
		expect(Array.isArray(WORKFLOW_STEP_TYPES)).toBe(true)
	})

	test('contains expected step types', () => {
		expect(WORKFLOW_STEP_TYPES).toContain('agent')
		expect(WORKFLOW_STEP_TYPES).toContain('human_gate')
		expect(WORKFLOW_STEP_TYPES).toContain('terminal')
		expect(WORKFLOW_STEP_TYPES).toContain('sub_workflow')
	})

	test('has exactly 4 step types', () => {
		expect(WORKFLOW_STEP_TYPES).toHaveLength(4)
	})
})

describe('TRIGGER_TYPES', () => {
	test('is a non-empty readonly array', () => {
		expect(TRIGGER_TYPES.length).toBeGreaterThan(0)
		expect(Array.isArray(TRIGGER_TYPES)).toBe(true)
	})

	test('contains expected trigger types', () => {
		expect(TRIGGER_TYPES).toContain('task_assigned')
		expect(TRIGGER_TYPES).toContain('task_status_changed')
		expect(TRIGGER_TYPES).toContain('mention')
		expect(TRIGGER_TYPES).toContain('message_received')
		expect(TRIGGER_TYPES).toContain('schedule')
		expect(TRIGGER_TYPES).toContain('webhook')
		expect(TRIGGER_TYPES).toContain('file_changed')
		expect(TRIGGER_TYPES).toContain('threshold')
		expect(TRIGGER_TYPES).toContain('human_action')
		expect(TRIGGER_TYPES).toContain('agent_request')
	})

	test('has exactly 10 trigger types', () => {
		expect(TRIGGER_TYPES).toHaveLength(10)
	})
})

describe('PIN_TYPES', () => {
	test('is a non-empty readonly array', () => {
		expect(PIN_TYPES.length).toBeGreaterThan(0)
		expect(Array.isArray(PIN_TYPES)).toBe(true)
	})

	test('contains expected pin types', () => {
		expect(PIN_TYPES).toContain('info')
		expect(PIN_TYPES).toContain('warning')
		expect(PIN_TYPES).toContain('success')
		expect(PIN_TYPES).toContain('error')
		expect(PIN_TYPES).toContain('progress')
	})

	test('has exactly 5 pin types', () => {
		expect(PIN_TYPES).toHaveLength(5)
	})
})

describe('SESSION_STATUSES', () => {
	test('is a non-empty readonly array', () => {
		expect(SESSION_STATUSES.length).toBeGreaterThan(0)
		expect(Array.isArray(SESSION_STATUSES)).toBe(true)
	})

	test('contains expected session statuses', () => {
		expect(SESSION_STATUSES).toContain('spawning')
		expect(SESSION_STATUSES).toContain('running')
		expect(SESSION_STATUSES).toContain('tool_call')
		expect(SESSION_STATUSES).toContain('idle')
		expect(SESSION_STATUSES).toContain('completed')
		expect(SESSION_STATUSES).toContain('failed')
		expect(SESSION_STATUSES).toContain('timeout')
	})

	test('has exactly 7 session statuses', () => {
		expect(SESSION_STATUSES).toHaveLength(7)
	})
})

describe('GATE_TYPES', () => {
	test('is a non-empty readonly array', () => {
		expect(GATE_TYPES.length).toBeGreaterThan(0)
		expect(Array.isArray(GATE_TYPES)).toBe(true)
	})

	test('contains expected gate types', () => {
		expect(GATE_TYPES).toContain('merge')
		expect(GATE_TYPES).toContain('deploy')
		expect(GATE_TYPES).toContain('publish')
		expect(GATE_TYPES).toContain('spend')
		expect(GATE_TYPES).toContain('setup')
		expect(GATE_TYPES).toContain('incident')
		expect(GATE_TYPES).toContain('review')
	})

	test('has exactly 7 gate types', () => {
		expect(GATE_TYPES).toHaveLength(7)
	})
})
