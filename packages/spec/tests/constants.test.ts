import { describe, expect, test } from 'bun:test'
import { AGENT_ROLES, HUMAN_ROLES, PRIORITIES, TASK_STATUSES } from '../src/constants'

describe('AGENT_ROLES', () => {
	test('contains the current agent roles', () => {
		expect(AGENT_ROLES).toEqual([
			'meta',
			'strategist',
			'planner',
			'developer',
			'reviewer',
			'devops',
			'marketing',
			'design',
		])
	})
})

describe('HUMAN_ROLES', () => {
	test('contains the current human roles', () => {
		expect(HUMAN_ROLES).toEqual(['owner', 'admin', 'member', 'viewer'])
	})
})

describe('TASK_STATUSES', () => {
	test('contains the current task lifecycle statuses', () => {
		expect(TASK_STATUSES).toEqual(['backlog', 'active', 'review', 'blocked', 'done'])
	})
})

describe('PRIORITIES', () => {
	test('contains priorities from most urgent to least urgent', () => {
		expect(PRIORITIES).toEqual(['critical', 'high', 'medium', 'low'])
	})
})
