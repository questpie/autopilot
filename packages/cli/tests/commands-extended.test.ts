import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('start command options', () => {
	const startCmd = program.commands.find((c) => c.name() === 'start')

	it('has --port option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--port')
	})

	it('has --no-worker option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--no-worker')
	})
})

describe('tasks create command options', () => {
	const tasksCmd = program.commands.find((c) => c.name() === 'tasks')
	const createCmd = tasksCmd?.commands.find((c) => c.name() === 'create')

	it('has --title required option', () => {
		expect(createCmd).toBeDefined()
		const opts = createCmd!.options.map((o) => o.long)
		expect(opts).toContain('--title')
	})

	it('has --type required option', () => {
		expect(createCmd).toBeDefined()
		const opts = createCmd!.options.map((o) => o.long)
		expect(opts).toContain('--type')
	})

	it('has --description option', () => {
		expect(createCmd).toBeDefined()
		const opts = createCmd!.options.map((o) => o.long)
		expect(opts).toContain('--description')
	})
})

describe('runs command options', () => {
	const runsCmd = program.commands.find((c) => c.name() === 'runs')

	it('has --status option', () => {
		expect(runsCmd).toBeDefined()
		const opts = runsCmd!.options.map((o) => o.long)
		expect(opts).toContain('--status')
	})

	it('has --agent option', () => {
		expect(runsCmd).toBeDefined()
		const opts = runsCmd!.options.map((o) => o.long)
		expect(opts).toContain('--agent')
	})
})
