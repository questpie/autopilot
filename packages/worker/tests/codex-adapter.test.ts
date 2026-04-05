import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CodexAdapter } from '../src/runtimes/codex'
import type { RunContext, WorkerEvent } from '../src/runtimes/adapter'

/** Helper to build a fake codex binary that outputs JSONL events. */
function buildCodexScript(events: object[]): string {
  const lines = events.map((e) => JSON.stringify(e))
  // Output each event as a separate line (JSONL)
  return `#!/bin/bash\n${lines.map((l) => `echo '${l}'`).join('\n')}\nexit 0\n`
}

const BASIC_CONTEXT: RunContext = {
  runId: 'run-codex-1',
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
}

describe('CodexAdapter', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codex-test-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true })
  })

  async function createBinary(name: string, script: string): Promise<string> {
    const path = join(tmpDir, name)
    await writeFile(path, script)
    await chmod(path, 0o755)
    return path
  }

  test('executes a fresh run with JSONL output', async () => {
    const binaryPath = await createBinary(
      'codex-basic',
      buildCodexScript([
        { type: 'thread.started', thread_id: 'thread-abc123' },
        { type: 'turn.started' },
        {
          type: 'item.completed',
          item: { type: 'agent_message', content: 'Task completed. I fixed the email validation.' },
        },
        { type: 'turn.completed', usage: { input_tokens: 200, output_tokens: 80 } },
      ]),
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const result = await adapter.start(BASIC_CONTEXT)

    expect(result).toBeDefined()
    expect(result!.summary).toContain('I fixed the email validation')
    expect(result!.tokens).toEqual({ input: 200, output: 80 })
    expect(result!.sessionId).toBe('thread-abc123')

    // Should have progress events
    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBeGreaterThanOrEqual(2) // launch + agent message + completed
  })

  test('handles resume with runtimeSessionRef', async () => {
    // Create a binary that echoes its args to stderr so we can verify
    const binaryPath = await createBinary(
      'codex-resume',
      `#!/bin/bash
echo "$@" >&2
echo '{"type":"thread.started","thread_id":"thread-resumed"}'
echo '{"type":"item.completed","item":{"type":"agent_message","content":"Resumed and done."}}'
echo '{"type":"turn.completed","usage":{"input_tokens":50,"output_tokens":20}}'
exit 0
`,
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const context: RunContext = {
      ...BASIC_CONTEXT,
      runtimeSessionRef: 'thread-original-123',
    }

    const result = await adapter.start(context)

    expect(result).toBeDefined()
    expect(result!.sessionId).toBe('thread-resumed')
    expect(result!.summary).toContain('Resumed and done')
  })

  test('maps tool_use events from command_execution items', async () => {
    const binaryPath = await createBinary(
      'codex-tools',
      buildCodexScript([
        { type: 'thread.started', thread_id: 'thread-tools' },
        {
          type: 'item.started',
          item: { type: 'command_execution', command: 'ls -la src/' },
        },
        {
          type: 'item.started',
          item: { type: 'mcp_tool_call', name: 'autopilot_task_list' },
        },
        {
          type: 'item.completed',
          item: { type: 'agent_message', content: 'Done with tools.' },
        },
        { type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 40 } },
      ]),
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    await adapter.start(BASIC_CONTEXT)

    const toolEvents = events.filter((e) => e.type === 'tool_use')
    expect(toolEvents.length).toBe(2)
    expect(toolEvents[0]!.summary).toContain('ls -la src/')
    expect(toolEvents[1]!.summary).toContain('autopilot_task_list')
  })

  test('handles turn.failed event', async () => {
    const binaryPath = await createBinary(
      'codex-fail-turn',
      buildCodexScript([
        { type: 'thread.started', thread_id: 'thread-fail' },
        { type: 'turn.failed', error: { message: 'Rate limit exceeded' } },
      ]) + '\n# Override exit code\nexit 1\n',
    )

    // Fix: the buildCodexScript adds exit 0, so we need a different approach
    const fixedBinaryPath = await createBinary(
      'codex-fail-turn2',
      `#!/bin/bash
echo '{"type":"thread.started","thread_id":"thread-fail"}'
echo '{"type":"turn.failed","error":{"message":"Rate limit exceeded"}}'
exit 1
`,
    )

    const adapter = new CodexAdapter({ binaryPath: fixedBinaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    await expect(adapter.start(BASIC_CONTEXT)).rejects.toThrow()

    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents.length).toBeGreaterThanOrEqual(1)
  })

  test('handles non-zero exit code', async () => {
    const binaryPath = await createBinary(
      'codex-exit-fail',
      '#!/bin/bash\necho "API key invalid" >&2\nexit 1\n',
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    await expect(adapter.start(BASIC_CONTEXT)).rejects.toThrow('API key invalid')
  })

  test('extracts structured output from AUTOPILOT_RESULT block', async () => {
    const resultText =
      'Analysis complete.\\n\\n<AUTOPILOT_RESULT>\\n<outcome>approved</outcome>\\n<summary>Code review passed.</summary>\\n</AUTOPILOT_RESULT>'

    const binaryPath = await createBinary(
      'codex-structured',
      buildCodexScript([
        { type: 'thread.started', thread_id: 'thread-struct' },
        {
          type: 'item.completed',
          item: { type: 'agent_message', content: resultText },
        },
        { type: 'turn.completed', usage: { input_tokens: 300, output_tokens: 100 } },
      ]),
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)

    expect(result!.outputs).toEqual({ outcome: 'approved', summary: 'Code review passed.' })
    expect(result!.summary).toBe('Code review passed.')
  })

  test('stop kills the subprocess', async () => {
    const binaryPath = await createBinary(
      'codex-sleep',
      '#!/bin/bash\nsleep 60\n',
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const startPromise = adapter.start(BASIC_CONTEXT)
    await Bun.sleep(100)
    await adapter.stop()

    await expect(startPromise).rejects.toThrow()
  })

  test('handles empty output gracefully', async () => {
    const binaryPath = await createBinary(
      'codex-empty',
      '#!/bin/bash\nexit 0\n',
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result).toBeDefined()
    expect(result!.summary).toContain('no output')
  })

  test('handles content as array of blocks', async () => {
    const binaryPath = await createBinary(
      'codex-blocks',
      buildCodexScript([
        { type: 'thread.started', thread_id: 'thread-blocks' },
        {
          type: 'item.completed',
          item: {
            type: 'agent_message',
            content: [
              { type: 'text', text: 'First paragraph.' },
              { type: 'text', text: 'Second paragraph.' },
            ],
          },
        },
        { type: 'turn.completed', usage: { input_tokens: 50, output_tokens: 20 } },
      ]),
    )

    const adapter = new CodexAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result!.summary).toContain('First paragraph')
    expect(result!.summary).toContain('Second paragraph')
  })

  test('uses workspace workDir as cwd', async () => {
    const customWorkDir = await mkdtemp(join(tmpdir(), 'codex-workdir-'))
    // Create binary that outputs cwd
    const binaryPath = await createBinary(
      'codex-cwd',
      `#!/bin/bash
echo '{"type":"item.completed","item":{"type":"agent_message","content":"cwd='$(pwd)'"}}'
echo '{"type":"turn.completed"}'
exit 0
`,
    )

    const adapter = new CodexAdapter({ binaryPath })
    adapter.onEvent(() => {})

    const result = await adapter.start({
      ...BASIC_CONTEXT,
      workDir: customWorkDir,
    })

    expect(result!.summary).toContain(customWorkDir)
    await rm(customWorkDir, { recursive: true })
  })

  test('warns about unsupported sessionPersistence=off', () => {
    const originalWarn = console.warn
    const warnings: string[] = []
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '))

    new CodexAdapter({ sessionPersistence: 'off' })

    console.warn = originalWarn
    expect(warnings.some((w) => w.includes('sessionPersistence="off"'))).toBe(true)
    expect(warnings.some((w) => w.includes('not supported'))).toBe(true)
  })
})
