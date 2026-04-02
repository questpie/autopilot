import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('command registration', () => {
	const commandNames = program.commands.map((c) => c.name())

	it('registers the start command', () => {
		expect(commandNames).toContain('start')
	})

	it('registers the tasks command', () => {
		expect(commandNames).toContain('tasks')
	})

	it('registers the runs command', () => {
		expect(commandNames).toContain('runs')
	})

	it('registers the auth command', () => {
		expect(commandNames).toContain('auth')
	})

	it('has exactly 4 top-level commands', () => {
		expect(program.commands.length).toBe(4)
	})

	it('has tasks subcommands: show, create, update', () => {
		const tasksCmd = program.commands.find((c) => c.name() === 'tasks')
		expect(tasksCmd).toBeDefined()
		const subNames = tasksCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('create')
		expect(subNames).toContain('update')
	})

	it('has runs subcommands: show', () => {
		const runsCmd = program.commands.find((c) => c.name() === 'runs')
		expect(runsCmd).toBeDefined()
		const subNames = runsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
	})

	it('has auth subcommands: login, setup, status, logout', () => {
		const authCmd = program.commands.find((c) => c.name() === 'auth')
		expect(authCmd).toBeDefined()
		const subNames = authCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('login')
		expect(subNames).toContain('setup')
		expect(subNames).toContain('status')
		expect(subNames).toContain('logout')
	})
})
