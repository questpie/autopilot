import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ClaudeCodeAdapter } from '../src/runtimes/claude-code'
import type { RunContext, WorkerEvent } from '../src/runtimes/adapter'

describe('ClaudeCodeAdapter', () => {
  let tmpDir: string
  let fakeBinaryPath: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'claude-test-'))
    fakeBinaryPath = join(tmpDir, 'claude')

    // Create a fake claude binary that outputs JSON
    const script = `#!/bin/bash
# Fake Claude Code binary for testing
echo '{"result":"Task completed successfully. I analyzed the codebase and made the requested changes.","session_id":"test-session-123","usage":{"input_tokens":150,"output_tokens":50}}'
exit 0
`
    await writeFile(fakeBinaryPath, script)
    await chmod(fakeBinaryPath, 0o755)
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('executes a run and returns structured result', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: fakeBinaryPath,
      workDir: tmpDir,
    })

    const events: WorkerEvent[] = []
    adapter.onEvent((event) => events.push(event))

    const context: RunContext = {
      runId: 'run-test-1',
      agentId: 'developer',
      taskId: 'task-1',
      taskTitle: 'Fix authentication bug',
      taskDescription: 'The login form is not validating email format',
      instructions: 'Fix the email validation in src/auth/login.ts',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    }

    const result = await adapter.start(context)

    expect(result).toBeDefined()
    expect(result!.summary).toContain('Task completed successfully')
    expect(result!.tokens).toEqual({ input: 150, output: 50 })

    // Verify events were emitted (progress: launching + progress: completed)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0]!.type).toBe('progress')
    expect(events[0]!.summary).toBe('Launching Claude Code')
    expect(events[1]!.type).toBe('progress')
    expect(events[1]!.summary).toBe('Claude Code completed')
  })

  test('handles non-zero exit code', async () => {
    const failBinaryPath = join(tmpDir, 'claude-fail')
    await writeFile(failBinaryPath, '#!/bin/bash\necho "API key invalid" >&2\nexit 1\n')
    await chmod(failBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: failBinaryPath,
      workDir: tmpDir,
    })

    const events: WorkerEvent[] = []
    adapter.onEvent((event) => events.push(event))

    const context: RunContext = {
      runId: 'run-test-2',
      agentId: 'developer',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'bad-key',
    }

    await expect(adapter.start(context)).rejects.toThrow('API key invalid')

    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents.length).toBe(1)
  })

  test('builds prompt correctly from context', async () => {
    const echoBinaryPath = join(tmpDir, 'claude-echo')
    const echoScript = `#!/bin/bash
# Find the -p flag and echo the prompt as the result
prompt=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p) prompt="$2"; shift 2 ;;
    *) shift ;;
  esac
done
echo "{\\"result\\":\\"PROMPT: $prompt\\"}"
exit 0
`
    await writeFile(echoBinaryPath, echoScript)
    await chmod(echoBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: echoBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-test-3',
      agentId: 'developer',
      taskId: 'task-1',
      taskTitle: 'Write tests',
      taskDescription: 'Add unit tests for the auth module',
      instructions: 'Focus on edge cases',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    }

    const result = await adapter.start(context)
    expect(result!.summary).toContain('Write tests')
    expect(result!.summary).toContain('Add unit tests')
    expect(result!.summary).toContain('Focus on edge cases')
  })

  test('handles plain text stdout gracefully', async () => {
    const plainBinaryPath = join(tmpDir, 'claude-plain')
    await writeFile(plainBinaryPath, '#!/bin/bash\necho "Just some plain text output"\nexit 0\n')
    await chmod(plainBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: plainBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-test-4',
      agentId: 'developer',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    }

    const result = await adapter.start(context)
    expect(result).toBeDefined()
    expect(result!.summary).toBe('Just some plain text output')
    expect(result!.tokens).toBeUndefined()
  })

  test('stop kills the subprocess', async () => {
    // Create a binary that sleeps
    const sleepBinaryPath = join(tmpDir, 'claude-sleep')
    await writeFile(sleepBinaryPath, '#!/bin/bash\nsleep 60\n')
    await chmod(sleepBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: sleepBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-test-5',
      agentId: 'developer',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
    }

    // Start in background and then stop
    const startPromise = adapter.start(context)
    // Give it a moment to spawn
    await Bun.sleep(100)
    await adapter.stop()

    // The start should reject or return due to killed process
    await expect(startPromise).rejects.toThrow()
  })
})
