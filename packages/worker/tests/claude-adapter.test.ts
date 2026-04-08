import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ClaudeCodeAdapter } from '../src/runtimes/claude-code'
import type { RunContext, WorkerEvent } from '../src/runtimes/adapter'

/** Helper to build a fake claude binary that outputs stream-json JSONL events. */
function buildClaudeScript(events: object[]): string {
  const lines = events.map((e) => JSON.stringify(e))
  return `#!/bin/bash\n${lines.map((l) => `echo '${l}'`).join('\n')}\nexit 0\n`
}

describe('ClaudeCodeAdapter', () => {
  let tmpDir: string
  let fakeBinaryPath: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'claude-test-'))
    fakeBinaryPath = join(tmpDir, 'claude')

    // Create a fake claude binary that outputs stream-json JSONL
    const script = buildClaudeScript([
      { type: 'system', subtype: 'init', session_id: 'test-session-123', model: 'claude-sonnet-4-20250514', tools: [] },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Task completed successfully. I analyzed the codebase and made the requested changes.' },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: 'Task completed successfully. I analyzed the codebase and made the requested changes.',
        session_id: 'test-session-123',
        usage: { input_tokens: 150, output_tokens: 50 },
      },
    ])
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
      agentName: null,
      agentRole: null,
      taskId: 'task-1',
      taskTitle: 'Fix authentication bug',
      taskDescription: 'The login form is not validating email format',
      instructions: 'Fix the email validation in src/auth/login.ts',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)

    expect(result).toBeDefined()
    expect(result!.summary).toContain('Task completed successfully')
    expect(result!.tokens).toEqual({ input: 150, output: 50 })
    // Session ID should be captured (default persistence = 'local')
    expect(result!.sessionId).toBe('test-session-123')

    // Verify events were emitted (progress: launching + init + assistant text + completed)
    expect(events.length).toBeGreaterThanOrEqual(2)
    expect(events[0]!.type).toBe('progress')
    expect(events[0]!.summary).toBe('Launching Claude Code')
    // Last event should be "Claude Code completed"
    const lastEvent = events[events.length - 1]!
    expect(lastEvent.type).toBe('progress')
    expect(lastEvent.summary).toBe('Claude Code completed')
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'bad-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    await expect(adapter.start(context)).rejects.toThrow('API key invalid')

    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents.length).toBe(1)
  })

  test('builds prompt correctly from context', async () => {
    const echoBinaryPath = join(tmpDir, 'claude-echo')
    // Write prompt to a file, then output it as JSON-escaped result
    // Prompt now comes via stdin as stream-json, not as -p argument
    const promptFile = join(tmpDir, 'captured-prompt.txt')
    const echoScript = `#!/bin/bash
# Read the initial user_message from stdin (stream-json format)
read -r line
echo "$line" > "${promptFile}"
# Output a valid result
printf '{"type":"result","subtype":"success","result":"PROMPT captured"}\\n'
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
      agentName: null,
      agentRole: null,
      taskId: 'task-1',
      taskTitle: 'Write tests',
      taskDescription: 'Add unit tests for the auth module',
      instructions: 'Focus on edge cases',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)
    // The prompt is now sent as a stream-json message on stdin
    const capturedJson = await Bun.file(promptFile).text()
    const parsed = JSON.parse(capturedJson.trim())
    expect(parsed.type).toBe('user_message')
    expect(parsed.content).toContain('Write tests')
    expect(parsed.content).toContain('Add unit tests')
    expect(parsed.content).toContain('Focus on edge cases')
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result).toBeDefined()
    // No valid JSONL → no result text → "completed with no output"
    expect(result!.summary).toContain('completed with no output')
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: null,
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
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
    const resultText = 'Plan looks good.\\n\\n<AUTOPILOT_RESULT>\\n<outcome>approved</outcome>\\n<summary>Plan validated.</summary>\\n</AUTOPILOT_RESULT>'
    const outcomeBinaryPath = join(tmpDir, 'claude-structured')
    const script = buildClaudeScript([
      { type: 'system', subtype: 'init', session_id: 's-out' },
      {
        type: 'result',
        subtype: 'success',
        result: resultText,
        session_id: 's-out',
        usage: { input_tokens: 100, output_tokens: 30 },
      },
    ])
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Validate the plan',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result!.outputs).toEqual({ outcome: 'approved', summary: 'Plan validated.' })
    expect(result!.summary).toBe('Plan validated.')
  })

  test('extracts artifact from structured output', async () => {
    const resultText = 'Generated prompt.\\n\\n<AUTOPILOT_RESULT>\\n<summary>Prompt ready.</summary>\\n<artifact kind="implementation_prompt" title="Impl Prompt">Step 1: modify foo.ts</artifact>\\n</AUTOPILOT_RESULT>'
    const artifactBinaryPath = join(tmpDir, 'claude-artifact')
    const script = buildClaudeScript([
      {
        type: 'result',
        subtype: 'success',
        result: resultText,
      },
    ])
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Generate prompt',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
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
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Just do the work',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result!.outputs).toBeUndefined()
    expect(result!.artifacts).toBeUndefined()
  })

  test('emits tool_use events from assistant messages', async () => {
    const toolBinaryPath = join(tmpDir, 'claude-tools')
    const script = buildClaudeScript([
      { type: 'system', subtype: 'init', session_id: 'tool-session' },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me read the file.' },
            { type: 'tool_use', name: 'Read' },
            { type: 'text', text: 'Now editing.' },
            { type: 'tool_use', name: 'Edit' },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: 'Done with tools.',
        session_id: 'tool-session',
        usage: { input_tokens: 200, output_tokens: 100 },
      },
    ])
    await writeFile(toolBinaryPath, script)
    await chmod(toolBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: toolBinaryPath,
      workDir: tmpDir,
    })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const context: RunContext = {
      runId: 'run-tools-1',
      agentId: 'dev',
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'test',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    await adapter.start(context)

    const toolEvents = events.filter((e) => e.type === 'tool_use')
    expect(toolEvents.length).toBe(2)
    expect(toolEvents[0]!.summary).toBe('Read')
    expect(toolEvents[1]!.summary).toBe('Edit')

    // Should also have progress events for text blocks
    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents.some((e) => e.summary!.includes('Let me read the file'))).toBe(true)
    expect(progressEvents.some((e) => e.summary!.includes('Now editing'))).toBe(true)
  })

  test('steer sends user_message to stdin during execution', async () => {
    // Create a binary that reads from stdin and echoes steer messages
    const steerBinaryPath = join(tmpDir, 'claude-steer')
    const steerCapture = join(tmpDir, 'steer-capture.txt')
    const steerScript = `#!/bin/bash
# Read initial user_message
read -r initial

# Wait briefly for steer messages to arrive
sleep 0.3

# Read any subsequent messages from stdin (non-blocking)
messages=""
while IFS= read -r -t 0.5 line; do
  messages="$messages$line
"
done

# Write captured steer messages to file
echo "$messages" > "${steerCapture}"

# Output result
echo '{"type":"result","subtype":"success","result":"Received steer messages.","usage":{"input_tokens":10,"output_tokens":5}}'
exit 0
`
    await writeFile(steerBinaryPath, steerScript)
    await chmod(steerBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: steerBinaryPath,
      workDir: tmpDir,
    })

    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const context: RunContext = {
      runId: 'run-steer-1',
      agentId: 'developer',
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Do something',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
      injectedContext: null,
      contextHints: null,
      localDev: false,
    }

    // Start the run in background
    const runPromise = adapter.start(context)

    // Wait a bit for the process to start
    await Bun.sleep(100)

    // Send a steer message
    const delivered = adapter.steer('Focus on pricing instead')
    expect(delivered).toBe(true)

    const result = await runPromise

    // Verify steer event was emitted
    const steerEvents = events.filter((e) => e.summary.startsWith('Steering:'))
    expect(steerEvents.length).toBe(1)
    expect(steerEvents[0]!.summary).toContain('Focus on pricing')

    // Verify the steer message was written to stdin
    const captured = await Bun.file(steerCapture).text()
    if (captured.trim()) {
      const parsed = JSON.parse(captured.trim().split('\n')[0]!)
      expect(parsed.type).toBe('user_message')
      expect(parsed.content).toBe('Focus on pricing instead')
    }
  })

  test('steer returns false when not running', () => {
    const adapter = new ClaudeCodeAdapter({
      binaryPath: fakeBinaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    // No process running, steer should return false
    const delivered = adapter.steer('test message')
    expect(delivered).toBe(false)
  })

  test('handles result error event', async () => {
    const errorBinaryPath = join(tmpDir, 'claude-result-error')
    const script = buildClaudeScript([
      { type: 'system', subtype: 'init', session_id: 'err-session' },
      { type: 'result', subtype: 'error', error: 'Max turns reached' },
    ])
    // Override to exit 0 so we test error handling in the event, not exit code
    await writeFile(errorBinaryPath, script)
    await chmod(errorBinaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath: errorBinaryPath,
      workDir: tmpDir,
    })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const context: RunContext = {
      runId: 'run-err-1',
      agentId: 'dev',
      agentName: null,
      agentRole: null,
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'test',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: null,
      workDir: null,
      capabilities: null,
      model: null,
    }

    const result = await adapter.start(context)
    // Error events should be emitted
    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents.length).toBe(1)
    expect(errorEvents[0]!.summary).toBe('Max turns reached')
    // No result text from error → completed with no output
    expect(result!.summary).toContain('completed with no output')
  })
})
