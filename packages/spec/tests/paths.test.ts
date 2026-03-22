import { describe, expect, test } from 'bun:test'
import {
	PATHS,
	agentMemoryPath,
	channelPath,
	pinPath,
	projectPath,
	secretPath,
	sessionPath,
	taskPath,
	workflowPath,
} from '../src/paths'

describe('PATHS', () => {
	test('all paths start with /company/', () => {
		for (const [key, value] of Object.entries(PATHS)) {
			expect(value).toStartWith('/company/')
		}
	})

	test('key paths exist', () => {
		expect(PATHS.COMPANY_CONFIG).toBe('/company/company.yaml')
		expect(PATHS.AGENTS).toBe('/company/team/agents.yaml')
		expect(PATHS.TASKS_ACTIVE).toBe('/company/tasks/active')
		expect(PATHS.MEMORY_DIR).toBe('/company/context/memory')
		expect(PATHS.PINS_DIR).toBe('/company/dashboard/pins')
	})
})

describe('dynamic path helpers', () => {
	test('taskPath', () => {
		expect(taskPath('active', 'task-001')).toBe('/company/tasks/active/task-001.yaml')
		expect(taskPath('blocked', 'task-042')).toBe('/company/tasks/blocked/task-042.yaml')
	})

	test('agentMemoryPath', () => {
		expect(agentMemoryPath('peter')).toBe('/company/context/memory/peter')
	})

	test('sessionPath', () => {
		expect(sessionPath('peter', 'sess-001')).toBe(
			'/company/logs/sessions/peter/sess-001',
		)
	})

	test('channelPath', () => {
		expect(channelPath('dev')).toBe('/company/comms/channels/dev')
	})

	test('projectPath', () => {
		expect(projectPath('studio')).toBe('/company/projects/studio')
	})

	test('workflowPath', () => {
		expect(workflowPath('development')).toBe(
			'/company/team/workflows/development.yaml',
		)
	})

	test('secretPath', () => {
		expect(secretPath('github')).toBe('/company/secrets/github.yaml')
	})

	test('pinPath', () => {
		expect(pinPath('pin-001')).toBe('/company/dashboard/pins/pin-001.yaml')
	})
})
