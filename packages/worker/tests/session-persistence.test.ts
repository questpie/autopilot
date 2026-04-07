import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ClaudeCodeAdapter } from '../src/runtimes/claude-code'
import type { RunContext } from '../src/runtimes/adapter'

describe('Session persistence', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'session-test-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('local mode: does NOT pass --no-session-persistence, returns sessionId', async () => {
    const binaryPath = join(tmpDir, 'claude-local')
    const script = `#!/bin/bash
ARGS="$@"
# Check that --no-session-persistence is NOT in args
if echo "$ARGS" | grep -q "no-session-persistence"; then
  echo '{"result":"ERROR: no-session-persistence was passed","session_id":"bad"}'
  exit 1
fi
echo '{"result":"done","session_id":"sess-abc-123","usage":{"input_tokens":10,"output_tokens":5}}'
exit 0
`
    await writeFile(binaryPath, script)
    await chmod(binaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath,
      workDir: tmpDir,
      sessionPersistence: 'local',
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-sess-1',
      agentId: 'developer',
      taskId: null,
      taskTitle: 'Test session',
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
    expect(result!.sessionId).toBe('sess-abc-123')
  })

  test('off mode: passes --no-session-persistence, no sessionId returned', async () => {
    const binaryPath = join(tmpDir, 'claude-off')
    const script = `#!/bin/bash
ARGS="$@"
if echo "$ARGS" | grep -q "no-session-persistence"; then
  echo '{"result":"ok-ephemeral","session_id":"should-be-ignored","usage":{"input_tokens":1,"output_tokens":1}}'
  exit 0
fi
echo '{"result":"ERROR: no-session-persistence was NOT passed"}'
exit 1
`
    await writeFile(binaryPath, script)
    await chmod(binaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath,
      workDir: tmpDir,
      sessionPersistence: 'off',
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-sess-2',
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
    expect(result!.sessionId).toBeUndefined()
  })

  test('resume: passes --resume <session-id> when runtimeSessionRef is set', async () => {
    const binaryPath = join(tmpDir, 'claude-resume')
    const script = `#!/bin/bash
ARGS="$@"
# Check --resume is in args
if ! echo "$ARGS" | grep -q -- "--resume"; then
  echo '{"result":"ERROR: --resume not found"}'
  exit 1
fi

# Extract session id after --resume
SESS_ID=""
FOUND=0
for arg in "$@"; do
  if [ "$FOUND" = "1" ]; then
    SESS_ID="$arg"
    break
  fi
  if [ "$arg" = "--resume" ]; then
    FOUND=1
  fi
done

echo "{\\"result\\":\\"resumed session $SESS_ID\\",\\"session_id\\":\\"$SESS_ID\\",\\"usage\\":{\\"input_tokens\\":20,\\"output_tokens\\":10}}"
exit 0
`
    await writeFile(binaryPath, script)
    await chmod(binaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath,
      workDir: tmpDir,
      sessionPersistence: 'local',
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-resume-1',
      agentId: 'developer',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'Continue with more tests',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: 'sess-original-456',
      workDir: null,
      model: null,
    }

    const result = await adapter.start(context)
    expect(result).toBeDefined()
    expect(result!.summary).toContain('resumed session sess-original-456')
    expect(result!.sessionId).toBe('sess-original-456')
  })

  test('resume emits progress event mentioning session resume', async () => {
    const binaryPath = join(tmpDir, 'claude-resume-evt')
    await writeFile(binaryPath, '#!/bin/bash\necho \'{"result":"ok","session_id":"s1"}\'\nexit 0\n')
    await chmod(binaryPath, 0o755)

    const adapter = new ClaudeCodeAdapter({
      binaryPath,
      workDir: tmpDir,
      sessionPersistence: 'local',
    })

    const events: Array<{ type: string; summary: string }> = []
    adapter.onEvent((e) => events.push(e))

    const context: RunContext = {
      runId: 'run-resume-evt',
      agentId: 'developer',
      taskId: null,
      taskTitle: null,
      taskDescription: null,
      instructions: 'do more',
      orchestratorUrl: 'http://localhost:7778',
      apiKey: 'test-key',
      runtimeSessionRef: 'sess-evt-test',
      workDir: null,
      model: null,
    }

    await adapter.start(context)
    expect(events[0]!.summary).toContain('Resuming Claude Code session')
    expect(events[0]!.summary).toContain('sess-evt-test')
  })

  test('default persistence is local (sessionId captured)', async () => {
    const binaryPath = join(tmpDir, 'claude-default')
    await writeFile(
      binaryPath,
      '#!/bin/bash\necho \'{"result":"ok","session_id":"default-sess"}\'\nexit 0\n',
    )
    await chmod(binaryPath, 0o755)

    // No explicit sessionPersistence config
    const adapter = new ClaudeCodeAdapter({
      binaryPath,
      workDir: tmpDir,
    })
    adapter.onEvent(() => {})

    const context: RunContext = {
      runId: 'run-default',
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
    expect(result!.sessionId).toBe('default-sess')
  })
})
