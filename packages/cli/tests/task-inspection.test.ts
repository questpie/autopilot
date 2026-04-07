import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

/**
 * Tests for parent/child task inspection CLI commands.
 *
 * These verify command registration and structure. Full integration tests
 * with the orchestrator API are covered in the orchestrator test suite
 * (task-graph.test.ts).
 */

describe('task inspection commands', () => {
	const tasksCmd = program.commands.find((c) => c.name() === 'tasks')!
	const subNames = tasksCmd.commands.map((c) => c.name())

	it('registers children subcommand', () => {
		expect(subNames).toContain('children')
	})

	it('registers parents subcommand', () => {
		expect(subNames).toContain('parents')
	})

	it('registers rollup subcommand', () => {
		expect(subNames).toContain('rollup')
	})

	it('children command accepts task ID argument', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'children')!
		// Commander stores arguments in _args
		expect((cmd as any)._args.length).toBe(1)
	})

	it('parents command accepts task ID argument', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'parents')!
		expect((cmd as any)._args.length).toBe(1)
	})

	it('rollup command accepts task ID argument', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'rollup')!
		expect((cmd as any)._args.length).toBe(1)
	})

	it('children command has --relation option', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'children')!
		const optNames = cmd.options.map((o) => o.long)
		expect(optNames).toContain('--relation')
	})

	it('parents command has --relation option', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'parents')!
		const optNames = cmd.options.map((o) => o.long)
		expect(optNames).toContain('--relation')
	})

	it('rollup command has --relation option', () => {
		const cmd = tasksCmd.commands.find((c) => c.name() === 'rollup')!
		const optNames = cmd.options.map((o) => o.long)
		expect(optNames).toContain('--relation')
	})

	it('existing task subcommands are preserved', () => {
		expect(subNames).toContain('show')
		expect(subNames).toContain('create')
		expect(subNames).toContain('update')
		expect(subNames).toContain('approve')
		expect(subNames).toContain('reject')
		expect(subNames).toContain('reply')
	})
})
