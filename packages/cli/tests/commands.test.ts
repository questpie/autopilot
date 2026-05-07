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

	it('registers task command', () => {
		expect(commandNames).toContain('task')
	})

	it('registers run command', () => {
		expect(commandNames).toContain('run')
	})

	it('registers auth command', () => {
		expect(commandNames).toContain('auth')
	})

	it('registers workflow command', () => {
		expect(commandNames).toContain('workflow')
	})

	it('registers bootstrap command', () => {
		expect(commandNames).toContain('bootstrap')
	})

	it('registers secret command', () => {
		expect(commandNames).toContain('secret')
	})

	it('registers version command', () => {
		expect(commandNames).toContain('version')
	})

	it('registers update command', () => {
		expect(commandNames).toContain('update')
	})

	it('registers agent command', () => {
		expect(commandNames).toContain('agent')
	})

	it('has exactly 28 top-level commands', () => {
		expect(program.commands.length).toBe(28)
	})

	it('registers inbox command', () => {
		expect(commandNames).toContain('inbox')
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

	it('has task subcommands: show, create, update, children, parents, rollup', () => {
		const taskCmd = program.commands.find((c) => c.name() === 'task')
		expect(taskCmd).toBeDefined()
		const subNames = taskCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('create')
		expect(subNames).toContain('update')
		expect(subNames).toContain('children')
		expect(subNames).toContain('parents')
		expect(subNames).toContain('rollup')
	})

	it('has run subcommands: show, continue, cancel', () => {
		const runCmd = program.commands.find((c) => c.name() === 'run')
		expect(runCmd).toBeDefined()
		const subNames = runCmd!.commands.map((c) => c.name())
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

	it('has agent subcommands: skill, mcp, guide', () => {
		const agentCmd = program.commands.find((c) => c.name() === 'agent')
		expect(agentCmd).toBeDefined()
		const subNames = agentCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('skill')
		expect(subNames).toContain('mcp')
		expect(subNames).toContain('guide')
	})
})
