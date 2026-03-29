import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('command registration', () => {
	const commandNames = program.commands.map((c) => c.name())

	it('registers the init command', () => {
		expect(commandNames).toContain('init')
	})

	it('registers the status command', () => {
		expect(commandNames).toContain('status')
	})

	it('registers the ask command', () => {
		expect(commandNames).toContain('ask')
	})

	it('registers the tasks command', () => {
		expect(commandNames).toContain('tasks')
	})

	it('registers the agents command', () => {
		expect(commandNames).toContain('agents')
	})

	it('registers the inbox command', () => {
		expect(commandNames).toContain('inbox')
	})

	it('registers the attach command', () => {
		expect(commandNames).toContain('attach')
	})

	it('registers the start command', () => {
		expect(commandNames).toContain('start')
	})

	it('has exactly 21 commands', () => {
		expect(program.commands.length).toBe(22)
	})

	it('has tasks subcommands', () => {
		const tasksCmd = program.commands.find((c) => c.name() === 'tasks')
		expect(tasksCmd).toBeDefined()
		const subNames = tasksCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('approve')
		expect(subNames).toContain('reject')
	})

	it('has agents subcommands', () => {
		const agentsCmd = program.commands.find((c) => c.name() === 'agents')
		expect(agentsCmd).toBeDefined()
		const subNames = agentsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
	})
})
