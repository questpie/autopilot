/**
 * Focused tests for adapter --model flag wiring.
 * Verifies that adapters include --model when context.model is set
 * and omit it when context.model is null.
 */
import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ClaudeCodeAdapter } from '../src/runtimes/claude-code'
import { CodexAdapter } from '../src/runtimes/codex'
import { OpenCodeAdapter } from '../src/runtimes/opencode'
import type { RunContext } from '../src/runtimes/adapter'

let tmpDir: string

beforeAll(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), 'adapter-model-'))
})

afterAll(async () => {
	await rm(tmpDir, { recursive: true })
})

function baseContext(overrides?: Partial<RunContext>): RunContext {
	return {
		runId: 'run-model-test',
		agentId: 'dev',
		agentName: null,
		agentRole: null,
		taskId: null,
		taskTitle: null,
		taskDescription: null,
		instructions: 'test prompt',
		orchestratorUrl: 'http://localhost:7778',
		apiKey: 'test-key',
		runtimeSessionRef: null,
		workDir: tmpDir,
		capabilities: null,
		model: null,
		...overrides,
	}
}

/**
 * Create a fake binary that dumps its received args to a file, then outputs
 * valid adapter-expected JSON to stdout.
 */
async function createArgCaptureBinary(name: string, jsonOutput: string): Promise<{ binaryPath: string; argsFile: string }> {
	const binaryPath = join(tmpDir, name)
	const argsFile = join(tmpDir, `${name}.args`)
	const script = `#!/bin/bash
echo "$@" > "${argsFile}"
echo '${jsonOutput}'
exit 0
`
	await writeFile(binaryPath, script)
	await chmod(binaryPath, 0o755)
	return { binaryPath, argsFile }
}

async function readArgs(argsFile: string): Promise<string> {
	return Bun.file(argsFile).text()
}

describe('Claude Code --model flag', () => {
	test('omits --model when context.model is null', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'claude-no-model',
			'{"type":"result","subtype":"success","result":"done","session_id":"s1","usage":{"input_tokens":1,"output_tokens":1}}',
		)
		const adapter = new ClaudeCodeAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: null }))
		const args = await readArgs(argsFile)
		expect(args).not.toContain('--model')
	})

	test('includes --model when context.model is set', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'claude-with-model',
			'{"type":"result","subtype":"success","result":"done","session_id":"s1","usage":{"input_tokens":1,"output_tokens":1}}',
		)
		const adapter = new ClaudeCodeAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: 'claude-opus-4-6' }))
		const args = await readArgs(argsFile)
		expect(args).toContain('--model')
		expect(args).toContain('claude-opus-4-6')
	})
})

describe('Codex --model flag', () => {
	test('omits --model when context.model is null', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'codex-no-model',
			'{"type":"thread.started","thread_id":"t1"}\n{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}\n',
		)
		const adapter = new CodexAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: null }))
		const args = await readArgs(argsFile)
		expect(args).not.toContain('--model')
	})

	test('includes --model when context.model is set', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'codex-with-model',
			'{"type":"thread.started","thread_id":"t1"}\n{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}\n',
		)
		const adapter = new CodexAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: 'gpt-4o' }))
		const args = await readArgs(argsFile)
		expect(args).toContain('--model')
		expect(args).toContain('gpt-4o')
	})
})

describe('OpenCode --model flag', () => {
	test('omits --model when context.model is null', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'opencode-no-model',
			'{"type":"text","text":"done","part":{"type":"text"}}',
		)
		const adapter = new OpenCodeAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: null }))
		const args = await readArgs(argsFile)
		expect(args).not.toContain('--model')
	})

	test('includes --model when context.model is set', async () => {
		const { binaryPath, argsFile } = await createArgCaptureBinary(
			'opencode-with-model',
			'{"type":"text","text":"done","part":{"type":"text"}}',
		)
		const adapter = new OpenCodeAdapter({ binaryPath, useMcp: false })
		adapter.onEvent(() => {})

		await adapter.start(baseContext({ model: 'anthropic/claude-sonnet-4-5' }))
		const args = await readArgs(argsFile)
		expect(args).toContain('--model')
		expect(args).toContain('anthropic/claude-sonnet-4-5')
	})
})
