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
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    const result = await adapter.start(context)

    expect(result).toBeDefined()
    expect(result!.summary).toContain('Task completed successfully')
    expect(result!.tokens).toEqual({ input: 150, output: 50 })
    // Session ID should be captured (default persistence = 'local')
    expect(result!.sessionId).toBe('test-session-123')

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
      runtimeSessionRef: null,
      workDir: null,
      model: null,
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
      runtimeSessionRef: null,
      workDir: null,
      model: null,
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
      runtimeSessionRef: null,
      workDir: null,
      model: null,
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
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    // Start in background and then stop
    const startPromise = adapter.start(context)
    // Give it a moment to spawn
    await Bun.sleep(100)
    await adapter.stop()

    // The start should reject or return due to killed process
    await expect(startPromise).rejects.toThrow()
  })

  test('extracts structured outcome from AUTOPILOT_RESULT block', async () => {
    const outcomeBinaryPath = join(tmpDir, 'claude-structured')
    // Escape inner JSON properly for bash
    const jsonResult = JSON.stringify({
      result: 'Plan looks good.\\n\\n<AUTOPILOT_RESULT>\\n<outcome>approved</outcome>\\n<summary>Plan validated.</summary>\\n</AUTOPILOT_RESULT>',
      session_id: 's-out',
      usage: { input_tokens: 100, output_tokens: 30 },
    })
    const script = `#!/bin/bash\necho '${jsonResult}'\nexit 0\n`
    await writeFile(outcomeBinaryPath, script)
    await chmod(outcomeBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: outcomeBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-struct-1',
      agentId: 'dev',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Validate the plan',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result!.outputs).toEqual({ outcome: 'approved', summary: 'Plan validated.' })
    expect(result!.summary).toBe('Plan validated.')
  })

  test('extracts artifact from structured output', async () => {
    const artifactBinaryPath = join(tmpDir, 'claude-artifact')
    const jsonResult = JSON.stringify({
      result: 'Generated prompt.\\n\\n<AUTOPILOT_RESULT>\\n<summary>Prompt ready.</summary>\\n<artifact kind="implementation_prompt" title="Impl Prompt">Step 1: modify foo.ts</artifact>\\n</AUTOPILOT_RESULT>',
    })
    const script = `#!/bin/bash\necho '${jsonResult}'\nexit 0\n`
    await writeFile(artifactBinaryPath, script)
    await chmod(artifactBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: artifactBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-struct-2',
      agentId: 'dev',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Generate prompt',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result!.artifacts).toBeDefined()
    expect(result!.artifacts!.length).toBe(1)
    expect(result!.artifacts![0]!.kind).toBe('implementation_prompt')
    expect(result!.artifacts![0]!.title).toBe('Impl Prompt')
    expect(result!.artifacts![0]!.ref_value).toContain('Step 1')
  })

  test('no outcome when no structured block present', async () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: fakeBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-struct-3',
      agentId: 'dev',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Just do the work',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result!.outputs).toBeUndefined()
    expect(result!.artifacts).toBeUndefined()
  })
})
