import { describe, test, expect } from 'bun:test'
import { isDeniedPath } from '../src/auth/deny-patterns'
import { checkScope } from '../src/auth/permissions'
import type { Actor } from '../src/auth/types'

describe('isDeniedPath', () => {
	test('denies .auth/** paths', () => {
		expect(isDeniedPath('.auth/auth.db')).toBe(true)
		expect(isDeniedPath('.auth/agent-keys.yaml')).toBe(true)
		expect(isDeniedPath('.auth/invites.yaml')).toBe(true)
	})

	test('denies secrets/.master-key', () => {
		expect(isDeniedPath('secrets/.master-key')).toBe(true)
	})

	test('denies .data/** paths', () => {
		expect(isDeniedPath('.data/tasks.db')).toBe(true)
		expect(isDeniedPath('.data/messages.db')).toBe(true)
	})

	test('denies .git/** paths', () => {
		expect(isDeniedPath('.git/config')).toBe(true)
		expect(isDeniedPath('.git/HEAD')).toBe(true)
	})

	test('denies logs/audit/** paths', () => {
		expect(isDeniedPath('logs/audit/2026-03-23.jsonl')).toBe(true)
	})

	test('allows normal paths', () => {
		expect(isDeniedPath('tasks/backlog/task-1.yaml')).toBe(false)
		expect(isDeniedPath('comms/channels/general/msg.yaml')).toBe(false)
		expect(isDeniedPath('secrets/github.yaml')).toBe(false)
	})

	test('allows config files (protected by per-agent fs_scope, not hardcoded deny)', () => {
		expect(isDeniedPath('team/humans.yaml')).toBe(false)
		expect(isDeniedPath('company.yaml')).toBe(false)
		expect(isDeniedPath('team/agents.yaml')).toBe(false)
	})

	test('handles leading slashes', () => {
		expect(isDeniedPath('/.auth/auth.db')).toBe(true)
		expect(isDeniedPath('/.git/HEAD')).toBe(true)
	})
})

describe('checkScope', () => {
	test('denies hardcoded paths even with full scope', () => {
		const agent: Actor = {
			id: 'ceo',
			type: 'agent',
			name: 'CEO',
			role: 'agent',
			permissions: {},
			scope: {
				fsRead: ['**'],
				fsWrite: ['**'],
			},
			source: 'internal',
		}

		expect(checkScope(agent, 'fs_read', '.auth/auth.db')).toBe(false)
		expect(checkScope(agent, 'fs_write', '.auth/keys.yaml')).toBe(false)
		expect(checkScope(agent, 'fs_read', '.git/HEAD')).toBe(false)
		expect(checkScope(agent, 'fs_read', '.data/tasks.db')).toBe(false)
	})

	test('allows paths within scope', () => {
		const agent: Actor = {
			id: 'sam',
			type: 'agent',
			name: 'Sam',
			role: 'agent',
			permissions: {},
			scope: {
				fsRead: ['tasks/**', 'team/**'],
				fsWrite: ['tasks/**'],
			},
			source: 'internal',
		}

		expect(checkScope(agent, 'fs_read', 'tasks/backlog/task-1.yaml')).toBe(true)
		expect(checkScope(agent, 'fs_read', 'team/agents.yaml')).toBe(true)
		expect(checkScope(agent, 'fs_write', 'tasks/active/task-1.yaml')).toBe(true)
	})

	test('denies paths outside scope', () => {
		const agent: Actor = {
			id: 'sam',
			type: 'agent',
			name: 'Sam',
			role: 'agent',
			permissions: {},
			scope: {
				fsRead: ['tasks/**'],
				fsWrite: ['tasks/**'],
			},
			source: 'internal',
		}

		expect(checkScope(agent, 'fs_read', 'secrets/github.yaml')).toBe(false)
		expect(checkScope(agent, 'fs_write', 'company.yaml')).toBe(false)
	})

	test('allows unrestricted access when no scope', () => {
		const human: Actor = {
			id: 'owner',
			type: 'human',
			name: 'Owner',
			role: 'owner',
			permissions: { '*': ['*'] },
			source: 'dashboard',
		}

		expect(checkScope(human, 'fs_read', 'anything/here.yaml')).toBe(true)
		expect(checkScope(human, 'fs_write', 'anything/here.yaml')).toBe(true)
	})

	test('checks secret scope', () => {
		const agent: Actor = {
			id: 'sam',
			type: 'agent',
			name: 'Sam',
			role: 'agent',
			permissions: {},
			scope: {
				secrets: ['github', 'linear'],
			},
			source: 'internal',
		}

		expect(checkScope(agent, 'secret', 'github')).toBe(true)
		expect(checkScope(agent, 'secret', 'linear')).toBe(true)
		expect(checkScope(agent, 'secret', 'stripe')).toBe(false)
	})

	test('wildcard secret scope', () => {
		const agent: Actor = {
			id: 'ceo',
			type: 'agent',
			name: 'CEO',
			role: 'agent',
			permissions: {},
			scope: {
				secrets: ['*'],
			},
			source: 'internal',
		}

		expect(checkScope(agent, 'secret', 'anything')).toBe(true)
	})
})
