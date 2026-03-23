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
	test('all values are strings starting with /', () => {
		for (const [_key, value] of Object.entries(PATHS)) {
			expect(typeof value).toBe('string')
			expect(value.startsWith('/')).toBe(true)
		}
	})

	test('COMPANY_CONFIG points to company.yaml', () => {
		expect(PATHS.COMPANY_CONFIG).toBe('/company.yaml')
	})

	test('AGENTS points to team/agents.yaml', () => {
		expect(PATHS.AGENTS).toBe('/team/agents.yaml')
	})

	test('HUMANS points to team/humans.yaml', () => {
		expect(PATHS.HUMANS).toBe('/team/humans.yaml')
	})

	test('TASKS_DIR points to /tasks', () => {
		expect(PATHS.TASKS_DIR).toBe('/tasks')
	})

	test('CHANNELS_DIR points to /comms/channels', () => {
		expect(PATHS.CHANNELS_DIR).toBe('/comms/channels')
	})

	test('PROJECTS_DIR points to /projects', () => {
		expect(PATHS.PROJECTS_DIR).toBe('/projects')
	})

	test('MEMORY_DIR points to /context/memory', () => {
		expect(PATHS.MEMORY_DIR).toBe('/context/memory')
	})

	test('SESSIONS_DIR points to /logs/sessions', () => {
		expect(PATHS.SESSIONS_DIR).toBe('/logs/sessions')
	})

	test('SECRETS_DIR points to /secrets', () => {
		expect(PATHS.SECRETS_DIR).toBe('/secrets')
	})

	test('PINS_DIR points to /dashboard/pins', () => {
		expect(PATHS.PINS_DIR).toBe('/dashboard/pins')
	})

	test('WORKFLOWS_DIR points to /team/workflows', () => {
		expect(PATHS.WORKFLOWS_DIR).toBe('/team/workflows')
	})
})

describe('taskPath', () => {
	test('returns correct path for status and id', () => {
		expect(taskPath('active', 'task-001')).toBe('/tasks/active/task-001.yaml')
	})

	test('works with backlog status', () => {
		expect(taskPath('backlog', 'feat-landing')).toBe('/tasks/backlog/feat-landing.yaml')
	})

	test('works with done status', () => {
		expect(taskPath('done', 'setup-ci')).toBe('/tasks/done/setup-ci.yaml')
	})
})

describe('agentMemoryPath', () => {
	test('returns correct path for agent id', () => {
		expect(agentMemoryPath('peter')).toBe('/context/memory/peter')
	})

	test('works with hyphenated agent id', () => {
		expect(agentMemoryPath('dev-ops')).toBe('/context/memory/dev-ops')
	})
})

describe('sessionPath', () => {
	test('returns correct path for agent and session', () => {
		expect(sessionPath('peter', 'session-001')).toBe(
			'/logs/sessions/peter/session-001',
		)
	})
})

describe('channelPath', () => {
	test('returns correct path for channel name', () => {
		expect(channelPath('general')).toBe('/comms/channels/general')
	})
})

describe('projectPath', () => {
	test('returns correct path for project name', () => {
		expect(projectPath('autopilot')).toBe('/projects/autopilot')
	})
})

describe('workflowPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(workflowPath('development')).toBe('/team/workflows/development.yaml')
	})
})

describe('secretPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(secretPath('github')).toBe('/secrets/github.yaml')
	})
})

describe('pinPath', () => {
	test('returns correct path with .yaml extension', () => {
		expect(pinPath('pin-001')).toBe('/dashboard/pins/pin-001.yaml')
	})
})
