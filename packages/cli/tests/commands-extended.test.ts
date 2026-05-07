import { describe, expect, it } from 'bun:test'
import { program } from '../src/index'

describe('server start options', () => {
	const serverCmd = program.commands.find((c) => c.name() === 'server')
	const startCmd = serverCmd?.commands.find((c) => c.name() === 'start')

	it('has --port option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--port')
	})
})

describe('worker start options', () => {
	const workerCmd = program.commands.find((c) => c.name() === 'worker')
	const startCmd = workerCmd?.commands.find((c) => c.name() === 'start')

	it('has --url option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--url')
	})

	it('has --name option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--name')
	})

	it('has --runtime option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--runtime')
	})

	it('has --binary option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--binary')
	})

	it('has --session-persistence option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--session-persistence')
	})

	it('has --token option', () => {
		expect(startCmd).toBeDefined()
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--token')
	})
})

describe('start (convenience) options', () => {
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

describe('task create command options', () => {
	const taskCmd = program.commands.find((c) => c.name() === 'task')
	const createCmd = taskCmd?.commands.find((c) => c.name() === 'create')

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
})

describe('run command options', () => {
	const runCmd = program.commands.find((c) => c.name() === 'run')

	it('has --status option', () => {
		expect(runCmd).toBeDefined()
		const opts = runCmd!.options.map((o) => o.long)
		expect(opts).toContain('--status')
	})
})

describe('run continue command options', () => {
	const runCmd = program.commands.find((c) => c.name() === 'run')
	const continueCmd = runCmd?.commands.find((c) => c.name() === 'continue')

	it('has --message required option', () => {
		expect(continueCmd).toBeDefined()
		const opts = continueCmd!.options.map((o) => o.long)
		expect(opts).toContain('--message')
	})

	it('requires a run ID argument', () => {
		expect(continueCmd).toBeDefined()
		const args = continueCmd!.registeredArguments?.map((a: { name: () => string }) => a.name()) ?? []
		expect(args).toContain('id')
	})
})
