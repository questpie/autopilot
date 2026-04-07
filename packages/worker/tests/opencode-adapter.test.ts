import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { OpenCodeAdapter } from '../src/runtimes/opencode'
import type { RunContext, WorkerEvent } from '../src/runtimes/adapter'

const BASIC_CONTEXT: RunContext = {
  runId: 'run-oc-1',
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
  model: null,
}

describe('OpenCodeAdapter', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'opencode-test-'))
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

  test('executes a fresh run and returns result', async () => {
    const output = JSON.stringify({
      content: 'Task completed. I fixed the email validation.',
      session_id: 'session-oc-123',
      usage: { input_tokens: 200, output_tokens: 80 },
    })

    const binaryPath = await createBinary(
      'opencode-basic',
      `#!/bin/bash\necho '${output}'\nexit 0\n`,
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const result = await adapter.start(BASIC_CONTEXT)

    expect(result).toBeDefined()
    expect(result!.summary).toContain('I fixed the email validation')
    expect(result!.tokens).toEqual({ input: 200, output: 80 })
    expect(result!.sessionId).toBe('session-oc-123')

    // Should have progress events: launch + completed
    const progressEvents = events.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBe(2)
    expect(progressEvents[0]!.summary).toBe('Launching OpenCode')
    expect(progressEvents[1]!.summary).toBe('OpenCode completed')
  })

  test('handles resume with runtimeSessionRef', async () => {
    const output = JSON.stringify({
      content: 'Resumed and completed.',
      session_id: 'session-resumed',
    })

    const binaryPath = await createBinary(
      'opencode-resume',
      `#!/bin/bash\necho '${output}'\nexit 0\n`,
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    const result = await adapter.start({
      ...BASIC_CONTEXT,
      runtimeSessionRef: 'session-original',
    })

    expect(result!.sessionId).toBe('session-resumed')

    // Should show resume message
    const launchEvent = events.find((e) => e.type === 'progress')
    expect(launchEvent!.summary).toContain('Resuming OpenCode session')
  })

  test('handles non-zero exit code', async () => {
    const binaryPath = await createBinary(
      'opencode-fail',
      '#!/bin/bash\necho "Authentication failed" >&2\nexit 1\n',
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    const events: WorkerEvent[] = []
    adapter.onEvent((e) => events.push(e))

    await expect(adapter.start(BASIC_CONTEXT)).rejects.toThrow('Authentication failed')

    const errorEvents = events.filter((e) => e.type === 'error')
    expect(errorEvents.length).toBe(1)
  })

  test('handles plain text output gracefully', async () => {
    const binaryPath = await createBinary(
      'opencode-plain',
      '#!/bin/bash\necho "Just some plain text"\nexit 0\n',
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result!.summary).toBe('Just some plain text')
  })

  test('extracts structured output from AUTOPILOT_RESULT block', async () => {
    const content =
      'Review complete.\\n\\n<AUTOPILOT_RESULT>\\n<outcome>approved</outcome>\\n<summary>All tests pass.</summary>\\n</AUTOPILOT_RESULT>'
    const output = JSON.stringify({ content, session_id: 'session-struct' })

    const binaryPath = await createBinary(
      'opencode-structured',
      `#!/bin/bash\necho '${output}'\nexit 0\n`,
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result!.outputs).toEqual({ outcome: 'approved', summary: 'All tests pass.' })
    expect(result!.summary).toBe('All tests pass.')
  })

  test('handles alternative JSON field names', async () => {
    // OpenCode might use different field names — test resilience
    const output = JSON.stringify({
      result: 'Done via result field.',
      sessionId: 'session-alt',
      tokens: { input: 100, output: 50 },
    })

    const binaryPath = await createBinary(
      'opencode-alt-fields',
      `#!/bin/bash\necho '${output}'\nexit 0\n`,
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result!.summary).toContain('Done via result field')
    expect(result!.sessionId).toBe('session-alt')
    expect(result!.tokens).toEqual({ input: 100, output: 50 })
  })

  test('stop kills the subprocess', async () => {
    const binaryPath = await createBinary(
      'opencode-sleep',
      '#!/bin/bash\nsleep 60\n',
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const startPromise = adapter.start(BASIC_CONTEXT)
    await Bun.sleep(100)
    await adapter.stop()

    await expect(startPromise).rejects.toThrow()
  })

  test('uses workspace workDir as cwd', async () => {
    const customWorkDir = await mkdtemp(join(tmpdir(), 'opencode-workdir-'))
    const binaryPath = await createBinary(
      'opencode-cwd',
      `#!/bin/bash\necho '{"content":"cwd='$(pwd)'"}'\nexit 0\n`,
    )

    const adapter = new OpenCodeAdapter({ binaryPath })
    adapter.onEvent(() => {})

    const result = await adapter.start({ ...BASIC_CONTEXT, workDir: customWorkDir })
    expect(result!.summary).toContain(customWorkDir)
    await rm(customWorkDir, { recursive: true })
  })

  test('warns about unsupported sessionPersistence=off', () => {
    const originalWarn = console.warn
    const warnings: string[] = []
    console.warn = (...args: unknown[]) => warnings.push(args.join(' '))

    new OpenCodeAdapter({ sessionPersistence: 'off' })

    console.warn = originalWarn
    expect(warnings.some((w) => w.includes('sessionPersistence="off"'))).toBe(true)
    expect(warnings.some((w) => w.includes('not supported'))).toBe(true)
  })

  test('handles empty output gracefully', async () => {
    const binaryPath = await createBinary(
      'opencode-empty',
      '#!/bin/bash\nexit 0\n',
    )

    const adapter = new OpenCodeAdapter({ binaryPath, workDir: tmpDir })
    adapter.onEvent(() => {})

    const result = await adapter.start(BASIC_CONTEXT)
    expect(result).toBeDefined()
    // Empty stdout → empty string summary
    expect(result!.summary).toBeDefined()
  })
})
