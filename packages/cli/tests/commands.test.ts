import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('command registration', () => {
	const commandNames = program.commands.map((c) => c.name())

	it('registers server command', () => {
		expect(commandNames).toContain('server')
	})

	it('registers worker command', () => {
		expect(commandNames).toContain('worker')
	})

	it('registers start command (convenience wrapper)', () => {
		expect(commandNames).toContain('start')
	})

	it('registers tasks command', () => {
		expect(commandNames).toContain('tasks')
	})

	it('registers runs command', () => {
		expect(commandNames).toContain('runs')
	})

	it('registers auth command', () => {
		expect(commandNames).toContain('auth')
	})

	it('registers workflows command', () => {
		expect(commandNames).toContain('workflows')
	})

	it('has exactly 8 top-level commands', () => {
		expect(program.commands.length).toBe(8)
	})

	it('server has start subcommand', () => {
		const serverCmd = program.commands.find((c) => c.name() === 'server')
		expect(serverCmd).toBeDefined()
		const subNames = serverCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('start')
	})

	it('worker has start and token subcommands', () => {
		const workerCmd = program.commands.find((c) => c.name() === 'worker')
		expect(workerCmd).toBeDefined()
		const subNames = workerCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('start')
		expect(subNames).toContain('token')
	})

	it('has tasks subcommands: show, create, update', () => {
		const tasksCmd = program.commands.find((c) => c.name() === 'tasks')
		expect(tasksCmd).toBeDefined()
		const subNames = tasksCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('create')
		expect(subNames).toContain('update')
	})

	it('has runs subcommands: show, continue, cancel', () => {
		const runsCmd = program.commands.find((c) => c.name() === 'runs')
		expect(runsCmd).toBeDefined()
		const subNames = runsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('continue')
		expect(subNames).toContain('cancel')
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
