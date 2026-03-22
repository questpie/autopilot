import { describe, test, expect } from 'bun:test'
import {
	PATHS,
	taskPath,
	agentMemoryPath,
	sessionPath,
	channelPath,
	projectPath,
	workflowPath,
	secretPath,
	pinPath,
} from '../src/paths'

describe('PATHS', () => {
	test('all values are strings starting with /company/', () => {
		for (const [_key, value] of Object.entries(PATHS)) {
			expect(typeof value).toBe('string')
			expect(value.startsWith('/company/')).toBe(true)
		}
	})

	test('COMPANY_CONFIG points to company.yaml', () => {
		expect(PATHS.COMPANY_CONFIG).toBe('/company/company.yaml')
	})

	test('AGENTS points to team/agents.yaml', () => {
		expect(PATHS.AGENTS).toBe('/company/team/agents.yaml')
	})

	test('HUMANS points to team/humans.yaml', () => {
		expect(PATHS.HUMANS).toBe('/company/team/humans.yaml')
	})

	test('TASKS_DIR points to /company/tasks', () => {
		expect(PATHS.TASKS_DIR).toBe('/company/tasks')
	})

	test('CHANNELS_DIR points to /company/comms/channels', () => {
		expect(PATHS.CHANNELS_DIR).toBe('/company/comms/channels')
	})

	test('PROJECTS_DIR points to /company/projects', () => {
		expect(PATHS.PROJECTS_DIR).toBe('/company/projects')
	})

	test('MEMORY_DIR points to /company/context/memory', () => {
		expect(PATHS.MEMORY_DIR).toBe('/company/context/memory')
	})

	test('SESSIONS_DIR points to /company/logs/sessions', () => {
		expect(PATHS.SESSIONS_DIR).toBe('/company/logs/sessions')
	})

	test('SECRETS_DIR points to /company/secrets', () => {
		expect(PATHS.SECRETS_DIR).toBe('/company/secrets')
	})

	test('PINS_DIR points to /company/dashboard/pins', () => {
		expect(PATHS.PINS_DIR).toBe('/company/dashboard/pins')
	})

	test('WORKFLOWS_DIR points to /company/team/workflows', () => {
		expect(PATHS.WORKFLOWS_DIR).toBe('/company/team/workflows')
	})
})

describe('taskPath', () => {
	test('returns correct path for status and id', () => {
		expect(taskPath('active', 'task-001')).toBe('/company/tasks/active/task-001.yaml')
	})

	test('works with backlog status', () => {
		expect(taskPath('backlog', 'feat-landing')).toBe('/company/tasks/backlog/feat-landing.yaml')
	})

	test('works with done status', () => {
		expect(taskPath('done', 'setup-ci')).toBe('/company/tasks/done/setup-ci.yaml')
	})
})

describe('agentMemoryPath', () => {
	test('returns correct path for agent id', () => {
		expect(agentMemoryPath('peter')).toBe('/company/context/memory/peter')
	})

	test('works with hyphenated agent id', () => {
		expect(agentMemoryPath('dev-ops')).toBe('/company/context/memory/dev-ops')
	})
})

describe('sessionPath', () => {
	test('returns correct path for agent and session', () => {
		expect(sessionPath('peter', 'session-001')).toBe(
			'/company/logs/sessions/peter/session-001',
		)
	})
})

describe('channelPath', () => {
	test('returns correct path for channel name', () => {
		expect(channelPath('general')).toBe('/company/comms/channels/general')
	})
})

describe('projectPath', () => {
	test('returns correct path for project name', () => {
		expect(projectPath('autopilot')).toBe('/company/projects/autopilot')
	})
})

describe('workflowPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(workflowPath('development')).toBe('/company/team/workflows/development.yaml')
	})
})

describe('secretPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(secretPath('github')).toBe('/company/secrets/github.yaml')
	})
})

describe('pinPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(pinPath('pin-001')).toBe('/company/dashboard/pins/pin-001.yaml')
	})
})
