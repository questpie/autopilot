import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('extended command registration', () => {
	const commandNames = program.commands.map((c) => c.name())

	it('registers the secrets command', () => {
		expect(commandNames).toContain('secrets')
	})

	it('registers the knowledge command', () => {
		expect(commandNames).toContain('knowledge')
	})

	it('registers the board command', () => {
		expect(commandNames).toContain('board')
	})

	it('registers the channels command', () => {
		expect(commandNames).toContain('channels')
	})

	it('registers the artifacts command', () => {
		expect(commandNames).toContain('artifacts')
	})

	it('registers the approve command', () => {
		expect(commandNames).toContain('approve')
	})

	it('registers the reject command', () => {
		expect(commandNames).toContain('reject')
	})

	it('has exactly 17 commands', () => {
		expect(program.commands.length).toBe(17)
	})

	it('has secrets subcommands', () => {
		const secretsCmd = program.commands.find((c) => c.name() === 'secrets')
		expect(secretsCmd).toBeDefined()
		const subNames = secretsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('list')
		expect(subNames).toContain('add')
		expect(subNames).toContain('remove')
	})

	it('has knowledge subcommands', () => {
		const knowledgeCmd = program.commands.find((c) => c.name() === 'knowledge')
		expect(knowledgeCmd).toBeDefined()
		const subNames = knowledgeCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('list')
		expect(subNames).toContain('show')
		expect(subNames).toContain('add')
		expect(subNames).toContain('scan')
	})

	it('has board subcommands', () => {
		const boardCmd = program.commands.find((c) => c.name() === 'board')
		expect(boardCmd).toBeDefined()
		const subNames = boardCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('clear')
	})

	it('has channels subcommands', () => {
		const channelsCmd = program.commands.find((c) => c.name() === 'channels')
		expect(channelsCmd).toBeDefined()
		const subNames = channelsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('show')
		expect(subNames).toContain('send')
	})

	it('has artifacts subcommands', () => {
		const artifactsCmd = program.commands.find((c) => c.name() === 'artifacts')
		expect(artifactsCmd).toBeDefined()
		const subNames = artifactsCmd!.commands.map((c) => c.name())
		expect(subNames).toContain('open')
		expect(subNames).toContain('stop')
	})
})
