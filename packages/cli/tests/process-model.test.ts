/**
 * Tests that the process model is explicit:
 * - server and worker are separate command groups
 * - start is a convenience wrapper that reuses worker bootstrap
 * - createLocalWorker is the shared worker factory
 */
import { test, expect, describe } from 'bun:test'
import { program } from '../src/index'
import { createLocalWorker } from '../src/commands/worker'
import { DEFAULT_LOCAL_WORKER_CONCURRENCY } from '../src/utils/worker-concurrency'
import type { AutopilotWorker } from '@questpie/autopilot-worker'

describe('process model: server/worker split', () => {
	test('server and worker are separate top-level command groups', () => {
		const names = program.commands.map((c) => c.name())
		expect(names).toContain('server')
		expect(names).toContain('worker')
	})

	test('start is a separate convenience command, not nested', () => {
		const names = program.commands.map((c) => c.name())
		expect(names).toContain('start')
		// start is top-level, not under server or worker
		const serverCmd = program.commands.find((c) => c.name() === 'server')
		const serverSubs = serverCmd!.commands.map((c) => c.name())
		expect(serverSubs).not.toContain('start-all')
	})

	test('server start only has --port (no worker options)', () => {
		const serverCmd = program.commands.find((c) => c.name() === 'server')
		const startCmd = serverCmd!.commands.find((c) => c.name() === 'start')
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--port')
		expect(opts).not.toContain('--no-worker')
		expect(opts).not.toContain('--url')
	})

	test('worker start has --url and --name (no --port)', () => {
		const workerCmd = program.commands.find((c) => c.name() === 'worker')
		const startCmd = workerCmd!.commands.find((c) => c.name() === 'start')
		const opts = startCmd!.options.map((o) => o.long)
		expect(opts).toContain('--url')
		expect(opts).toContain('--name')
		expect(opts).not.toContain('--port')
	})

	test('createLocalWorker produces a valid worker instance', () => {
		const worker: AutopilotWorker = createLocalWorker({
			orchestratorUrl: 'http://localhost:7778',
			workDir: '/tmp/test',
			name: 'test-worker',
		})
		expect(worker).toBeDefined()
		expect(typeof worker.start).toBe('function')
		expect(typeof worker.stop).toBe('function')
		expect(typeof worker.getResolvedRuntimes).toBe('function')
	})

	test('createLocalWorker resolves claude-code runtime with MCP', () => {
		const worker = createLocalWorker({
			orchestratorUrl: 'http://localhost:7778',
			workDir: '/tmp/test',
		})
		const runtimes = worker.getResolvedRuntimes()
		const capabilities = worker.getCapabilities()
		expect(runtimes.length).toBe(1)
		expect(capabilities.length).toBe(1)
		expect(runtimes[0]!.config.runtime).toBe('claude-code')
		expect(runtimes[0]!.config.useMcp).toBe(true)
		expect(runtimes[0]!.resolvedBinaryPath).toBeTruthy()
		expect(capabilities[0]!.maxConcurrent).toBe(DEFAULT_LOCAL_WORKER_CONCURRENCY)
	})
})
